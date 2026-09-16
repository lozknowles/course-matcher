import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathwayFor,payForOccupation,bestPayForOccupation} from '../student-hub/pathway-core.js';
import {demandForOccupation,periodLabel} from '../student-hub/demand-core.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../student-hub/${name}.json`,import.meta.url)));
const reference=read('skills-england-reference'),pay=read('ons-pay-reference'),ukPay=read('ons-uk-pay-reference'),demand=read('ons-demand-reference');
const developer=reference.occupations.find(item=>item.id==='OCC0116');
test('pathways preserve native edge direction and partial coverage',()=>{
  const path=pathwayFor(reference,'OCC0116');assert.ok(path.selected);assert.ok(path.earlier.length);assert.ok(path.next.length);assert.equal(path.coverage.partial,true);
  for(const item of path.earlier)assert.ok(reference.edges.some(edge=>edge.from===item.id&&edge.to==='OCC0116'));
  for(const item of path.next)assert.ok(reference.edges.some(edge=>edge.from==='OCC0116'&&edge.to===item.id));
  assert.equal(pathwayFor(reference,'OCC1047').coverage.state,'unfetched');assert.equal(pathwayFor(reference,'unknown').selected,null);
});
test('regional pay uses exact SOC2020 and preserves suppression and unreliable data',()=>{
  assert.equal(payForOccupation(pay,developer).record.value,49685);
  assert.equal(payForOccupation(pay,{soc2020:{code:'1111'}}).status,'suppressed');
  assert.equal(payForOccupation(pay,{soc2010:{code:'2134'}}).status,'unavailable');
  const altered=structuredClone(pay),record=altered.records.find(row=>row.soc2020==='2134');record.coefficientOfVariation=21;
  assert.equal(payForOccupation(altered,developer).status,'unavailable');
});
test('ONS demand shows published regional values and suppressed local periods without substitution',()=>{
  const regional=demandForOccupation(demand,developer,'E12000004');assert.equal(regional.latest.period,'2026-07');assert.equal(regional.latest.value,388);
  const lincoln=demandForOccupation(demand,developer,'E07000138');assert.equal(lincoln.status,'suppressed');assert.equal(lincoln.latest.value,null);assert.equal(lincoln.record.observations[1].value,20);
  assert.equal(demandForOccupation(demand,{soc2020:{code:'1256'}},'E07000138').status,'unavailable');
  assert.equal(demandForOccupation(demand,{soc2010:{code:'2134'}}).status,'unavailable');
  const altered=structuredClone(demand);altered.records.push(altered.records.find(row=>row.soc2020==='2134'&&row.geography==='E12000004'));
  assert.equal(demandForOccupation(altered,developer).status,'unavailable');
});

test('published medians survive a missing CV, with explicit quality provenance',()=>{
  const physio={soc2020:{code:'2221'}},result=payForOccupation(pay,physio);
  assert.equal(result.status,'available');assert.equal(result.record.value,49292);
  assert.equal(result.record.coefficientOfVariation,null);assert.equal(result.record.qualityMarker,'.');
  assert.equal(result.record.qualityFlag,'cv-unavailable');
  const altered=structuredClone(pay),record=altered.records.find(row=>row.soc2020==='2221');
  record.qualityMarker=null;assert.equal(payForOccupation(altered,physio).status,'unavailable');
  record.qualityMarker='.';record.coefficientOfVariation=21;
  assert.equal(payForOccupation(altered,physio).status,'unavailable');
});

test('UK fallback retains the exact occupation, edition and geographic label',()=>{
  const engineer={soc2020:{code:'2122'}},result=bestPayForOccupation(pay,ukPay,engineer);
  assert.equal(result.record.value,51110);assert.equal(result.isNationalFallback,true);
  assert.equal(result.meta.geography.code,'K02000001');assert.equal(result.regional.status,'suppressed');
  assert.equal(bestPayForOccupation(pay,ukPay,developer).record.value,49685);
  assert.equal(bestPayForOccupation(pay,ukPay,developer).isNationalFallback,false);
  assert.equal(bestPayForOccupation(pay,ukPay,{soc2020:{code:'2221'}}).record.value,49292);
  assert.equal(payForOccupation(ukPay,engineer).status,'unavailable');
  const wrongYear=structuredClone(ukPay);wrongYear.year=2024;
  assert.notEqual(bestPayForOccupation(pay,wrongYear,engineer).status,'available');
  const wrongRegion=structuredClone(ukPay);wrongRegion.geography.code='E12000007';
  assert.notEqual(bestPayForOccupation(pay,wrongRegion,engineer).status,'available');
});

test('fallback preserves suppressed, absent, ambiguous and missing-code states',()=>{
  assert.notEqual(bestPayForOccupation(pay,ukPay,{soc2020:{code:'1112'}}).status,'available');
  assert.equal(bestPayForOccupation(pay,ukPay,{soc2020:null}).record,null);
  assert.equal(bestPayForOccupation(pay,ukPay,{soc2020:{code:'9999'}}).record,null);
  const duplicate=structuredClone(ukPay);duplicate.records.push(duplicate.records.find(row=>row.soc2020==='2122'));
  assert.notEqual(bestPayForOccupation(pay,duplicate,{soc2020:{code:'2122'}}).status,'available');
  assert.equal(bestPayForOccupation(null,ukPay,{soc2020:{code:'2122'}}).record.value,51110);
  assert.equal(bestPayForOccupation(pay,null,developer).record.value,49685);
  // The December 2025 ONS correction withholds UK police earnings, while East Midlands remains published.
  assert.equal(payForOccupation(ukPay,{soc2020:{code:'3312'}},'K02000001').status,'suppressed');
  assert.equal(bestPayForOccupation(pay,ukPay,{soc2020:{code:'3312'}}).record.value,47586);
});
test('zero, malformed values and observation periods remain distinct',()=>{
  const sample=structuredClone(demand),record=sample.records.find(row=>row.soc2020==='2134'&&row.geography==='E12000004');
  record.observations.at(-1).value=0;assert.equal(demandForOccupation(sample,developer).latest.value,0);
  record.observations.at(-1).value='388';assert.equal(demandForOccupation(sample,developer).status,'unavailable');
  assert.equal(periodLabel('2026Q2'),'Apr–Jun 2026');assert.equal(periodLabel('2026-07'),'July 2026');
  assert.equal(periodLabel('2026-99'),'Period unavailable');
});
