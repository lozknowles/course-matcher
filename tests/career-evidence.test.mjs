import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathwayFor,payForOccupation} from '../student-hub/pathway-core.js';
import {demandForOccupation,periodLabel} from '../student-hub/demand-core.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../student-hub/${name}.json`,import.meta.url)));
const reference=read('skills-england-reference'),pay=read('ons-pay-reference'),demand=read('ons-demand-reference');
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
test('zero, malformed values and observation periods remain distinct',()=>{
  const sample=structuredClone(demand),record=sample.records.find(row=>row.soc2020==='2134'&&row.geography==='E12000004');
  record.observations.at(-1).value=0;assert.equal(demandForOccupation(sample,developer).latest.value,0);
  record.observations.at(-1).value='388';assert.equal(demandForOccupation(sample,developer).status,'unavailable');
  assert.equal(periodLabel('2026Q2'),'Apr–Jun 2026');assert.equal(periodLabel('2026-07'),'July 2026');
  assert.equal(periodLabel('2026-99'),'Period unavailable');
});
