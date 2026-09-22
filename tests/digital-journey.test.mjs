import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STEPS,STATUS,createJourney,transition,completion,currentStep,journeyStages,phase,assessResults,enrolmentChecklist,enrolmentPayload,serialise,restore,stageExample,advanceDemo,resultRows} from '../journey-core.js';
import {renderStage,technicalMarkup,esc} from '../journey-views.js';
import {validateUpload} from '../journey-capture.js';

test('all ten stages render with matching headings and presenter states',()=>{
  for(const step of STEPS){const state=stageExample(step.id);assert.equal(state.view,step.id);assert.equal(currentStep(state),step.id);assert.ok(renderStage(state).includes(step.title));assert.ok(journeyStages(state).every(s=>STATUS.includes(s.status)));}
});
test('discovery carries qualification and predicted-grade choices into matching',()=>{
  let state=transition(createJourney(),'match',{interest:'Computing',qualification:'GCSE',maths:'3',english:'3'});
  assert.equal(state.predicted[0].grade,'3');assert.equal(state.predicted[1].grade,'3');
  state=transition(state,'match',{qualification:'other'});assert.deepEqual(state.predicted,[]);
  assert.doesNotMatch(renderStage(state),/Predicted grades match example rules/);
});
test('a full journey advances only through validated events, from prospect to student',()=>{
  let state=createJourney();assert.equal(phase(state),'Prospect');
  assert.throws(()=>transition(state,'college-confirmed'));
  assert.throws(()=>transition(state,'submit-application',{confirmed:true}));
  for(let step=1;step<=10;step++){assert.equal(currentStep(state),step);state=advanceDemo(state);if(step===3)assert.equal(phase(state),'Applicant');if(step===4)assert.equal(phase(state),'Offer holder');}
  assert.equal(phase(state),'Student');assert.equal(completion(state).filter(Boolean).length,10);assert.ok(state.activity.every(e=>e.at));assert.equal(enrolmentPayload(state).integrated,false);
});
test('revisit and resume preserve the record; reset removes old progress',()=>{
  let state=stageExample(9);state=transition(state,'navigate',{step:3});const resumed=restore(serialise(state));assert.deepEqual(resumed,state);assert.equal(currentStep(resumed),9);assert.equal(resumed.qualifications.rows.length,5);assert.equal(restore('{broken'),null);assert.equal(restore('{"version":1}'),null);assert.equal(currentStep(createJourney()),1);
});
test('results require explicit confirmation and every edit invalidates completion',()=>{
  let state=stageExample(8);assert.equal(assessResults(state).kind,'pending');
  state=transition(state,'results-draft',{rows:resultRows('standard'),source:'test'});
  assert.throws(()=>transition(state,'results-confirmed',{confirmed:false}));
  state=transition(state,'results-confirmed',{confirmed:true});assert.equal(assessResults(state).kind,'satisfied');
  state=advanceDemo(state);assert.equal(phase(state),'Student');
  state=transition(state,'results-draft',{rows:resultRows('alternatives')});assert.equal(state.qualifications.confirmedAt,null);assert.equal(state.enrolment.completedAt,null);assert.equal(assessResults(state).kind,'pending');
});
test('results mismatch offers exact-rule alternatives without a final rejection',()=>{
  let state=stageExample(8,'alternatives');state=advanceDemo(state);let outcome=assessResults(state);
  assert.equal(outcome.kind,'options');assert.ok(outcome.checks.some(c=>!c.pass));assert.ok(outcome.alternatives.some(r=>r.course.id==='computing-electronics-l2'));
  state=transition(state,'choose-alternative',{id:'computing-electronics-l2'});assert.equal(assessResults(state).kind,'satisfied');assert.equal(state.originalCourseId,'computing-l3');assert.ok(state.careersRequest);assert.equal(state.enrolment.completedAt,null);
});
test('unknown or duplicated GCSEs are rejected; non-GCSE evidence stays with staff review',()=>{
  let state=stageExample(8);state=transition(state,'results-draft',{rows:[...resultRows('standard'),{subject:'Mathematics',grade:'9',qualification:'GCSE'}]});assert.throws(()=>transition(state,'results-confirmed',{confirmed:true}));
  state=transition(state,'results-draft',{rows:[{subject:'Engineering',grade:'Merit',qualification:'Other'}]});state=transition(state,'results-confirmed',{confirmed:true});assert.equal(assessResults(state).kind,'review');
});
test('college confirmation requires every checklist item and rechecks changed details',()=>{
  let state=stageExample(9);assert.throws(()=>transition(state,'ready-for-college'));
  state=transition(state,'check-in');state=transition(state,'enrolment-checks',{identityChecked:true,courseConfirmed:true,contactConfirmed:true,declarations:false});assert.throws(()=>transition(state,'ready-for-college'));
  state=transition(state,'enrolment-checks',{identityChecked:true,courseConfirmed:true,contactConfirmed:true,declarations:true});assert.ok(enrolmentChecklist(state).every(c=>c.done));state=transition(state,'ready-for-college');
  const payload=enrolmentPayload(state);assert.equal(payload.staffVerificationRequired,true);assert.match(payload.destination,/NOT SENT/);
  state=transition(state,'save-details',{email:'changed@example.test'});assert.equal(state.enrolment.readyAt,null);assert.throws(()=>transition(state,'college-confirmed'));
});
test('education sharing and QR concepts do not establish identity or accept arbitrary tokens',()=>{
  let state=stageExample(7);assert.throws(()=>transition(state,'dfe-share'));state=transition(state,'dfe-request');state=transition(state,'dfe-share');assert.equal(state.education.dfe,'shared');assert.equal(state.education.confirmed,false);assert.equal(state.qualifications.confirmedAt,null);
  state=stageExample(9);state=transition(state,'check-in');assert.throws(()=>transition(state,'scan-demo-qr',{token:'https://example.com'}));state=transition(state,'scan-demo-qr',{token:'DEMO-JAMIE-2027'});assert.equal(state.enrolment.identityChecked,false);
});
test('upload limits, empty files and unsupported formats fail clearly',()=>{
  for(const type of ['image/png','image/jpeg','application/pdf','text/plain'])assert.equal(validateUpload({type,size:1024}),true);
  assert.throws(()=>validateUpload({type:'text/html',size:12}));assert.throws(()=>validateUpload({type:'image/png',size:0}));assert.throws(()=>validateUpload({type:'image/png',size:13*1024*1024}));assert.throws(()=>validateUpload({type:'application/pdf',size:20},'photo'));
});
test('source labels, local-only boundaries and escaping survive user-entered content',()=>{
  const state=stageExample(9);state.student.firstName='<img src=x onerror=alert(1)>';
  assert.ok(!renderStage({...state,view:10}).includes('<img src=x'));
  for(const status of ['WORKING','PROTOTYPE','SIMULATED','PROPOSED','REQUIRES VALIDATION'])assert.ok(technicalMarkup(state).includes(status));
  assert.equal(esc('<script>'),'&lt;script&gt;');
  const html=fs.readFileSync(new URL('../digital-student-journey.html',import.meta.url),'utf8');assert.match(html,/id="journey-nav"/);assert.match(html,/Show all 10 steps/);assert.match(html,/role="status"/);
});


test('digital journey uses the reconstructed Lincoln artwork language without exposing source photographs',()=>{
  const html=fs.readFileSync(new URL('../digital-student-journey.html',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../digital-student-journey.css',import.meta.url),'utf8');
  const views=fs.readFileSync(new URL('../journey-views.js',import.meta.url),'utf8');
  assert.match(html,/20260922-yellow-red-menu/);
  assert.match(css,/\.art-levels\{/);
  assert.match(css,/\.art-careers\{/);
  assert.match(views,/LEVELS EXPLAINED/);
  assert.match(views,/DON’T KNOW<br>WHAT TO CHOOSE\?/);
  assert.match(views,/journey-capacity/);
  const imageSources=[...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(imageSources,['./student-hub/logo.jpg']);
  assert.deepEqual([...css.matchAll(/url\(([^)]+)\)/g)].map(m=>m[1].replaceAll("'", "")), ["./journey-assets/fonts/Kalam-Bold.ttf"]);
  assert.doesNotMatch(views,/\.jpg|\.jpeg|\.webp/i);
});
