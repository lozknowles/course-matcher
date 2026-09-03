import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { COURSES, SUBJECT_LINKS } from '../courses.js';

const OFFICIAL_HOST = 'www.lincolncollege.ac.uk';
const TIMEOUT_MS = 20_000;
const execFileAsync = promisify(execFile);
const curl = process.platform === 'win32' ? 'curl.exe' : 'curl';
const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';

const html = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');
const htmlUrls = [...html.matchAll(/href="(https:\/\/www\.lincolncollege\.ac\.uk\/[^"#]*)"/g)].map(match => match[1]);
const urls = [...new Set([
  ...htmlUrls,
  ...COURSES.map(course => course.url),
  ...Object.values(SUBJECT_LINKS)
].filter(url => {
  try { return new URL(url).host === OFFICIAL_HOST; } catch { return false; }
}))].sort();

async function check(url) {
  try {
    // The public site rejects Node's HTTP fingerprint at its edge, so use the
    // same curl transport already required by the deployment verification.
    const { stdout } = await execFileAsync(curl, [
      '-L', '-sS', '--max-time', String(TIMEOUT_MS / 1000),
      '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36',
      '-o', nullDevice, '-w', '%{http_code}\t%{url_effective}', url
    ], { timeout: TIMEOUT_MS + 2_000 });
    const [statusText, finalUrl = ''] = stdout.trim().split('\t');
    const status = Number(statusText);
    return { url, status, finalUrl, ok: status >= 200 && status < 400 };
  } catch (error) {
    return { url, status: 0, finalUrl: '', ok: false, error: error.message };
  }
}

const results = [];
for (let index = 0; index < urls.length; index += 6) {
  results.push(...await Promise.all(urls.slice(index, index + 6).map(check)));
}

for (const result of results) {
  const redirect = result.finalUrl && result.finalUrl !== result.url ? ` -> ${result.finalUrl}` : '';
  console.log(`${result.ok ? 'OK' : 'FAIL'} ${result.status} ${result.url}${redirect}${result.error ? ` (${result.error})` : ''}`);
}

const failures = results.filter(result => !result.ok);
console.log(`Checked ${results.length} official Lincoln College links; ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
