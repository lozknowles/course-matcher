const PUBLIC_HOST = 'occupational-maps.skillsengland.education.gov.uk';

function text(value) {
  return value == null ? '' : String(value).trim();
}

function nullable(value) {
  const valueText = text(value);
  return valueText || null;
}

function publicUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && url.hostname === PUBLIC_HOST ? url.href : null;
  } catch {
    return null;
  }
}

function licenceUrl(value) {
  const canonical = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';
  try {
    return new URL(String(value)).href === canonical ? canonical : null;
  } catch {
    return null;
  }
}

function relatedUrl(links, rel) {
  const link = array(links).find(item => text(item?.rel) === rel);
  return link ? publicUrl(link.href) : undefined;
}

function validDate(value) {
  const input = text(value);
  const date = new Date(input);
  return input && /[Tt]/u.test(input) && !Number.isNaN(date.getTime()) ? input : null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function routeId(route) {
  return text(route?.id ?? route?.routeId ?? route?.routeCode);
}

function routeName(route) {
  return text(route?.name ?? route?.routeName);
}

function occupationCode(raw) {
  return text(raw?.stdCode ?? raw?.standardCode);
}

function occupationRoute(raw, fallback) {
  const hierarchy = raw?.mapHierarchy ?? raw?.maphierarchy ?? raw?.mapHierarchyData;
  return {
    id: text(raw?.routeId ?? hierarchy?.routeId ?? hierarchy?.route?.id ?? fallback?.id),
    name: text(raw?.routeName ?? hierarchy?.routeName ?? hierarchy?.route?.name ?? fallback?.name)
  };
}

function soc2020(raw) {
  const nestedCode = text(raw?.soc?.soc2020Code);
  if (nestedCode) return { code: nestedCode, description: text(raw?.soc?.soc2020Description) };

  const supplied = raw?.soc2020 ?? raw?.soc?.soc2020;
  const candidates = Array.isArray(supplied) ? supplied : [supplied];
  for (const soc of candidates) {
    if (!soc || typeof soc !== 'object') continue;
    const classification = text(soc.version ?? soc.socVersion ?? soc.type ?? soc.classification);
    const code = text(soc.code ?? soc.socCode);
    if (code && (!classification || classification.includes('2020')) && !classification.includes('2010'))
      return { code, description: text(soc.description ?? soc.name ?? soc.socDescription) };
  }
  const code = text(raw?.socCode2020 ?? raw?.soc2020Code);
  return code ? { code, description: text(raw?.socDescription2020 ?? raw?.soc2020Description) } : null;
}

function jobTitles(raw) {
  const values = raw?.typicalJobTitles ?? raw?.typicaljobtitles;
  return [...new Set(array(values).map(item => text(typeof item === 'object' ? item?.name ?? item?.title : item)).filter(Boolean))];
}

function products(raw) {
  return array(raw?.products).map(product => ({
    id: nullable(product?.productCode),
    title: nullable(product?.name),
    level: product?.level ?? null,
    type: nullable(product?.typeName),
    status: nullable(product?.statusName)
  }));
}

function normalOccupation(raw, fallbackRoute) {
  const id = occupationCode(raw);
  if (!id) return null;
  const route = occupationRoute(raw, fallbackRoute);
  return {
    id,
    title: text(raw?.title ?? raw?.name),
    overview: text(raw?.overview),
    level: raw?.level ?? null,
    routeId: route.id,
    routeName: route.name,
    soc2020: soc2020(raw),
    typicalJobTitles: jobTitles(raw),
    products: products(raw),
    sourceUrl: relatedUrl(raw?.links, 'occupationalStandardURL'),
    progressionUrl: relatedUrl(raw?.links, 'occupationalProgressionURL'),
    status: raw?.status ?? null,
    statusName: nullable(raw?.statusName),
    version: raw?.versionNo ?? null,
    statusLastUpdated: nullable(raw?.statusLastUpdated)
  };
}

function nestedOccupations(route) {
  const found = [];
  for (const pathway of array(route?.pathways))
    for (const group of array(pathway?.clusterGroups))
      for (const cluster of array(group?.clusters))
        for (const occupation of array(cluster?.occupations)) found.push(occupation);
  return found;
}

function mergeOccupation(existing, incoming) {
  if (!existing) return incoming;
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    const empty = value == null || value === '' || (Array.isArray(value) && value.length === 0);
    const currentEmpty = merged[key] == null || merged[key] === '' || (Array.isArray(merged[key]) && merged[key].length === 0);
    if (!empty && currentEmpty) merged[key] = value;
  }
  return merged;
}

export function normalizeReference(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.schemaVersion !== 1 || raw.provider !== 'Skills England')
    throw new Error('Invalid Skills England reference');
  const retrievedAt = validDate(raw.retrievedAt);
  if (!retrievedAt || !raw.licence || !text(raw.licence.name) || !raw.attribution || !text(raw.attribution.text))
    throw new Error('Incomplete Skills England metadata');
  const logoFile = text(raw.attribution.logoFile);
  if (!logoFile || logoFile !== logoFile.split(/[\/]/u).pop() || logoFile === '.' || logoFile === '..')
    throw new Error('Invalid Skills England attribution');

  const routes = array(raw.routes).map(route => ({
    id: routeId(route),
    name: routeName(route),
    sourceUrl: relatedUrl(route?.links, 'mapURL')
  })).filter(route => route.id);
  const routeById = new Map(routes.map(route => [route.id, route]));
  const occupations = new Map();
  const add = (item, fallback) => {
    const normalized = normalOccupation(item, fallback);
    if (normalized) occupations.set(normalized.id, mergeOccupation(occupations.get(normalized.id), normalized));
  };
  for (const route of array(raw.routes)) {
    const fallback = { id: routeId(route), name: routeName(route) };
    for (const occupation of nestedOccupations(route)) add(occupation, fallback);
  }
  for (const occupation of array(raw.occupations)) add(occupation, routeById.get(text(occupation?.routeId)));

  const coverage = [];
  for (const response of array(raw.progressions)) {
    if (!response || typeof response !== 'object' || !response.data || typeof response.data !== 'object') continue;
    const seed = text(response.stdCode ?? response.data.keyStdCode);
    if (seed) coverage.push(seed);
    for (const occupation of array(response.data.occupations)) add(occupation, routeById.get(text(occupation?.routeId)));
  }
  if (occupations.size === 0) throw new Error('Skills England reference has no occupations');

  const edges = new Map();
  for (const response of array(raw.progressions)) {
    const data = response?.data;
    if (!data || typeof data !== 'object') continue;
    const seed = text(response.stdCode ?? data.keyStdCode);
    const source = publicUrl(response.sourceUrl ?? data.sourceUrl) || occupations.get(seed)?.progressionUrl || (seed ? `https://${PUBLIC_HOST}/maps/progression-map/${encodeURIComponent(seed)}` : null);
    for (const edge of array(data.progressions)) {
      const from = text(edge?.stdCodeFrom);
      const to = text(edge?.stdCodeTo);
      if (from && to && occupations.has(from) && occupations.has(to))
        edges.set(`${from}\u0000${to}`, { from, to, type: 'progression', sourceUrl: source });
    }
  }

  return {
    schemaVersion: 1,
    provider: 'Skills England',
    retrievedAt,
    datasetVersion: raw.datasetVersion ?? null,
    licence: { name: text(raw.licence.name), url: licenceUrl(raw.licence.url) },
    attribution: {
      text: text(raw.attribution.text),
      sourceUrl: publicUrl(raw.attribution.sourceUrl),
      logoFile,
      logoSourceUrl: publicUrl(raw.attribution.logoSourceUrl)
    },
    sources: array(raw.sources).map(source => ({ endpoint: text(source?.endpoint), retrievedAt: validDate(source?.retrievedAt), status: source?.status ?? null })),
    routes,
    occupations: [...occupations.values()],
    edges: [...edges.values()],
    progressionCoverage: [...new Set(coverage)]
  };
}

export function referenceAge(snapshot, nowISO) {
  const retrieved = new Date(snapshot?.retrievedAt);
  const now = new Date(nowISO);
  if (!validDate(snapshot?.retrievedAt) || !validDate(nowISO) || Number.isNaN(retrieved.getTime()) || Number.isNaN(now.getTime()))
    throw new Error('Invalid reference date');
  const ageDays = Math.max(0, Math.floor((now.getTime() - retrieved.getTime()) / 86400000));
  return { ageDays, stale: ageDays > 30 };
}

export function findOccupations(snapshot, { query = '', routeId = '', limit = 40 } = {}) {
  const needle = text(query).toLocaleLowerCase();
  const route = text(routeId);
  const numericLimit = Number(limit);
  const boundedLimit = Math.min(100, Math.max(1, Number.isFinite(numericLimit) ? Math.trunc(numericLimit) : 40));
  return array(snapshot?.occupations)
    .filter(item => (!route || text(item?.routeId) === route) && (!needle || [item?.title, item?.overview, ...array(item?.typicalJobTitles)].some(value => text(value).toLocaleLowerCase().includes(needle))))
    .sort((a, b) => text(a?.title).localeCompare(text(b?.title), 'en', { sensitivity: 'base' }) || text(a?.id).localeCompare(text(b?.id), 'en'))
    .slice(0, boundedLimit)
    .map(item => structuredClone(item));
}
