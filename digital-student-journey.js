import {STEPS, STORAGE_KEY, createJourney, transition, restore, serialise, currentStep, journeyStages, completion, phase, courseFor, outstandingTasks, resultRows, stageExample, advanceDemo} from './journey-core.js';
import {esc, renderStage, coursesMarkup, outcomeMarkup, technicalMarkup} from './journey-views.js';
import {readResultsFile, validateUpload} from './journey-capture.js';

const $=id=>document.getElementById(id);
let state=createJourney(),captureGeneration=0,previewURL='',photoURL='',qrStream=null,qrTimer=null;
let saved=false;
try {const stored=localStorage.getItem(STORAGE_KEY);if(stored){const resumed=restore(stored);if(resumed){state=resumed;saved=true;}else $('storage-notice').textContent='The saved example could not be read. A fresh demo has been started.';}}catch{$('storage-notice').textContent='Browser storage is unavailable. This journey will last until the page is closed.';}
const groups=[{label:'Discover',from:1,to:2},{label:'Apply',from:3,to:4},{label:'Welcome',from:5,to:7},{label:'Results',from:8,to:8},{label:'Enrol',from:9,to:9},{label:'Start college',from:10,to:10}];
function persist(){try{localStorage.setItem(STORAGE_KEY,serialise(state));}catch{$('storage-notice').textContent='Changes are working in this tab but could not be saved. Keep the tab open or restart with a sample later.';}}
function feedback(message,error=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',error);}
function stopQR(){if(qrTimer)clearTimeout(qrTimer);qrTimer=null;qrStream?.getTracks().forEach(t=>t.stop());qrStream=null;}
function revokePreviews(){for(const url of [previewURL,photoURL])if(url)URL.revokeObjectURL(url);previewURL='';photoURL='';}
function run(type,data={},options={}) {
  try {state=transition(state,type,data);persist();if(options.render!==false)render(options.focus);return true;}
  catch(error){feedback(error.message,true);return false;}
}
function context(){
  const done=completion(state).filter(Boolean).length,tasks=outstandingTasks(state);
  $('greeting').textContent=`HELLO, ${state.student.firstName.toUpperCase()}`;
  $('phase').textContent=phase(state);
  $('position').textContent=done===10?'All 10 steps complete':`You’re on Step ${currentStep(state)} of 10 · ${done} complete`;
  $('context').innerHTML=`<section class="context-card"><div class="profile-mini"><span class="avatar" aria-hidden="true">${esc(state.student.firstName[0])}${esc(state.student.lastName[0])}</span><div><strong>${esc(state.student.firstName)} ${esc(state.student.lastName)}</strong><small>${phase(state)} · fictional record</small></div></div><small>YOUR CHOSEN COURSE</small><p><strong>${esc(courseFor(state).title)}</strong></p><small>${esc(courseFor(state).campus)}</small><div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${done*10}%"></div></div><p class="muted">${done} of 10 steps complete</p></section><section class="context-card"><h3>${phase(state)==='Student'?'Your next milestone':'Coming up'}</h3><p><strong>${phase(state)==='Student'?'Induction':currentStep(state)<5?'Welcome Day':'Results & enrolment'}</strong><br>${phase(state)==='Student'?'6 September 2027':currentStep(state)<5?'2 July 2027':'20 August 2027'}<small>Example appointment only</small></p>${state.events.openDay?`<p>✓ Open Day booking saved<br><small>${esc(state.events.openDay.title)}</small></p>`:''}<p><strong>${tasks.length} outstanding tasks</strong></p>${tasks.slice(0,3).map(t=>`<button class="link-button" data-action="navigate" data-step="${t.step}">${esc(t.label)}</button>`).join('')}</section>`;
}
function navigation(){
  const done=completion(state),current=currentStep(state);
  $('journey-nav').innerHTML=groups.map((group,i)=>{const complete=done.slice(group.from-1,group.to).every(Boolean),active=state.view>=group.from&&state.view<=group.to;return `<button data-action="navigate" data-step="${active?state.view:current>=group.from&&current<=group.to?current:group.from}" class="${complete?'done':current>=group.from&&current<=group.to?'current':'future'}" ${active?'aria-current="step"':''} aria-label="${group.label}, ${complete?'complete':current>=group.from&&current<=group.to?'current stage':'future stage'}"><span class="node" aria-hidden="true">${complete?'✓':i+1}</span><span><strong>${group.label}</strong><small>${complete?'Completed':current>=group.from&&current<=group.to?'You are here':`Steps ${group.from}${group.to!==group.from?'–'+group.to:''}`}</small></span></button>`;}).join('');
  $('previous').disabled=state.view===1;
  $('next').disabled=state.view===10||(!done[state.view-1]&&state.view>=current);
  $('steps-grid').innerHTML=journeyStages(state).map(step=>`<button data-action="navigate" data-step="${step.id}" ${step.id===state.view?'aria-current="step"':''}><span class="stage-number">${step.status==='COMPLETE'?'✓':step.id}</span><span><b>${step.title}</b><small>${step.status.replaceAll('_',' ').toLowerCase()}</small></span></button>`).join('');
  const active=$('journey-nav').querySelector('[aria-current]');
  if(active&&$('journey-nav').scrollWidth>$('journey-nav').clientWidth)$('journey-nav').scrollLeft=active.offsetLeft-$('journey-nav').offsetLeft-($('journey-nav').clientWidth-active.offsetWidth)/2;
}
function showPreviews(){if(photoURL&&$('portrait-preview'))$('portrait-preview').innerHTML=`<img src="${esc(photoURL)}" alt="Photograph selected for this browser session">`;if(previewURL&&$('results-preview'))$('results-preview').innerHTML=`<img class="document-preview" src="${esc(previewURL)}" alt="Your selected results image for checking against the extracted rows">`;}
function render(focus=false){
  stopQR();$('stage').innerHTML=renderStage(state);context();navigation();showPreviews();
  $('scenario').value=state.scenario;$('stage-picker').value=state.view;
  $('technical').innerHTML=technicalMarkup(state);$('technical').hidden=!$('technical-toggle').checked;
  $('activity-list').innerHTML=[...state.activity].reverse().map(event=>`<li><time datetime="${esc(event.at)}">${new Date(event.at).toLocaleString('en-GB')}</time>${esc(event.label)}${event.simulated?' <span class="tag simulated">Demo event</span>':''}</li>`).join('');
  if(focus){$('stage-title').focus({preventScroll:true});$('stage-title').scrollIntoView({block:'start'});}
}
function navigate(step){captureGeneration++;run('navigate',{step},{focus:true});if($('steps-dialog').open)$('steps-dialog').close();feedback('');}
function rowsFromForm(){return [...document.querySelectorAll('#results-rows tr')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-result]')].map(input=>[input.dataset.result,input.value])));}
function resultsEdited(){captureGeneration++;run('results-draft',{rows:rowsFromForm(),source:state.qualifications.source||'Manual entry'},{render:false});$('results-verified').checked=false;$('stage').querySelector('[data-action="results-confirmed"]').disabled=true;$('outcome').innerHTML='';context();navigation();}
async function processFile(file,kind) {
  const generation=++captureGeneration;
  try {
    if(kind==='results')run('results-draft',{rows:[],source:'New file awaiting extraction and confirmation'});
    validateUpload(file,kind==='photo'?'photo':'results');
    if(kind!=='results') {
      if(kind==='photo'){if(photoURL)URL.revokeObjectURL(photoURL);photoURL=URL.createObjectURL(file);}
      const category=kind==='photo'?'Photograph':$('document-category')?.value||'Identity evidence';
      run('document-added',{kind,name:`${category}: ${file.name}`,fileType:file.type});feedback('File selected locally. It still needs college verification.');return;
    }
    run('results-draft',{rows:[],source:'Local OCR / file extraction — awaiting confirmation'});
    if(previewURL)URL.revokeObjectURL(previewURL);previewURL=file.type.startsWith('image/')?URL.createObjectURL(file):'';showPreviews();
    $('capture-status').textContent='Reading results locally…';
    const data=await readResultsFile(file,text=>{if(generation===captureGeneration&&$('capture-status'))$('capture-status').textContent=text;});
    if(generation!==captureGeneration)return;
    run('results-draft',{rows:data.rows,source:file.type.startsWith('text/')?'Text file parsed locally':'Image/PDF read by local OCR'});
    $('capture-status').textContent=data.rows.length?`Found ${data.rows.length} proposed results. Check and confirm every row below.`:'No results could be read. Enter or correct your grades manually below.';
  }catch(error){if(generation===captureGeneration)feedback(error.message,true);}
}
async function scanQR(){
  if(!('BarcodeDetector' in window)||!navigator.mediaDevices?.getUserMedia){$('qr-status').textContent='QR camera scanning is unavailable in this browser. Use the illustrative token above. No DfE connection is available.';return;}
  const generation=++captureGeneration;
  try {
    qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
    if(generation!==captureGeneration){stopQR();return;}
    const video=$('qr-video');video.hidden=false;video.srcObject=qrStream;await video.play();
    const detector=new BarcodeDetector({formats:['qr_code']});let attempts=0;
    const scan=async()=>{if(!qrStream||generation!==captureGeneration){stopQR();return;}try{const found=await detector.detect(video);if(found.length){stopQR();if(run('scan-demo-qr',{token:found[0].rawValue}))feedback('Illustrative token read. Identity verification is still required.');return;}if(++attempts>100){stopQR();$('qr-status').textContent='No QR found. Use the illustrative token to continue.';return;}qrTimer=setTimeout(scan,300);}catch{stopQR();$('qr-status').textContent='QR detection failed. Use the illustrative token to continue.';}};
    $('qr-status').textContent='Local scanner prototype. Only DEMO-JAMIE-2027 is accepted.';scan();
  }catch{stopQR();if($('qr-status'))$('qr-status').textContent='Camera unavailable or permission declined. Use the illustrative token.';}
}
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  const action=target.dataset.action;feedback('');
  if(action==='navigate'){navigate(Number(target.dataset.step));return;}
  if(action==='match'){run('match',{interest:$('interest').value,qualification:$('qualification-type').selectedIndex===1?'other':'GCSE',maths:$('predicted-maths').value,english:$('predicted-english').value});return;}
  if(action==='save-course'||action==='choose-alternative'){run(action,{id:target.dataset.course});feedback(action==='save-course'?'Course saved. Your selection will follow you into your application.':'Your alternative is saved for a college conversation.');return;}
  if(action==='book-open-day'){run(action,{id:target.dataset.event});return;}
  if(['submit-application','prepare','application-declarations','results-confirmed'].includes(action)){
    const id={'submit-application':'application-confirm',prepare:'prepare-confirm','application-declarations':'declarations-confirm','results-confirmed':'results-verified'}[action];
    run(action,{confirmed:$(id)?.checked===true});return;
  }
  const upload={ 'photo-capture':'photo-camera','photo-upload':'photo-file','identity-upload':'identity-file','results-camera':'results-camera-file','results-upload':'results-upload-file'};
  if(upload[action]){$(upload[action]).click();return;}
  if(action==='sample-photo'||action==='sample-identity'){run('document-added',{kind:action==='sample-photo'?'photo':'identity',name:action==='sample-photo'?'Jamie’s fictional portrait':'Fictional identity evidence',synthetic:true});return;}
  if(action==='sample-results'){captureGeneration++;run('results-draft',{rows:resultRows(state.scenario),source:'Synthetic fixture — not OCR',simulated:true});return;}
  if(action==='sample-ocr'){
    const generation=++captureGeneration;
    try{const response=await fetch(`./journey-assets/results-${state.scenario}.png`);if(!response.ok)throw new Error('The example image could not be loaded.');const blob=await response.blob();if(generation!==captureGeneration)return;await processFile(new File([blob],'synthetic-results.png',{type:'image/png'}),'results');}catch(error){if(generation===captureGeneration)feedback(error.message,true);}return;
  }
  if(action==='manual-results'){$('results-rows').querySelector('input').focus();return;}
  if(action==='add-result'||action==='remove-result'){
    captureGeneration++;let rows=rowsFromForm();if(action==='add-result')rows.push({subject:'',qualification:'GCSE',grade:''});else rows.splice(Number(target.dataset.row),1);run('results-draft',{rows,source:state.qualifications.source||'Manual entry'});return;
  }
  if(action==='enrolment-checks'){run(action,{identityChecked:$('id-check').checked,courseConfirmed:$('course-check').checked,contactConfirmed:$('contact-check').checked,declarations:$('enrol-declarations').checked});return;}
  if(action==='scan-demo-qr'){if(run(action,{token:$('qr-token').value}))feedback('Illustrative token linked to Jamie. Identity still needs a staff check.');return;}
  if(action==='qr-camera'){await scanQR();return;}
  if(action==='college-confirmed'){if(run(action))navigate(10);return;}
  run(action);
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='details-form')return;event.preventDefault();
  const data=Object.fromEntries(new FormData(event.target));if(run('save-details',data,{render:false}))run('review-application');
});
document.addEventListener('input',event=>{
  if(event.target.id==='course-search')$('course-list').innerHTML=coursesMarkup(state,event.target.value);
  if(event.target.matches('[data-result]'))resultsEdited();
});
document.addEventListener('change',event=>{
  const id=event.target.id;
  if(id==='results-verified')$('stage').querySelector('[data-action="results-confirmed"]').disabled=!event.target.checked;
  if(event.target.matches('select[data-result]'))resultsEdited();
  if(['photo-file','photo-camera','identity-file','results-camera-file','results-upload-file'].includes(id)&&event.target.files[0])processFile(event.target.files[0],id.startsWith('photo')?'photo':id==='identity-file'?'identity':'results');
});
$('stage-picker').innerHTML=STEPS.map(step=>`<option value="${step.id}">${step.id}. ${step.title}</option>`).join('');
$('all-steps').addEventListener('click',()=>{$('steps-dialog').showModal();});$('close-steps').addEventListener('click',()=>{$('steps-dialog').close();$('all-steps').focus();});
$('previous').addEventListener('click',()=>navigate(state.view-1));$('next').addEventListener('click',()=>navigate(Math.min(10,state.view+1)));$('home-button').addEventListener('click',()=>navigate(currentStep(state)));
document.querySelectorAll('[data-history-toggle]').forEach(button=>button.addEventListener('click',()=>{$('activity').hidden=!$('activity').hidden;document.querySelectorAll('[data-history-toggle]').forEach(toggle=>toggle.setAttribute('aria-expanded',String(!$('activity').hidden)));if(!$('activity').hidden){$('activity-heading').focus();$('activity-heading').scrollIntoView({block:'start'});}}));
$('technical-toggle').addEventListener('change',()=>{$('technical').hidden=!$('technical-toggle').checked;});
function replaceExample(next,message){captureGeneration++;stopQR();revokePreviews();state=next;persist();render(true);feedback(message);}
$('run-demo').addEventListener('click',()=>replaceExample(createJourney($('scenario').value),'Jamie’s fictional journey is ready. Start with Course Matcher.'));
$('reset').addEventListener('click',()=>replaceExample(createJourney($('scenario').value),'Demo reset. The previous local example has been replaced.'));
$('load-stage').addEventListener('click',()=>replaceExample(stageExample(Number($('stage-picker').value),$('scenario').value),'Loaded a synthetic stage example. All seeded events are marked as demonstration events.'));
$('demo-next').addEventListener('click',()=>replaceExample(advanceDemo(state),'Presenter completed this step using fictional example data.'));
window.addEventListener('pagehide',()=>{stopQR();revokePreviews();});
render();if(saved)feedback('Welcome back. Your demo journey has been restored. Image files need selecting again after a reload.');
