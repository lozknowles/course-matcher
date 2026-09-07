import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, app] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8')
]);

test('student journey uses the record-workspace presentation without losing core controls', () => {
  assert.match(html, /class="mode-panel student-record-app"/);
  assert.match(html, /class="student-record-titlebar"/);
  assert.match(html, /class="student-record-summary"/);
  for (const id of ['result-file', 'camera-file', 'to-verify', 'quick-match', 'guided-match', 'run-match']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(css, /\.student-record-shell\{/);
  assert.match(css, /@media\(max-width:480px\).*\.student-record-summary\{grid-template-columns:1fr\}/s);
  assert.match(app, /new URLSearchParams\(window\.location\.search\)\.get\('mode'\)/);
});
