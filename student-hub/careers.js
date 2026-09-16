import { pathwayFor, bestPayForOccupation } from './pathway-core.js?v=20260916-2';
import { renderPathway } from './pathway-graph.js';
import { selectDemandOccupation } from './demand-panel.js';

const PAGE_SIZE = 20, REFERENCE_URL = './skills-england-reference.json', PAY_URL = './ons-pay-reference.json', UK_PAY_URL = './ons-uk-pay-reference.json';
const ids = ['reference-status','reference-error','retry-reference','route-filter','occupation-search','result-count','occupation-results','previous-page','next-page','occupation-detail','back-to-results','occupation-title','occupation-content','progression-coverage','pathway-host','graph-view','list-view','pay-heading','pay-value','pay-summary','pay-note','pay-quality','pay-source','pay-context','jobs-link','jobs-context'];
const els = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
let snapshot = null, paySnapshot = null, ukPaySnapshot = null, payLoading = true, payRequest = 0, matches = [], page = 0, selectedId = null, selectedCard = null, view = 'graph', disposeGraph = () => {};
const list = value => Array.isArray(value) ? value : [];
const value = input => input == null || String(input).trim() === '' ? 'Unavailable' : String(input).trim();
const dateLabel = input => { const date = new Date(input); return !input || Number.isNaN(date.getTime()) ? 'unknown' : date.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }); };
const add = (parent, tag, content, className) => { const node = document.createElement(tag); if (className) node.className = className; node.textContent = content; parent.append(node); return node; };
const safeHttps = input => { try { const url = new URL(String(input)); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
const occupationById = id => list(snapshot?.occupations).find(item => String(item.id) === String(id));
const statusName = item => value(item?.statusName ?? item?.status);

function referenceStatus(extra = '') {
  if (!snapshot) return;
  const retrieved = new Date(snapshot.retrievedAt);
  const age = Number.isNaN(retrieved.getTime()) ? null : Math.max(0, Math.floor((Date.now() - retrieved.getTime()) / 86400000));
  const stale = age != null && age > 30 ? ` · reference is ${age} days old` : '';
  const offline = navigator.onLine === false ? ' · offline, using loaded data' : '';
  els['reference-status'].textContent = `${value(snapshot.provider)} · snapshot retrieved ${dateLabel(snapshot.retrievedAt)}${stale}${offline}${extra}`;
}
function populateRoutes() {
  els['route-filter'].replaceChildren(new Option('All routes', ''));
  list(snapshot.routes).slice().sort((a,b) => value(a.name).localeCompare(value(b.name))).forEach(route => els['route-filter'].append(new Option(value(route.name), String(route.id))));
}
function filtered() {
  const query = els['occupation-search'].value.trim().toLocaleLowerCase(), route = els['route-filter'].value;
  const title = item => value(item.title).toLocaleLowerCase();
  const rank = item => title(item) === query ? 0 : title(item).includes(query) ? 1 : 2;
  return list(snapshot.occupations).filter(item => (!route || String(item.routeId) === route) && (!query || [item.title,item.overview,...list(item.typicalJobTitles)].some(part => String(part ?? '').toLocaleLowerCase().includes(query)))).sort((a,b) => (query ? rank(a) - rank(b) : 0) || value(a.title).localeCompare(value(b.title), 'en', { sensitivity:'base' }));
}
function selectButton(item) {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'occupation-card'; button.dataset.occupation = String(item.id);
  button.setAttribute('aria-pressed', String(String(item.id) === selectedId));
  if (String(item.id) === selectedId) button.setAttribute('aria-current', 'true');
  add(button, 'strong', value(item.title)); add(button, 'span', `${value(item.routeName)} · Level ${value(item.level)}`);
  button.addEventListener('click', () => showOccupation(item.id, { push:true, focus:true, trigger:button }));
  return button;
}
function renderResults() {
  matches = filtered(); const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE)); page = Math.min(page, pages - 1);
  const start = page * PAGE_SIZE, shown = matches.slice(start, start + PAGE_SIZE);
  els['occupation-results'].replaceChildren(...shown.map(selectButton));
  els['result-count'].textContent = matches.length ? `${matches.length} matching occupations · showing ${start + 1}–${start + shown.length}` : 'No occupations match your search and route filters.';
  els['previous-page'].disabled = page === 0; els['next-page'].disabled = start + PAGE_SIZE >= matches.length;
}
function coverageText(pathway) {
  if (pathway.coverage.state === 'cached-links') return 'This cached pathway shows available directed links. Coverage is partial; use list view for every cached neighbour.';
  if (pathway.coverage.state === 'cached-empty') return 'This occupation was fetched, but the bounded snapshot returned no progression links. This does not mean no pathways exist.';
  return 'The full progression for this occupation was not fetched. Any links shown are incidental to other cached pathways and coverage is partial.';
}
function renderPay(item) {
  for (const id of ['pay-summary','pay-note','pay-quality','pay-source','pay-context']) els[id].replaceChildren();
  els['pay-heading'].textContent = 'Annual pay';
  if (payLoading) { els['pay-value'].textContent = 'Loading…'; return; }
  if (!paySnapshot && !ukPaySnapshot) { els['pay-value'].textContent = 'Unavailable'; els['pay-note'].textContent = 'The ONS pay references could not be loaded. Reload the page to try again.'; return; }
  const pay = bestPayForOccupation(paySnapshot, ukPaySnapshot, item), record = pay.record, meta = pay.meta ?? {};
  const sourceLink = (source, label) => {
    try { const url = new URL(String(source?.sourceUrl)); if (url.protocol === 'https:' && url.hostname === 'www.ons.gov.uk') { const link = add(els['pay-source'], 'a', label); link.href = url.href; return true; } } catch {}
    return false;
  };
  if (pay.status !== 'available') {
    const matched = /^[0-9]{4}$/u.test(String(item?.soc2020?.code ?? ''));
    els['pay-value'].textContent = matched ? 'Not published' : 'No salary match';
    els['pay-note'].textContent = matched ? `East Midlands: ${pay.regional.reason} UK: ${pay.uk.status === 'available' ? 'A matching edition is unavailable.' : pay.uk.reason}` : pay.reason;
    sourceLink(paySnapshot, 'ONS East Midlands source');
    if (paySnapshot && ukPaySnapshot) add(els['pay-source'], 'span', ' · ');
    sourceLink(ukPaySnapshot, 'ONS UK source');
    els['pay-context'].textContent = 'Missing or withheld salaries are not zero. Salaries are matched only by the exact SOC 2020 occupation group supplied by Skills England.';
    return;
  }
  els['pay-heading'].textContent = pay.isNationalFallback ? 'UK pay reference' : 'East Midlands pay';
  els['pay-value'].textContent = new Intl.NumberFormat('en-GB', { style:'currency', currency:'GBP', maximumFractionDigits:0 }).format(record.value);
  const edition = value(meta.edition ?? meta.year), geography = value(meta.geography?.name ?? meta.geography), measure = value(meta.measure?.label ?? meta.measure ?? meta.unit);
  els['pay-summary'].textContent = `${geography} · ${edition} · ${value(record.occupationTitle)}`;
  els['pay-note'].textContent = pay.isNationalFallback ? `East Midlands: ${pay.regional.reason} Showing the published UK median.` : 'Published median for this occupation group. Individual and starting salaries vary.';
  if (record.qualityFlag === 'cv-unavailable' || record.coefficientOfVariation > 10) els['pay-quality'].textContent = record.qualityNote;
  sourceLink(meta, 'ONS salary source');
  els['pay-context'].textContent = `${measure} for ${geography}; ${edition}. Full-time employee jobs on adult rates, in the same job for more than a year; tax year ended 5 April ${meta.year}. Excludes self-employment. This is not advertised or starting pay. ${record.qualityNote} Source retrieved ${dateLabel(meta.retrievedAt)}. UK figures are used only when an East Midlands median is unavailable for the same occupation group.`;
}
function renderMetadata(item) {
  const host = els['occupation-content']; host.replaceChildren(); add(host, 'p', value(item.overview));
  const dl = document.createElement('dl');
  [['Provider status',statusName(item)],['Level',item.level],['Route',item.routeName],['Typical job titles',list(item.typicalJobTitles).join(', ')],['SOC 2020',item.soc2020 && `${value(item.soc2020.code)} — ${value(item.soc2020.description)}`]].forEach(([label,content]) => { add(dl,'dt',label); add(dl,'dd',value(content)); }); host.append(dl);
  add(host, 'h3', 'Apprenticeship and technical products'); const products = list(item.products);
  if (!products.length) add(host, 'p', 'Unavailable'); else { const ul = document.createElement('ul'); products.forEach(product => add(ul,'li',`${value(product.title ?? product.name)} — ${value(product.type)}; level ${value(product.level)}; status ${value(product.statusName ?? product.status)}`)); host.append(ul); }
  const href = safeHttps(item.sourceUrl); if (href) { const link = add(host,'a','Official occupation source'); link.href = href; }
}
function renderSelected(focus = false) {
  const item = occupationById(selectedId); if (!item) return; const pathway = pathwayFor(snapshot, selectedId);
  els['occupation-detail'].hidden = false; els['occupation-title'].textContent = value(item.title);
  disposeGraph(); disposeGraph = renderPathway(els['pathway-host'], pathway, { view, onSelect:id => showOccupation(id,{ push:true,focus:true }), onViewChange:setView });
  els['progression-coverage'].textContent = coverageText(pathway);
  els['graph-view'].setAttribute('aria-pressed', String(view === 'graph')); els['list-view'].setAttribute('aria-pressed', String(view === 'list'));
  const jobs = new URL('https://www.reed.co.uk/jobs'); jobs.search = new URLSearchParams({ keywords:value(item.title), location:'Lincoln', proximity:'20' }); els['jobs-link'].href = jobs.href;
  els['jobs-context'].textContent = `A live jobs feed is not connected. Search externally for “${value(item.title)}” near Lincoln within 20 miles.`;
  renderPay(item); selectDemandOccupation(item); renderMetadata(item); renderResults(); referenceStatus(); if (focus) els['occupation-title'].focus();
}
function showOccupation(id, options = {}) {
  const item = occupationById(id); const selectionError = document.getElementById('selection-error');
  if (!item) { selectionError.hidden=false; selectionError.textContent=`Occupation ${value(id)} is unavailable in this packaged reference. Search and select an occupation to continue.`; els['occupation-detail'].hidden=true; return; }
  selectionError.hidden=true;
  selectedId = String(item.id); if (options.trigger) selectedCard = options.trigger;
  if (options.push) history.pushState({ occupation:selectedId }, '', `#occupation=${encodeURIComponent(selectedId)}`); renderSelected(options.focus);
}
function setView(next) { view = next === 'list' ? 'list' : 'graph'; if (selectedId) renderSelected(false); els[`${view}-view`].focus(); }
function backToResults() {
  const target = selectedCard?.isConnected ? selectedCard : els['occupation-search']; target.focus();
}
function hashId() { return new URLSearchParams(location.hash.slice(1)).get('occupation'); }
async function fetchJson(url) { const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000); try { const response = await fetch(url, { signal:controller.signal, cache:'no-cache' }); if (!response.ok) throw new Error('request failed'); return await response.json(); } finally { clearTimeout(timer); } }
export async function loadExplorer() {
  els['reference-error'].hidden = true; els['reference-status'].textContent = snapshot ? 'Refreshing packaged reference…' : 'Loading reference…';
  try {
    const data = await fetchJson(REFERENCE_URL); if (!data || !Array.isArray(data.occupations) || !data.occupations.length) throw new Error('invalid reference'); snapshot = data;
    populateRoutes(); els['route-filter'].disabled = false; els['occupation-search'].disabled = false;
    const explicit = hashId(); if (!explicit && occupationById('OCC0116')) els['occupation-search'].value = 'software developer';
    renderResults(); if (explicit) showOccupation(explicit); else {
      showOccupation(occupationById('OCC0116') ? 'OCC0116' : snapshot.occupations[0].id);
      history.replaceState({ occupation:selectedId }, '', `#occupation=${encodeURIComponent(selectedId)}`);
    }
    const request = ++payRequest; payLoading = true; renderPay(occupationById(selectedId));
    Promise.allSettled([fetchJson(PAY_URL), fetchJson(UK_PAY_URL)]).then(([regional, uk]) => {
      if (request !== payRequest) return;
      paySnapshot = regional.status === 'fulfilled' ? regional.value : null;
      ukPaySnapshot = uk.status === 'fulfilled' ? uk.value : null;
      payLoading = false; if (selectedId) renderPay(occupationById(selectedId));
    });
  } catch { els['reference-error'].hidden = false; if (snapshot) { renderResults(); renderSelected(); referenceStatus(' · refresh failed; continuing with previously loaded data'); } else { els['reference-status'].textContent = 'Reference unavailable.'; els['result-count'].textContent = 'Occupations cannot be shown until the reference loads.'; } }
}
els['occupation-search'].addEventListener('input', () => { page = 0; renderResults(); }); els['route-filter'].addEventListener('change', () => { page = 0; renderResults(); });
els['previous-page'].addEventListener('click', () => { page--; renderResults(); els['result-count'].focus(); }); els['next-page'].addEventListener('click', () => { page++; renderResults(); els['result-count'].focus(); });
els['retry-reference'].addEventListener('click', loadExplorer); els['back-to-results'].addEventListener('click', backToResults); els['graph-view'].addEventListener('click', () => setView('graph')); els['list-view'].addEventListener('click', () => setView('list'));
window.addEventListener('popstate', () => { const id = hashId(); if (id) showOccupation(id); else if (snapshot) showOccupation(occupationById('OCC0116') ? 'OCC0116' : snapshot.occupations[0].id); }); window.addEventListener('online', () => referenceStatus()); window.addEventListener('offline', () => referenceStatus());
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { scope:'./' }).catch(() => {});
loadExplorer();
