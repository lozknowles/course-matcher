import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const page = await fs.readFile(new URL('../automated-change-request.html', import.meta.url), 'utf8');
const home = await fs.readFile(new URL('../index.html', import.meta.url), 'utf8');

test('home exposes the fourth Lincoln-branded journey', () => {
  assert.match(home, /Four student-success journeys/);
  assert.match(home, /href="automated-change-request\.html"/);
  assert.match(home, /<span class="launch-number">04<\/span>/);
});

test('automation covers the five requested synthetic field types', () => {
  for (const field of ['MobileTel', 'HomeTel', 'Email', 'Address1', 'NINumber']) {
    assert.match(page, new RegExp(`field:'${field}'`));
  }
  assert.match(page, /no real student data/);
  assert.doesNotMatch(page, /@(?!example\.test|student\.example\.test)[\w.-]+\.[a-z]{2,}/i);
});

test('visible automation follows the observed UI sequence and reconciles the queue', () => {
  const steps = [
    "moveTo(requestTab",
    "moveTo(stage",
    "clickAt(row,true)",
    "moveTo(changed",
    "moveTo(accept",
    "moveTo(studentField",
    "moveTo(save",
    "requests=requests.slice(1)",
    "render();audit()"
  ];
  let previous = -1;
  for (const step of steps) {
    const position = page.indexOf(step);
    assert.ok(position > previous, `${step} must occur in order`);
    previous = position;
  }
  assert.match(page, /\.recordgrid \.fake\.changed\{color:inherit;font-weight:400\}/);
  assert.match(page, /click-ring/);
  assert.match(page, /agent-cursor/);
});

test('prototype documents the mandatory test-first progression', () => {
  assert.match(page, /ProSolution \(26\.1\) - TEST SYSTEM/);
  assert.match(page, /no live ProSolution connection/);
});
