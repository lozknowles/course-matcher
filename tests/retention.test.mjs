import test from 'node:test';
import assert from 'node:assert/strict';

import {
  alternativesState,
  buildTransferHandoff,
  capacityOptimisationAllowed,
  interventionFor,
  outcomeLabel,
  processPath,
  warmStartAlternatives,
  withdrawalReviewPath
} from '../retention-core.js';

test('classifies every intervention pathway without treating all concerns as transfers', () => {
  const nonTransfer = ['support_need', 'belonging', 'transport', 'careers', 'conduct', 'external_environment'];
  for (const code of nonTransfer) assert.equal(interventionFor(code).transferCapable, false);
  assert.equal(interventionFor('course_mismatch').transferCapable, true);
  assert.equal(interventionFor('known_alternative').transferCapable, true);
});

test('non-transfer concern follows intervention and monitoring path', () => {
  const path = processPath({ concernCode: 'support_need', transferAppropriate: false });
  assert.deepEqual(path.slice(-3), ['Possible intervention', 'Monitor / review', 'Human decision']);
  assert.equal(alternativesState({ concernCode: 'support_need', transferAppropriate: false }).visible, false);
});

test('conduct follows the College procedure and suppresses matching', () => {
  const intervention = interventionFor('conduct');
  assert.match(intervention.action, /Learner Conduct Procedure/);
  assert.equal(alternativesState({ concernCode: 'conduct', transferAppropriate: true }).visible, false);
});

test('unclear direction routes to Careers Guidance', () => {
  assert.equal(interventionFor('careers').owner, 'Careers Guidance');
  assert.match(interventionFor('careers').action, /before considering a destination/);
});

test('internal transfer creates a handoff only after human agreement', () => {
  const record = { id: 'SYN-1088', name: 'Alex Nguyen', outcome: 'internal_transfer', transferAgreed: true };
  const handoff = buildTransferHandoff(record, {
    courseCode: 'SYN-DIG-L3', group: 'DIG-L3-A', startDate: '14 September 2026'
  });
  assert.equal(handoff.state, 'Transfer handoff ready');
  assert.equal(handoff.studentId, 'SYN-1088');
  assert.throws(() => buildTransferHandoff({ ...record, transferAgreed: false }, {}), /human-reviewed/);
});

test('external transition is a legitimate learner outcome', () => {
  assert.match(outcomeLabel('external_transition'), /another provider/);
});

test('potential withdrawal requires Student Recruitment Group review', () => {
  assert.deepEqual(withdrawalReviewPath({ outcome: 'potential_withdrawal' }), [
    'Potential withdrawal', 'Student Recruitment Group review', 'Human decision / outcome'
  ]);
});

test('warm-start alternatives are contingency options, not recommendations', () => {
  const options = warmStartAlternatives([{ title: 'Course A' }, { title: 'Course B' }, { title: 'Course C' }, { title: 'Course D' }]);
  assert.equal(options.length, 3);
  assert.ok(options.every(option => option.recommendation === false && option.state === 'Contingency option'));
});

test('capacity optimisation is last and requires all human suitability gates', () => {
  assert.equal(capacityOptimisationAllowed({ learnerSuitability: true, entryCompliance: true, learnerChoice: true, humanApproval: true }), true);
  assert.equal(capacityOptimisationAllowed({ learnerSuitability: true, entryCompliance: true, learnerChoice: false, humanApproval: true }), false);
});
