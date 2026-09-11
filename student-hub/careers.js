const PAGE_SIZE = 20;
const REFERENCE_URL = './skills-england-reference.json';
const els = {};
let snapshot = null;
let matches = [];
let page = 0;
let selectedId = null;
let selectedCard = null;

const text = value => value == null || String(value).trim() === '' ? 'Unavailable' : String(value).trim();
const list = value => Array.isArray(value) ? value : [];
const officialUrl = value => {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && (url.hostname === 'skillsengland.education.gov.uk' || url.hostname.endsWith('.skillsengland.education.gov.uk')) ? url.href : null;
  } catch { return null; }
};
const add = (parent, tag, value, className) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  parent.append(node);
  return node;
};
const dateLabel = value => {
  if (!value) return 'unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

function cacheElements() {
  for (const id of ['reference-status','reference-error','retry-reference','route-filter','occupation-search','results-panel','result-count','occupation-results','previous-page','next-page','occupation-detail','back-to-results','occupation-title','occupation-content','next-steps','earlier-steps','progression-coverage']) els[id] = document.getElementById(id);
}

function setStatus(extra = '') {
  if (!snapshot) return;
  const retrieved = new Date(snapshot.retrievedAt);
  const age = Number.isNaN(retrieved.getTime()) ? null : Math.max(0, Math.floor((Date.now() - retrieved.getTime()) / 86400000));
  const stale = age != null && age > 30 ? ` Stale reference (${age} days old).` : '';
  const offline = navigator.onLine === false ? ' Offline: using the loaded cached reference.' : '';
  els['reference-status'].textContent = `${text(snapshot.provider)} · retrieved ${dateLabel(snapshot.retrievedAt)} · dataset version ${text(snapshot.datasetVersion).toLowerCase() === 'unavailable' ? 'unknown' : text(snapshot.datasetVersion)}.${stale}${offline}${extra}`;
}

function validSnapshot(data) {
  return data && typeof data === 'object' && Array.isArray(data.routes) && Array.isArray(data.occupations) && data.occupations.length;
}

function populateRoutes() {
  els['route-filter'].replaceChildren(new Option('All routes', ''));
  list(snapshot.routes).slice().sort((a, b) => text(a.name).localeCompare(text(b.name), 'en', { sensitivity: 'base' })).forEach(route => els['route-filter'].append(new Option(text(route.name), String(route.id))));
}

function statusName(item) {
  return text(item.statusName ?? item.status);
}

function filteredOccupations() {
  const query = els['occupation-search'].value.trim().toLocaleLowerCase();
  const route = els['route-filter'].value;
  return list(snapshot.occupations).filter(item => {
    const searchable = [item.title, item.overview, ...list(item.typicalJobTitles)].map(value => String(value ?? '').toLocaleLowerCase());
    return (!route || String(item.routeId) === route) && (!query || searchable.some(value => value.includes(query)));
  }).sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'en', { sensitivity: 'base' }) || String(a.id ?? '').localeCompare(String(b.id ?? ''), 'en'));
}

function occupationButton(item, className = 'occupation-card') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.occupation = String(item.id);
  add(button, 'strong', text(item.title));
  if (className === 'occupation-card') {
    add(button, 'span', `${text(item.routeName)} · Level ${text(item.level)}`);
    add(button, 'span', `Provider status: ${statusName(item)}`, 'badge');
  }
  button.addEventListener('click', () => showDetail(item.id, true, button));
  return button;
}

function renderResults() {
  matches = filteredOccupations();
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  page = Math.min(page, pages - 1);
  const start = page * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);
  els['occupation-results'].replaceChildren(...visible.map(item => occupationButton(item)));
  els['result-count'].textContent = matches.length ? `${matches.length} matching occupations. Showing ${start + 1}–${start + visible.length}.` : 'No occupations match your search and route filters.';
  els['previous-page'].disabled = page === 0;
  els['next-page'].disabled = start + PAGE_SIZE >= matches.length;
}

function definition(parent, label, value) {
  add(parent, 'dt', label);
  add(parent, 'dd', text(value));
}

function sourceLink(parent, label, value) {
  const href = officialUrl(value);
  if (!href) return;
  const link = add(parent, 'a', label);
  link.href = href;
}

function renderSteps(container, items) {
  container.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'step-list';
  items.forEach(item => wrap.append(occupationButton(item, 'step-card')));
  if (items.length) container.append(wrap);
  else add(container, 'p', 'No links are available in this bounded snapshot.');
}

function showDetail(id, push = false, trigger = null) {
  const item = list(snapshot.occupations).find(entry => String(entry.id) === String(id));
  if (!item) return;
  selectedId = String(item.id);
  selectedCard = trigger || selectedCard;
  els['occupation-title'].textContent = text(item.title);
  const content = els['occupation-content'];
  content.replaceChildren();
  add(content, 'p', text(item.overview));
  const dl = document.createElement('dl');
  definition(dl, 'Provider status', statusName(item));
  definition(dl, 'Level', item.level);
  definition(dl, 'Typical job titles', list(item.typicalJobTitles).length ? item.typicalJobTitles.join(', ') : null);
  content.append(dl);
  const products = list(item.products);
  add(content, 'h3', 'Apprenticeship and technical products');
  if (!products.length) add(content, 'p', 'Unavailable');
  else {
    const ul = document.createElement('ul');
    products.forEach(product => add(ul, 'li', `${text(product.title ?? product.name)} — ${text(product.type)}; level ${text(product.level)}; status ${text(product.statusName ?? product.status)}`));
    content.append(ul);
  }
  const details = document.createElement('details');
  add(details, 'summary', 'Source details');
  const source = document.createElement('p');
  source.textContent = `SOC2020: ${typeof item.soc2020 === 'object' ? `${text(item.soc2020.code)} — ${text(item.soc2020.description)}` : text(item.soc2020)} · Version: ${text(item.version)} · Status updated: ${dateLabel(item.statusLastUpdated)}. `;
  sourceLink(source, 'Official occupation source', item.sourceUrl);
  details.append(source);
  content.append(details);
  const byId = new Map(list(snapshot.occupations).map(entry => [String(entry.id), entry]));
  const uniqueDestinations = ids => [...new Set(ids.map(String))].map(id => byId.get(id)).filter(Boolean);
  const outgoing = uniqueDestinations(list(snapshot.edges).filter(edge => String(edge.from) === selectedId).map(edge => edge.to));
  const incoming = uniqueDestinations(list(snapshot.edges).filter(edge => String(edge.to) === selectedId).map(edge => edge.from));
  renderSteps(els['next-steps'], outgoing);
  renderSteps(els['earlier-steps'], incoming);
  const covered = list(snapshot.progressionCoverage).map(String).includes(selectedId);
  const links = outgoing.length + incoming.length;
  els['progression-coverage'].replaceChildren();
  add(els['progression-coverage'], 'strong', 'Pathway coverage: ');
  els['progression-coverage'].append(document.createTextNode(covered ? (links ? 'This occupation was a cached progression seed and the available directed links are shown. This is still a bounded snapshot, not a comprehensive map of career possibilities.' : 'This occupation was a cached progression seed, but the snapshot returned zero progression links. This does not mean there are no career possibilities.') : 'The full progression for this occupation was not fetched. Any links shown come from other cached seeds and are partial.'));
  const progressionHref = officialUrl(item.progressionUrl);
  if (progressionHref) { els['progression-coverage'].append(document.createTextNode(' ')); sourceLink(els['progression-coverage'], 'Official pathway source', progressionHref); }
  els['results-panel'].hidden = true;
  els['occupation-detail'].hidden = false;
  if (push) history.pushState({ occupation: selectedId }, '', `#occupation=${encodeURIComponent(selectedId)}`);
  els['occupation-title'].focus();
}

function backToResults(updateHistory = true) {
  els['occupation-detail'].hidden = true;
  els['results-panel'].hidden = false;
  selectedId = null;
  if (updateHistory) history.pushState({}, '', `${location.pathname}${location.search}`);
  if (selectedCard?.isConnected) selectedCard.focus();
}

function bindEvents() {
  const refilter = () => { page = 0; renderResults(); };
  els['occupation-search'].addEventListener('input', refilter);
  els['route-filter'].addEventListener('change', refilter);
  els['previous-page'].addEventListener('click', () => { page--; renderResults(); els['result-count'].focus?.(); });
  els['next-page'].addEventListener('click', () => { page++; renderResults(); els['result-count'].focus?.(); });
  els['back-to-results'].addEventListener('click', () => backToResults());
  els['retry-reference'].addEventListener('click', loadExplorer);
  const eventTarget = globalThis.window ?? globalThis;
  eventTarget.addEventListener?.('popstate', () => {
    const id = new URLSearchParams(location.hash.slice(1)).get('occupation');
    if (id && snapshot) showDetail(id); else if (snapshot) backToResults(false);
  });
  eventTarget.addEventListener?.('offline', () => setStatus());
  eventTarget.addEventListener?.('online', () => setStatus());
}

export async function loadExplorer() {
  els['reference-error'].hidden = true;
  els['reference-status'].textContent = snapshot ? 'Refreshing packaged reference…' : 'Loading reference…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(REFERENCE_URL, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('Reference request failed');
    const data = await response.json();
    if (!validSnapshot(data)) throw new Error('Invalid reference');
    snapshot = data;
    populateRoutes();
    els['route-filter'].disabled = false;
    els['occupation-search'].disabled = false;
    renderResults();
    setStatus();
    const id = new URLSearchParams(location.hash.slice(1)).get('occupation');
    if (id) showDetail(id);
  } catch {
    els['reference-error'].hidden = false;
    if (snapshot) { renderResults(); setStatus(' Refresh failed; continuing with the previously loaded snapshot.'); }
    else { els['reference-status'].textContent = 'Reference unavailable.'; els['result-count'].textContent = 'Occupations cannot be shown until the reference loads.'; }
  } finally { clearTimeout(timeout); }
}

cacheElements();
bindEvents();
loadExplorer();
