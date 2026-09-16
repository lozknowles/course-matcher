const ICONS = {
  earlier: './pathway-icons/person.svg',
  selected: './pathway-icons/laptop.svg',
  next: './pathway-icons/gear.svg'
};
const NEXT_ICONS = { OCC0013: './pathway-icons/shield.svg', OCC0119A: './pathway-icons/laptop.svg' };
const PREFERRED = ['OCC0825', 'OCC0013', 'OCC0119A'];
const list = value => Array.isArray(value) ? value : [];
const idOf = item => String(item?.id ?? item?.occupationId ?? '');
const titleOf = item => String(item?.title ?? item?.name ?? 'Unknown occupation');

function orderedNext(pathway) {
  const items = list(pathway.next);
  if (idOf(pathway.selected) !== 'OCC0116') return items;
  return items.map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const ai = PREFERRED.indexOf(idOf(a.item));
      const bi = PREFERRED.indexOf(idOf(b.item));
      return (ai < 0 ? PREFERRED.length : ai) - (bi < 0 ? PREFERRED.length : bi) || a.index - b.index;
    }).map(entry => entry.item);
}

function node(item, kind, onSelect) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pathway-node';
  button.dataset.occupation = idOf(item);
  button.dataset.kind = kind;
  const image = document.createElement('img');
  image.src = kind === 'next' ? (NEXT_ICONS[idOf(item)] || ICONS.next) : ICONS[kind];
  image.alt = '';
  const title = document.createElement('strong');
  title.textContent = titleOf(item);
  const relationship = document.createElement('span');
  relationship.textContent = kind === 'earlier' ? 'Earlier step' : kind === 'next' ? 'Next step' : 'Selected occupation';
  button.append(image, title, relationship);
  button.addEventListener('click', () => onSelect?.(idOf(item)));
  return button;
}

function heading(text) {
  const value = document.createElement('h3');
  value.textContent = text;
  return value;
}

export function renderPathway(host, pathway = {}, options = {}) {
  let frame = 0;
  let observer;
  let canvas;
  const win = globalThis.window;
  const selected = pathway.selected && idOf(pathway.selected) ? pathway.selected : null;
  const earlier = list(pathway.earlier);
  const next = orderedNext(pathway);
  const edgeSet = new Set(list(pathway.edges).map(edge => `${String(edge.from)}>${String(edge.to)}`));
  const displayedEdges = [];

  const draw = () => {
    frame = 0;
    if (!canvas?.isConnected) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const ratio = win?.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const context = canvas.getContext?.('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, rect.width, rect.height);
    context.strokeStyle = 'currentColor';
    context.fillStyle = 'currentColor';
    context.lineWidth = 2;
    displayedEdges.forEach(({ from, to }) => {
      const a = host.querySelector(`[data-occupation=\"${CSS.escape(from)}\"]`);
      const b = host.querySelector(`[data-occupation=\"${CSS.escape(to)}\"]`);
      if (!a || !b) return;
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      const stacked = Math.abs((ar.left + ar.width / 2) - (br.left + br.width / 2)) < Math.abs((ar.top + ar.height / 2) - (br.top + br.height / 2));
      let x1, y1, x2, y2, c1x, c1y, c2x, c2y, gutterX;
      if (stacked) {
        x1 = ar.left - rect.left;
        y1 = ar.top + ar.height / 2 - rect.top;
        x2 = br.left - rect.left;
        y2 = br.top + br.height / 2 - rect.top;
        gutterX = Math.min(x1, x2) - 16;
      } else {
        const rightward = br.left >= ar.right;
        x1 = (rightward ? ar.right : ar.left) - rect.left;
        y1 = ar.top + ar.height / 2 - rect.top;
        x2 = (rightward ? br.left : br.right) - rect.left;
        y2 = br.top + br.height / 2 - rect.top;
        const middle = (x1 + x2) / 2;
        c1x = middle; c1y = y1; c2x = middle; c2y = y2;
      }
      context.beginPath();
      context.moveTo(x1, y1);
      if (stacked) {
        context.lineTo(gutterX, y1);
        context.lineTo(gutterX, y2);
        context.lineTo(x2, y2);
      } else {
        context.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
      }
      context.stroke();
      const angle = stacked ? 0 : Math.atan2(y2 - c2y, x2 - c2x);
      const size = 8;
      context.beginPath();
      context.moveTo(x2, y2);
      context.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
      context.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
      context.closePath();
      context.fill();
    });
  };
  const schedule = () => { if (!frame) frame = (win?.requestAnimationFrame || (fn => setTimeout(fn, 0)))(draw); };

  host.replaceChildren();
  if (!selected) {
    const message = document.createElement('p');
    message.textContent = 'Choose an occupation to view its pathway.';
    host.append(message);
    return () => host.replaceChildren();
  }
  const view = options.view === 'list' ? 'list' : 'graph';
  if (view === 'list') {
    const wrap = document.createElement('div');
    wrap.className = 'pathway-list';
    wrap.append(heading(`Earlier steps (${earlier.length})`), ...earlier.map(item => node(item, 'earlier', options.onSelect)), heading(`Next steps (${next.length})`), ...next.map(item => node(item, 'next', options.onSelect)));
    host.append(wrap);
  } else {
    const grid = document.createElement('div');
    grid.className = 'pathway-grid';
    const shownEarlier = earlier.slice(0, 3), shownNext = next.slice(0, 3);
    const column = (kind, items, label) => {
      const part = document.createElement('section');
      part.className = `pathway-column pathway-column-${kind}`;
      part.append(heading(`${label} (${items.length})`), ...items.slice(0, 3).map(item => node(item, kind, options.onSelect)));
      return part;
    };
    grid.append(column('earlier', shownEarlier, `Earlier steps — ${earlier.length} total`), column('selected', [selected], 'Selected occupation'), column('next', shownNext, `Next steps — ${next.length} total`));
    if (earlier.length > 3 || next.length > 3) {
      const all = document.createElement('button'); all.type = 'button'; all.dataset.viewAll = ''; all.textContent = `View all ${earlier.length + next.length} pathway links`;
      all.addEventListener('click', () => options.onViewChange?.('list')); grid.append(all);
    }
    canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
    shownEarlier.forEach(item => { if (edgeSet.has(`${idOf(item)}>${idOf(selected)}`)) displayedEdges.push({ from: idOf(item), to: idOf(selected) }); });
    shownNext.forEach(item => { if (edgeSet.has(`${idOf(selected)}>${idOf(item)}`)) displayedEdges.push({ from: idOf(selected), to: idOf(item) }); });
    canvas.dataset.edges = JSON.stringify(displayedEdges);
    grid.prepend(canvas); host.append(grid);
    if (globalThis.ResizeObserver) { observer = new ResizeObserver(schedule); observer.observe(grid); }
    win?.addEventListener?.('resize', schedule); schedule();
  }
  return () => {
    observer?.disconnect(); win?.removeEventListener?.('resize', schedule);
    if (frame) (win?.cancelAnimationFrame || clearTimeout)(frame);
    host.replaceChildren();
  };
}
