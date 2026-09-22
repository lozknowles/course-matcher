import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { AVAILABILITY_ROWS, courseCapacity, capacityStatus } from '../availability-data.js';
import { LEVEL_GUIDE, levelGuideFor } from '../level-guide-data.js';

const [html, app, css, matcher] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../app.js', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../matcher-core.js', import.meta.url), 'utf8')
]);

test('page-one capacity snapshot preserves age-specific operational evidence', () => {
  assert.ok(AVAILABILITY_ROWS.length >= 30);
  const sport = courseCapacity('sport-active-l2', '16-18');
  assert.equal(sport.mapped, true);
  assert.equal(sport.code, 'available');
  assert.equal(sport.places, 11);
  assert.equal(courseCapacity('sport-active-l2', '19+').code, 'check');
  const health = courseCapacity('skills-health-care', '16-18');
  assert.equal(health.places, 1);
  const removed = AVAILABILITY_ROWS.find(row => row.courseCode === 'SPL0309AA2');
  assert.equal(capacityStatus(removed, '16-18').code, 'removed');
});

test('capacity remains separate from eligibility logic', () => {
  assert.doesNotMatch(matcher, /availability-data|courseCapacity|AVAILABILITY/);
  assert.match(app, /Capacity snapshot coverage/);
  assert.match(html, /Capacity is kept separate from eligibility/);
});

test('student level guide reconstructs the supplied artwork without inventing cropped Level 3 items', () => {
  assert.deepEqual(LEVEL_GUIDE.map(item => item.level), [0,1,2,3,4,5,6]);
  assert.ok(levelGuideFor(2).examples.includes('GCSEs'));
  assert.ok(levelGuideFor(4).examples.includes('Higher National Certificate'));
  assert.ok(levelGuideFor(5).examples.includes('Foundation Degree'));
  assert.ok(levelGuideFor(6).examples.includes('Degree Apprenticeship'));
  assert.deepEqual(levelGuideFor(3).examples, ['Advanced Apprenticeship','A Levels','T Levels']);
  assert.match(levelGuideFor(3).note, /crops/);
  assert.match(html, /id="level-ladder"/);
  assert.match(app, /data-level-help/);
  assert.match(css, /\.level-step:nth-child\(7\)/);
});
