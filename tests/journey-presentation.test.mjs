import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stageExample } from '../journey-core.js';
import { renderStage } from '../journey-views.js';
import { LEVEL_GUIDE } from '../level-guide-data.js';

test('yellow/red presentation preserves all ten stages and every verified level example', () => {
  for (let step = 1; step <= 10; step++) {
    const html = renderStage(stageExample(step));
    assert.match(html, /class="stage-header"/);
    assert.match(html, new RegExp(`Step ${step} of 10`));
  }
  const discover = renderStage(stageExample(1));
  assert.equal((discover.match(/class="art-level-card /g) || []).length, 7);
  for (const level of LEVEL_GUIDE) for (const example of level.examples) assert.ok(discover.includes(example));
  assert.doesNotMatch(discover, /art-scribble|art-arrow|supplied photograph/);
});

test('yellow/red design tokens and independent frame cannot revert to the teal poster theme', () => {
  const css = fs.readFileSync(new URL('../digital-student-journey.css', import.meta.url), 'utf8');
  assert.match(css, /--yellow:#ffdb45;--red:#ba2833/);
  assert.match(css, /\.stage-header:before\{[^}]*inset:-6px -7px -6px 7px;[^}]*border:2px solid var\(--red\)/);
  assert.match(css, /\.art-level-card\{[^}]*background:var\(--yellow\);border:2px solid var\(--red\)/);
  assert.doesNotMatch(css, /--art-teal|--art-cream|art-scribble|clip-path:polygon/);
});
