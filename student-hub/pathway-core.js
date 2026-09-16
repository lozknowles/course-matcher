function array(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value == null ? '' : String(value);
}

function copy(value) {
  return value == null ? value : structuredClone(value);
}

function occupationsOf(reference) {
  const source = reference?.occupations;
  if (source instanceof Map) return [...source.values()];
  return array(source);
}

function occupationIndex(reference) {
  const index = new Map();
  for (const occupation of occupationsOf(reference)) {
    if (!occupation || typeof occupation !== 'object') continue;
    const id = text(occupation.id);
    if (id && !index.has(id)) index.set(id, occupation);
  }
  return index;
}

function cachedSeeds(reference) {
  const coverage = reference?.progressionCoverage;
  const seeds = coverage instanceof Map || coverage instanceof Set
    ? [...coverage.keys()]
    : array(coverage);
  return new Set(seeds.map(text).filter(Boolean));
}

export function pathwayFor(reference, id) {
  const wanted = text(id);
  const byId = occupationIndex(reference);
  const selected = byId.get(wanted) ?? null;
  const incoming = new Map();
  const outgoing = new Map();
  const edges = new Map();

  if (selected) {
    for (const edge of array(reference?.edges)) {
      if (!edge || typeof edge !== 'object') continue;
      const from = text(edge.from);
      const to = text(edge.to);
      if (!from || !to || !byId.has(from) || !byId.has(to)) continue;
      if (from !== wanted && to !== wanted) continue;
      const key = `${from}\u0000${to}`;
      if (!edges.has(key)) edges.set(key, edge);
      if (to === wanted && !incoming.has(from)) incoming.set(from, byId.get(from));
      if (from === wanted && !outgoing.has(to)) outgoing.set(to, byId.get(to));
    }
  }

  const seed = selected !== null && cachedSeeds(reference).has(wanted);
  const state = seed ? (incoming.size || outgoing.size ? 'cached-links' : 'cached-empty') : 'unfetched';
  return {
    selected: copy(selected),
    earlier: [...incoming.values()].map(copy),
    next: [...outgoing.values()].map(copy),
    edges: [...edges.values()].map(copy),
    coverage: { state, seed, partial: true },
    counts: { earlier: incoming.size, next: outgoing.size }
  };
}

function payMeta(pay) {
  const source = pay && typeof pay === 'object' ? pay : {};
  const nested = source.meta && typeof source.meta === 'object' ? source.meta : {};
  const value = key => copy(nested[key] ?? source[key] ?? null);
  return {
    schemaVersion: value('schemaVersion'),
    provider: value('provider'),
    dataset: value('dataset'),
    source: value('source'),
    sourceUrl: value('sourceUrl'),
    retrievedAt: value('retrievedAt'),
    year: value('year'),
    edition: value('edition'),
    classification: value('classification'),
    geography: value('geography'),
    measure: value('measure'),
    unit: value('unit'),
    group: value('group'),
    quality: value('quality'),
    licence: value('licence')
  };
}

function metadataIsValid(meta, geographyCode) {
  const classification = typeof meta.classification === 'object' ? meta.classification?.id ?? meta.classification?.code : meta.classification;
  const suppliedUnit = meta.unit ?? meta.measure?.unit;
  const unit = typeof suppliedUnit === 'object' ? suppliedUnit?.id ?? suppliedUnit?.code : suppliedUnit;
  return Number(meta.schemaVersion) === 1
    && classification === 'SOC2020'
    && ['E12000004', 'K02000001'].includes(geographyCode)
    && meta.geography?.code === geographyCode
    && meta.measure?.id === 'median-gross-annual-full-time'
    && unit === 'GBP/year'
    && Number.isInteger(meta.year);
}

export function payForOccupation(pay, occupation, geographyCode = 'E12000004') {
  const meta = payMeta(pay);
  const rawCode = occupation?.soc2020?.code;
  const code = typeof rawCode === 'string' || typeof rawCode === 'number' ? String(rawCode) : '';
  if (!/^[0-9]{4}$/u.test(code))
    return { status: 'unavailable', record: null, meta, reason: 'Skills England has not supplied a valid four-digit SOC 2020 code for this occupation.' };
  if (!metadataIsValid(meta, geographyCode))
    return { status: 'unavailable', record: null, meta, reason: 'The pay reference could not be loaded or has incompatible metadata.' };

  const matches = array(pay?.records).filter(record =>
    record && typeof record === 'object' && typeof record.soc2020 === 'string'
      && /^[0-9]{4}$/u.test(record.soc2020) && record.soc2020 === code
  );
  if (matches.length !== 1)
    return { status: 'unavailable', record: null, meta, reason: matches.length ? 'The matching pay record is ambiguous.' : 'No matching pay record is available.' };

  const matched = matches[0];
  const record = copy(matched);
  if (text(matched.status).toLowerCase() === 'suppressed') {
    record.value = null;
    return { status: 'suppressed', record, meta, reason: 'ONS has withheld this median for reliability or disclosure reasons.' };
  }
  const cv = matched.cv ?? matched.coefficientOfVariation;
  if (text(matched.status).toLowerCase() === 'available'
      && Number.isFinite(matched.value) && matched.value >= 0
      && ((Number.isFinite(cv) && cv >= 0 && cv <= 20)
        || (cv == null && matched.qualityFlag === 'cv-unavailable' && matched.qualityMarker === '.')))
    return { status: 'available', record, meta, reason: 'A matching published pay record is available.' };

  return { status: 'unavailable', record: null, meta, reason: 'No usable published median is available for this occupation group.' };
}

export function bestPayForOccupation(regionalPay, ukPay, occupation) {
  const regional = payForOccupation(regionalPay, occupation);
  const uk = payForOccupation(ukPay, occupation, 'K02000001');
  // Do not mix different ASHE editions when both references have loaded.
  const sameEdition = !regionalPay || (regional.meta.year === uk.meta.year && regional.meta.edition === uk.meta.edition);
  if (regional.status === 'available') return { ...regional, regional, uk, isNationalFallback: false };
  if (uk.status === 'available' && sameEdition) return { ...uk, regional, uk, isNationalFallback: true };
  return { ...regional, regional, uk, isNationalFallback: false };
}
