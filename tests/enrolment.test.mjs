import test from 'node:test';
import assert from 'node:assert/strict';
import {makeCohort,scopeRecords,summary,capacity,trend,addSample,advanceRecord,recordsCsv} from '../enrolment-core.js';

test('intake and campus filters reconcile metrics, stages and capacity',()=>{
  const records=[...makeCohort(),...makeCohort('2025/26')];
  for(const year of ['2026/27','2025/26']){
    const all=scopeRecords(records,{year}),lincoln=scopeRecords(records,{year,campus:'Lincoln'}),newark=scopeRecords(records,{year,campus:'Newark'});
    assert.equal(all.length,lincoln.length+newark.length);
    const totals=summary(all);assert.equal(totals.applications,totals.stages.reduce((a,b)=>a+b,0));assert.equal(totals.pending+totals.offers,totals.applications);
    assert.equal(capacity(all).reduce((sum,row)=>sum+row.enrolled,0),totals.enrolled);
    assert.equal(trend(all).at(-1).applications,totals.applications);assert.equal(trend(all).at(-1).enrolled,totals.enrolled);
  }
});
test('new sample completes review and enrolment with explicit checked prerequisites',()=>{
  const records=makeCohort(),before=summary(records),result=addSample(records,{programme:'engineering',campus:'Newark'});
  assert.equal(result.records.length,records.length+1);assert.equal(new Set(result.records.map(x=>x.id)).size,result.records.length);
  let record=advanceRecord(result.record);assert.equal(record.stage,1);
  assert.throws(()=>advanceRecord(record),/checklist/);
  record=advanceRecord(record,{checked:true});assert.equal(record.stage,2);
  record=advanceRecord(record,{checked:true});assert.equal(record.stage,3);assert.throws(()=>advanceRecord(record,{checked:true}),/already enrolled/);
  const after=summary(result.records.map(row=>row.id===record.id?record:row));assert.equal(after.enrolled,before.enrolled+1);assert.equal(after.pending,before.pending);
  assert.equal(record.history.length,4);
});
test('filters, empty states and CSV use the displayed sample records',()=>{
  const records=makeCohort();assert.equal(scopeRecords(records,{query:'nonexistent learner'}).length,0);
  assert.equal(scopeRecords(records,{status:'pending'}).length,summary(records).pending);
  assert.equal(scopeRecords(records,{status:'offers'}).length,summary(records).offers);
  const rows=scopeRecords(records,{programme:'digital',campus:'Newark',status:'3'});assert.ok(rows.every(row=>row.programme==='digital'&&row.campus==='Newark'&&row.stage===3));
  assert.equal(recordsCsv(rows).split('\r\n').length,rows.length+2);assert.match(recordsCsv(rows),/SYNTHETIC DEMONSTRATION DATA ONLY/);
  assert.throws(()=>addSample(records,{campus:'Unknown'}),/valid sample/);
});
