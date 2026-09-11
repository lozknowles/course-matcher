import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeReference } from '../student-hub/career-core.js';

const API_ORIGIN = 'https://occupational-maps-api.skillsengland.education.gov.uk';
const PUBLIC_ORIGIN = 'https://occupational-maps.skillsengland.education.gov.uk';
const ROUTE_EXPAND = 'occupation.overview,occupation.soc,occupation.maphierarchy,occupation.typicaljobtitles,occupation.products,occupation.links';
const TIMEOUT_MS = 15000;

function endpointError(category, status) {
  return new Error(`Skills England ${category} request failed${status ? ` (${status})` : ''}`);
}

async function request(fetchImpl, path, key, category) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetchImpl(`${API_ORIGIN}${path}`, {
        headers: { 'X-API-KEY': key },
        redirect: 'error',
        signal: controller.signal
      });
    } catch {
      throw endpointError(category);
    }
    if (!response || !response.ok) throw endpointError(category, response?.status);
    try {
      return await response.json();
    } catch {
      throw endpointError(category, 'invalid response');
    }
  } finally {
    clearTimeout(timer);
  }
}

function idOf(route) {
  return String(route?.id ?? route?.routeId ?? route?.routeCode ?? '').trim();
}

async function liveEnvelope({ keyFile, fetchImpl, now, seedCodes }) {
  if (typeof fetchImpl !== 'function') throw new Error('Skills England fetch is unavailable');
  const resolvedKeyFile = keyFile || process.env.SKILLS_ENGLAND_API_KEY_FILE;
  if (!resolvedKeyFile) throw new Error('Skills England key file is required');
  let key;
  try {
    key = (await readFile(resolvedKeyFile, 'utf8')).trim();
  } catch {
    throw new Error('Unable to read Skills England key file');
  }
  if (!key) throw new Error('Skills England key is empty');

  const routeList = await request(fetchImpl, '/api/v1/Routes?expand=route.links', key, 'route list');
  if (!Array.isArray(routeList)) throw endpointError('route list', 'invalid response');
  const routes = [];
  for (const summary of routeList) {
    const id = idOf(summary);
    if (!id) throw endpointError('route', 'invalid response');
    routes.push(await request(fetchImpl, `/api/v1/Routes/${encodeURIComponent(id)}?expand=${ROUTE_EXPAND}`, key, 'route'));
  }

  const requestedSeeds = [...new Set((Array.isArray(seedCodes) ? seedCodes : []).map(value => String(value).trim()).filter(Boolean))];
  if (requestedSeeds.length > 32) throw new Error('At most 32 progression seeds are allowed');
  const progressions = [];
  for (const stdCode of requestedSeeds) {
    const data = await request(fetchImpl, `/api/v1/OccupationalProgression/${encodeURIComponent(stdCode)}`, key, 'progression');
    progressions.push({
      stdCode,
      sourceUrl: `${PUBLIC_ORIGIN}/occupational-progression/${encodeURIComponent(stdCode)}`,
      data
    });
  }
  const retrievedAt = now();
  return {
    schemaVersion: 1,
    provider: 'Skills England',
    retrievedAt,
    datasetVersion: null,
    licence: {
      name: 'Open Government Licence v3.0',
      url: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/'
    },
    attribution: {
      text: '© Skills England 2025',
      sourceUrl: `${PUBLIC_ORIGIN}/api`,
      logoFile: 'skills-england-logo.svg',
      logoSourceUrl: `${PUBLIC_ORIGIN}/media/xmehhrr0/skills-england_lesser_arms_stacked-dfe-blue-se-logo.svg`
    },
    routes,
    progressions,
    sources: [
      { endpoint: 'routes', retrievedAt, status: 200 },
      ...requestedSeeds.map(stdCode => ({ endpoint: `progression:${stdCode}`, retrievedAt, status: 200 }))
    ]
  };
}

async function atomicWrite(outputPath, snapshot) {
  if (!outputPath) throw new Error('Output path is required');
  const temporary = join(dirname(outputPath), `.${basename(outputPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, outputPath);
  } catch (error) {
    try { await unlink(temporary); } catch {}
    throw new Error('Unable to write Skills England snapshot', { cause: error });
  }
}

export async function refreshReference({
  inputPath,
  outputPath,
  keyFile,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  seedCodes = []
} = {}) {
  let raw;
  if (inputPath) {
    try {
      raw = JSON.parse(await readFile(inputPath, 'utf8'));
    } catch {
      throw new Error('Unable to read Skills England input');
    }
  } else {
    raw = await liveEnvelope({ keyFile, fetchImpl, now, seedCodes });
  }
  const snapshot = normalizeReference(raw);
  await atomicWrite(outputPath, snapshot);
  return {
    routes: snapshot.routes.length,
    occupations: snapshot.occupations.length,
    edges: snapshot.edges.length,
    retrievedAt: snapshot.retrievedAt
  };
}

function parseArgs(args) {
  const options = { seedCodes: [] };
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    const value = args[index + 1];
    if (!['--input', '--output', '--key-file', '--seed'].includes(flag) || value == null || value.startsWith('--'))
      throw new Error('Invalid command arguments');
    if (flag === '--seed') options.seedCodes.push(value);
    else if (flag === '--input') options.inputPath = value;
    else if (flag === '--output') options.outputPath = value;
    else options.keyFile = value;
    index += 1;
  }
  return options;
}

async function main() {
  try {
    const summary = await refreshReference(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Skills England refresh failed'}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
