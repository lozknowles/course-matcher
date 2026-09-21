import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [suite, html, css, js, deploy] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../student-portal.html', import.meta.url), 'utf8'),
  readFile(new URL('../student-portal.css', import.meta.url), 'utf8'),
  readFile(new URL('../student-portal.js', import.meta.url), 'utf8'),
  readFile(new URL('../scripts/deploy-production.sh', import.meta.url), 'utf8')
]);

test('Demo 8 is linked from the eight-demo Lincoln suite', () => {
  assert.match(suite, /Eight student-success journeys/);
  assert.match(suite, /href="student-portal\.html"/);
  assert.match(suite, /Student Portal &amp; Enrolment Workspace/);
});

test('Demo 8 keeps DfE sharing and photo OCR within truthful prototype boundaries', () => {
  assert.match(html, /Illustrative only:/);
  assert.match(html, /Open the live DfE service/);
  assert.match(html, /capture="environment"/);
  assert.match(html, /I have checked every grade against the source document/);
  assert.match(js, /parseResultsText/);
  assert.match(js, /vendor\/tesseract\/tesseract\.min\.js/);
  assert.match(js, /createWorker\('eng'/);
  assert.match(js, /state\.evidenceSource = 'DfE Education Record'/);
  assert.match(css, /@media\(max-width:760px\)/);
});

test('production deployment includes and verifies Demo 8', () => {
  for (const name of ['student-portal.html', 'student-portal.css', 'student-portal.js']) {
    assert.match(deploy, new RegExp(name.replace('.', '\\.')));
  }
  assert.match(deploy, /Eight student-success journeys/);
});
