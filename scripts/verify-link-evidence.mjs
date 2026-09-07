import fs from 'node:fs/promises';
import { COURSES, SUBJECT_LINKS } from '../courses.js';

const [evidencePath, expectedCommit] = process.argv.slice(2);
if (!evidencePath || !expectedCommit) {
  throw new Error('Usage: node scripts/verify-link-evidence.mjs <evidence.json> <expected-commit>');
}

const OFFICIAL_HOST = 'www.lincolncollege.ac.uk';
const MAX_AGE_MS = 30 * 60 * 1000;
const htmlFiles = ['../index.html', '../automated-change-request.html'];
const htmlDocuments = await Promise.all(htmlFiles.map(path => fs.readFile(new URL(path, import.meta.url), 'utf8')));
const htmlUrls = htmlDocuments.flatMap(html => [...html.matchAll(/href="(https:\/\/www\.lincolncollege\.ac\.uk\/[^"#]*)"/g)].map(match => match[1]));
const expectedUrls = [...new Set([
  ...htmlUrls,
  ...COURSES.map(course => course.url),
  ...Object.values(SUBJECT_LINKS)
].filter(url => {
  try { return new URL(url).host === OFFICIAL_HOST; } catch { return false; }
}))].sort();

const evidence = JSON.parse(await fs.readFile(evidencePath, 'utf8'));
const checkedAt = Date.parse(evidence.checkedAt);
const evidenceUrls = Array.isArray(evidence.results) ? evidence.results.map(result => result.url).sort() : [];

if (evidence.schemaVersion !== 1) throw new Error('Unsupported official-link evidence schema');
if (evidence.commit !== expectedCommit) throw new Error('Official-link evidence commit does not match the deployment commit');
if (evidence.officialHost !== OFFICIAL_HOST) throw new Error('Official-link evidence host is invalid');
if (!Number.isFinite(checkedAt) || checkedAt > Date.now() + 60_000 || Date.now() - checkedAt > MAX_AGE_MS) {
  throw new Error('Official-link evidence is invalid or older than 30 minutes');
}
if (JSON.stringify(evidenceUrls) !== JSON.stringify(expectedUrls)) {
  throw new Error('Official-link evidence does not cover the complete current URL set');
}
if (evidence.results.some(result => result.ok !== true || result.status < 200 || result.status >= 400)) {
  throw new Error('Official-link evidence contains a failed URL');
}

console.log(`Verified fresh SHA-bound evidence for ${expectedUrls.length} official Lincoln College links.`);
