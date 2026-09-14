import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFunding, RULESET } from '../funding-core.js';

const base = {
  age: 35, ehcp: false, residency: 'yes', courseLevel: 'l2', entitlement: 'other',
  employment: 'employed', benefit: 'none', annualGross: 24000, ucClaim: 'single', ucMonthlyEarnings: 0
};

test('17-year-old goes to 16-19 route', () => {
  assert.equal(evaluateFunding({ ...base, age: 17 }).code, 'SIXTEEN_NINETEEN');
});

test('19-23 first full level 3 is full regardless of high earnings', () => {
  const r = evaluateFunding({ ...base, age: 22, courseLevel: 'l3', entitlement: 'first-full-l3', annualGross: 45000 });
  assert.equal(r.code, 'FULL');
});

test('adult level 2 low earnings is full', () => {
  assert.equal(evaluateFunding(base).code, 'FULL');
});

test('adult level 2 above threshold is co-funded', () => {
  const r = evaluateFunding({ ...base, annualGross: RULESET.annualEarningsThreshold + 1 });
  assert.equal(r.code, 'COFUNDED');
});

test('level 3 FCFJ low earnings is full', () => {
  const r = evaluateFunding({ ...base, courseLevel: 'l3', entitlement: 'fcfj-l3' });
  assert.equal(r.code, 'FULL');
});

test('level 3 FCFJ above threshold routes to loan/self-fund', () => {
  const r = evaluateFunding({ ...base, courseLevel: 'l3', entitlement: 'fcfj-l3', annualGross: 40000 });
  assert.equal(r.code, 'LOAN');
});

test('PIP alone does not automatically fund', () => {
  const r = evaluateFunding({ ...base, employment: 'unemployed', benefit: 'pip', annualGross: 0 });
  assert.equal(r.code, 'MANUAL');
});

test('UC under configured AET qualifies as unemployed route', () => {
  const r = evaluateFunding({ ...base, benefit: 'uc', annualGross: 35000, ucClaim: 'single', ucMonthlyEarnings: RULESET.ucAetSingleMonthly - 1 });
  assert.equal(r.code, 'FULL');
});

test('residency not confirmed does not auto-fund', () => {
  const r = evaluateFunding({ ...base, residency: 'no' });
  assert.equal(r.code, 'NOT_ELIGIBLE');
});
