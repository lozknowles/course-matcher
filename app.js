/*
 * Course Match browser application/controller
 * ------------------------------------------
 * This module owns browser interaction only. It intentionally delegates:
 *   - course data/provenance to courses.js
 *   - qualification parsing/matching to matcher-core.js
 *
 * Runtime privacy model:
 * uploaded documents, OCR text, grades and adviser cohort data remain in
 * browser memory in the current prototype. There is no application upload API
 * in this repository.
 *
 * Support invariants:
 *   1. OCR is assistance, never authority: users must pass through the grade
 *      verification screen before matching.
 *   2. A failed OCR/PDF path must leave manual entry usable.
 *   3. Student and adviser views use the same matcher-core.js rules.
 *   4. User-controlled values rendered through innerHTML must be escaped.
 *
 * See ARCHITECTURE.md for detailed data-flow and trust-boundary documentation.
 */

import { COURSES, SUBJECTS, SUBJECT_LINKS } from './courses.js';
import { normaliseGrades, parseResultsText, rankCourses, quickMatchCourses, matchCourse, validateGrades, RECOGNISED_GCSE_SUBJECTS } from './matcher-core.js';
import { pdfTextItemsToLines, readAllPdfPages } from './document-core.js';
import { alternativesState, buildTransferHandoff, capacityOptimisationAllowed, interventionFor, outcomeLabel, warmStartAlternatives, withdrawalReviewPath } from './retention-core.js';

// Small DOM helpers used throughout this framework-free application.
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

// Transient browser state only: refreshing/closing the page clears it.
const state = { grades: [], interests: new Set(), cohort: [] };

// Escape user-controlled values before placing them inside an innerHTML string.
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

const COMMON_SUBJECTS = [...RECOGNISED_GCSE_SUBJECTS];

// ---------------------------------------------------------------------------
// Top-level mode and student-step navigation
// ---------------------------------------------------------------------------
function setMode(mode){
  $$('.mode-panel').forEach(p => p.classList.toggle('active', p.id === `${mode}-mode`));
  $$('.tab').forEach(t => { const active=t.dataset.mode===mode; t.classList.toggle('active',active); t.setAttribute('aria-selected',active); });
  document.body.classList.toggle('retention-active',mode==='retention');
  const heroCopy={
    launch:['Lincoln College demonstration suite','Student success','Three connected demonstrations for course discovery, staff conversations and early retention support.'],
    student:['Results day course finder','Course Match','Turn achieved grades into useful Lincoln College course conversations.'],
    adviser:['Tutor and adviser demonstration','Course conversations','Start with a course and find learners worth a transparent, human-led conversation.'],
    about:['About this prototype','Course Match','Understand the evidence, safety boundaries and purpose of this unofficial demonstration.']
  }[mode];
  if(heroCopy){$('.hero-kicker').textContent=heroCopy[0];$('#course-match-title').textContent=heroCopy[1];$('.hero-lead').textContent=heroCopy[2]}
  window.scrollTo({top:0,behavior:'smooth'});
}
$$('.tab').forEach(t=>t.addEventListener('click',()=>setMode(t.dataset.mode)));
$$('[data-launch-mode]').forEach(button=>button.addEventListener('click',()=>setMode(button.dataset.launchMode)));
$$('[data-mode-link]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();setMode(link.dataset.modeLink)}));

function setStep(n){ $$('.step').forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===n)); }
function showStudentPanel(id, step){ ['results-entry','verify-panel','match-options-panel','interest-panel','matches-panel'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id)); setStep(step); $('#'+id).scrollIntoView({behavior:'smooth',block:'start'}); }

// ---------------------------------------------------------------------------
// Manual grade entry
// ---------------------------------------------------------------------------
function subjectOptions(selected=''){ return ['','...'].concat(COMMON_SUBJECTS).map(s=>s==='...'?'':`<option value="${s}" ${s===selected?'selected':''}>${s||'Select subject'}</option>`).join(''); }
function addManualRow(subject='',grade=''){
  const row=document.createElement('div'); row.className='manual-row';
  row.innerHTML=`<select aria-label="Subject">${subjectOptions(subject)}</select><input aria-label="Grade" value="${grade}" maxlength="5" placeholder="Grade"><button class="remove-row" aria-label="Remove row">×</button>`;
  $('.remove-row',row).addEventListener('click',()=>row.remove()); $('#manual-rows').appendChild(row);
}
function readManualRows(root='#manual-rows'){ return $$('.manual-row',$(root)).map(row=>({subject:$('select',row).value,grade:$('input',row).value})).filter(x=>x.subject&&x.grade); }
function seedManual(rows){ $('#manual-rows').innerHTML=''; rows.forEach(r=>addManualRow(r.subject,r.grade)); if(!rows.length) for(let i=0;i<4;i++) addManualRow(); }
seedManual([]); $('#add-row').addEventListener('click',()=>addManualRow());

// Repeatable synthetic profile used by demonstrations and regression tests.
const GOLDEN = [
  {subject:'Mathematics',grade:'5'},{subject:'English Language',grade:'4'},{subject:'English Literature',grade:'3'},
  {subject:'Geography',grade:'3'},{subject:'Physics',grade:'2'},{subject:'Combined Science',grade:'5'}
];
$('#load-golden').addEventListener('click',()=>{ seedManual(GOLDEN); $('#ocr-text').value='Mathematics 5\nEnglish Language 4\nEnglish Literature 3\nGeography 3\nPhysics 2\nCombined Science 5'; $('#ocr-status').textContent='Synthetic demo student loaded.'; });

// Convert OCR/copied text into editable manual rows. Parsing is deliberately
// conservative; the next stage is always a human verification table.
function parseTextIntoRows({ advanceToVerify=false, summary='' }={}){
  const parsed=parseResultsText($('#ocr-text').value);
  if(parsed.length){
    seedManual(parsed);
    $('#ocr-status').textContent=summary||`Found ${parsed.length} qualification${parsed.length===1?'':'s'}. Please verify them.`;
    if(advanceToVerify){
      state.grades=parsed;
      renderVerify();
      $('#extraction-summary').textContent=$('#ocr-status').textContent;
      showStudentPanel('verify-panel',2);
    }
  } else {
    $('#ocr-status').textContent='No recognisable subject/grade pairs found. The extracted text is available below; enter or correct the grades manually.';
  }
  return parsed;
}
$('#parse-text').addEventListener('click',parseTextIntoRows);

// ---------------------------------------------------------------------------
// Results document handling (text/CSV, PDF.js and local Tesseract.js OCR)
// ---------------------------------------------------------------------------
$('#choose-file').addEventListener('click',()=>$('#result-file').click());
$('#take-photo').addEventListener('click',()=>$('#camera-file').click());
const drop=$('#drop-zone');
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f) processFile(f)});
$('#result-file').addEventListener('change',e=>{if(e.target.files[0])processFile(e.target.files[0])});
$('#camera-file').addEventListener('change',e=>{if(e.target.files[0])processFile(e.target.files[0])});

function setUploadBusy(busy){
  $('#choose-file').disabled=busy;
  $('#take-photo').disabled=busy;
  $('#result-file').disabled=busy;
  $('#camera-file').disabled=busy;
  $('#drop-zone').setAttribute('aria-busy',String(busy));
}

/**
 * Route a browser File object to the appropriate local extraction path.
 * Failure is intentionally non-fatal: the user can always fall back to manual
 * entry rather than being blocked by OCR/PDF tooling.
 */
async function processFile(file){
  setUploadBusy(true);
  $('#ocr-status').textContent=`Reading ${file.name}…`;
  try{
    if(/text|csv/.test(file.type)||/\.(txt|csv)$/i.test(file.name)){
      $('#ocr-text').value=await file.text();
      const count=parseTextIntoRows({advanceToVerify:true}).length;
      if(count) $('#extraction-summary').textContent=`Read ${file.name} and found ${count} qualification${count===1?'':'s'}. Check every item against the document.`;
      return;
    }
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
      const extracted=await extractPdf(file);
      $('#ocr-text').value=extracted.text;
      const parsed=parseResultsText(extracted.text);
      const warning=extracted.warnings.length?` ${extracted.warnings.length} page${extracted.warnings.length===1?'':'s'} could not be OCR-scanned; check the original carefully.`:'';
      parseTextIntoRows({advanceToVerify:true,summary:`Scanned all ${extracted.totalPages} PDF page${extracted.totalPages===1?'':'s'} and found ${parsed.length} qualification${parsed.length===1?'':'s'}.${warning}`});
      return;
    }
    if(file.type.startsWith('image/')){
      const text=await ocrImage(file); $('#ocr-text').value=text;
      const count=parseTextIntoRows({advanceToVerify:true}).length;
      if(count) $('#extraction-summary').textContent=`Scanned ${file.name} and found ${count} qualification${count===1?'':'s'}. Check every item against the photograph.`;
      return;
    }
    throw new Error('Unsupported file type');
  }catch(err){
    console.error(err); $('#ocr-status').textContent=`Could not automatically read this file: ${err.message}. You can still enter the grades manually.`;
  }finally{
    setUploadBusy(false);
    $('#result-file').value='';
    $('#camera-file').value='';
  }
}

/** Lazily load the locally vendored Tesseract browser bundle. */
async function ensureTesseract(){
  if(window.Tesseract) return window.Tesseract;
  await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/tesseract/tesseract.min.js';s.onload=resolve;s.onerror=()=>reject(new Error('local OCR vendor bundle is not installed'));document.head.appendChild(s)});
  return window.Tesseract;
}

let ocrProgressLabel='OCR';
async function createOcrWorker(){
  const T=await ensureTesseract();
  return T.createWorker('eng',1,{workerPath:'./vendor/tesseract/worker.min.js',corePath:'./vendor/tesseract-core',langPath:'./vendor/tessdata',logger:m=>{if(m.status)$('#ocr-status').textContent=`${ocrProgressLabel}: ${m.status}${m.progress?` ${Math.round(m.progress*100)}%`:''}`}});
}
function withTimeout(promise, milliseconds, message){
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),milliseconds)})]).finally(()=>clearTimeout(timer));
}
async function recogniseWithWorker(worker,source,label='OCR'){
  ocrProgressLabel=label;
  const {data}=await withTimeout(worker.recognize(source),120000,`${label} timed out`);
  return data.text||'';
}

/** OCR an image/canvas locally in the browser and always terminate the worker. */
async function ocrImage(source){
  $('#ocr-status').textContent='Preparing local OCR…';
  const worker=await createOcrWorker();
  try{return await recogniseWithWorker(worker,source,'OCR')}finally{await worker.terminate()}
}

/**
 * Extract every PDF page locally. PDF text items are reconstructed into visual
 * rows. Pages with no usable qualification rows (or sparse rows plus embedded
 * imagery) are rendered and OCR-scanned. One worker is reused for the PDF.
 */
async function extractPdf(file){
  let pdfjs;
  try{pdfjs=await import('./vendor/pdfjs/pdf.mjs')}catch{throw new Error('local PDF vendor bundle is not installed')}
  pdfjs.GlobalWorkerOptions.workerSrc='./vendor/pdfjs/pdf.worker.mjs';
  const data=new Uint8Array(await file.arrayBuffer());
  const pdf=await pdfjs.getDocument({data}).promise;
  const totalPages=pdf.numPages;
  const pages=[];
  const warnings=[];
  let worker=null;
  try{
    const extractedPages=await readAllPdfPages(pdf,async(page,i)=>{
      try{
        const content=await page.getTextContent();
        const pageText=pdfTextItemsToLines(content.items);
        const parsedText=parseResultsText(pageText);
        const operations=await page.getOperatorList();
        const imageOps=new Set([pdfjs.OPS.paintImageXObject,pdfjs.OPS.paintInlineImageXObject,pdfjs.OPS.paintImageMaskXObject]);
        const containsImage=operations.fnArray.some(operation=>imageOps.has(operation));
        const needsOcr=parsedText.length===0||(containsImage&&parsedText.length<3);
        let ocrText='';

        if(needsOcr){
          try{
            if(!worker) worker=await createOcrWorker();
            const base=page.getViewport({scale:1});
            const scale=Math.min(2,Math.sqrt(6000000/Math.max(1,base.width*base.height)));
            const viewport=page.getViewport({scale});
            const canvas=document.createElement('canvas');
            canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
            await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise;
            ocrText=await recogniseWithWorker(worker,canvas,`PDF page ${i} of ${totalPages}`);
            canvas.width=0;canvas.height=0;
          }catch(error){
            console.error(`PDF page ${i} OCR failed`,error);
            warnings.push({page:i,message:error.message});
          }
        }
        return `--- PDF page ${i} ---\n${pageText}\n${ocrText}`.trim();
      }catch(error){
        console.error(`PDF page ${i} could not be read`,error);
        warnings.push({page:i,message:error.message});
        return `--- PDF page ${i}: extraction failed ---`;
      }
      },(i,total)=>{$('#ocr-status').textContent=`Reading PDF page ${i} of ${total}…`});
    pages.push(...extractedPages);
  }finally{
    if(worker) await worker.terminate();
    if(typeof pdf.destroy==='function') await pdf.destroy();
    else if(typeof pdf.cleanup==='function') await pdf.cleanup();
  }
  return {text:pages.join('\n'),totalPages,warnings};
}

// ---------------------------------------------------------------------------
// Mandatory human verification gate
// ---------------------------------------------------------------------------
$('#to-verify').addEventListener('click',()=>{
  const rows=readManualRows(); if(!rows.length){$('#ocr-status').textContent='Add at least one subject and grade first.';return}
  state.grades=rows; renderVerify(); $('#extraction-summary').textContent='Check every manually entered result before matching.'; showStudentPanel('verify-panel',2);
});
function renderVerify(){
  const tbody=$('#verify-body'); tbody.innerHTML='';
  state.grades.forEach((g,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><select class="text-input">${subjectOptions(g.subject)}</select></td><td><input class="text-input" value="${escapeHtml(g.grade)}" maxlength="5"></td><td><button class="remove-row" aria-label="Remove result">×</button></td>`;$('.remove-row',tr).addEventListener('click',()=>{state.grades.splice(i,1);renderVerify()});tbody.appendChild(tr)});
  const tr=document.createElement('tr');tr.innerHTML='<td colspan="3"><button class="secondary" id="verify-add">+ Add missing subject</button></td>';tbody.appendChild(tr);$('#verify-add').addEventListener('click',()=>{state.grades.push({subject:'',grade:''});renderVerify()});
}
function readVerify(){state.grades=$$('#verify-body tr').slice(0,-1).map(tr=>({subject:$('select',tr)?.value||'',grade:$('input',tr)?.value||''})).filter(x=>x.subject&&x.grade)}
function verifiedGradesAreValid(){
  const { issues }=validateGrades(state.grades);
  if(!issues.length){$('#verify-status').textContent='';return true}
  const labels={'duplicate-subject':'duplicate subject','unknown-subject':'unsupported subject','invalid-grade':'invalid grade'};
  $('#verify-status').textContent=`Resolve ${[...new Set(issues.map(issue=>labels[issue.type]))].join(', ')} entries before matching.`;
  return false;
}
$('#confirm-grades').addEventListener('click',()=>{readVerify();if(!state.grades.length||!verifiedGradesAreValid())return;showStudentPanel('match-options-panel',3)});
const studentPanelSteps={ 'results-entry':1, 'verify-panel':2, 'match-options-panel':3, 'interest-panel':3, 'matches-panel':4 };
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>showStudentPanel(b.dataset.back,studentPanelSteps[b.dataset.back])));

// ---------------------------------------------------------------------------
// Student interests and course matching
// ---------------------------------------------------------------------------
SUBJECTS.forEach(subject=>{const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=subject;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{const on=b.getAttribute('aria-pressed')==='true';b.setAttribute('aria-pressed',String(!on));if(on)state.interests.delete(subject);else state.interests.add(subject)});$('#interest-chips').appendChild(b)});

$('#quick-match').addEventListener('click',()=>{readVerify();if(!verifiedGradesAreValid()){showStudentPanel('verify-panel',2);return}renderMatches('quick');showStudentPanel('matches-panel',4)});
$('#guided-match').addEventListener('click',()=>showStudentPanel('interest-panel',3));
$('#run-match').addEventListener('click',()=>{readVerify();if(!verifiedGradesAreValid()){showStudentPanel('verify-panel',2);return}renderMatches('guided');showStudentPanel('matches-panel',4)});
$('#edit-results').addEventListener('click',()=>showStudentPanel('verify-panel',2));
$('#change-match-route').addEventListener('click',()=>showStudentPanel('match-options-panel',3));

/** Render the explainable course results produced by matcher-core.js. */
function renderMatches(mode='guided'){
  const quick=mode==='quick';
  const ranked=quick?quickMatchCourses(state.grades,COURSES):rankCourses(state.grades,COURSES,[...state.interests],$('#career-text').value);
  const greens=ranked.filter(x=>x.status==='green').length; const ambers=ranked.filter(x=>x.status==='amber').length;
  $('#matches-heading').textContent=quick?'Your Quick Match courses':'Your indicative matches';
  $('#match-summary').textContent=quick
    ? `${ranked.length} encoded course${ranked.length===1?'':'s'} where the verified grades meet every encoded hard grade requirement.`
    : `${ranked.length} encoded course${ranked.length===1?'':'s'} shown · ${greens} likely grade match${greens===1?'':'es'} · ${ambers} need closer checking.`;
  $('#match-legend').innerHTML=quick
    ? '<span class="badge green">Meets encoded grade requirements</span><span class="micro">Other entry conditions and current availability still need College confirmation.</span>'
    : '<span class="badge green">Likely meets encoded grades</span><span class="badge amber">Near match / needs checking</span><span class="badge red">Does not meet encoded grades</span>';
  const list=$('#match-list');list.innerHTML='';
  ranked.forEach(result=>{
    const c=result.course; const card=document.createElement('article');card.className=`match-card ${result.status}`;
    const statusText={green:'Likely meets encoded grades',amber:'Near match / needs checking',red:'Does not meet encoded grades'}[result.status];
    card.innerHTML=`<div class="match-top"><div><span class="badge ${result.status}">${statusText}</span><h3>${c.title}</h3><p class="course-meta">${c.subject} · Level ${c.level||'Entry'} · ${c.campus}</p></div><div class="course-meta">Criteria checked ${c.checked}</div></div><p>${c.summary}</p><div class="checks">${result.checks.map(x=>`<div class="check ${x.pass?'pass':'fail'}"><strong>${x.label}</strong> — ${x.detail}</div>`).join('')}</div>${result.warnings.length?`<div class="warning-list"><strong>Still needs a human check</strong><ul>${result.warnings.map(w=>`<li>${w}</li>`).join('')}</ul></div>`:''}<p><a class="course-link" href="${c.url}" target="_blank" rel="noreferrer">Verify on official Lincoln College page ↗</a></p>`;
    list.appendChild(card);
  });
  if(!ranked.length) list.innerHTML=quick
    ? '<div class="panel"><h3>No definite Quick Match yet</h3><p>No encoded course passed every hard grade check for these results. Use Guided Match to see near matches and progression routes, or speak with Lincoln College about other options.</p></div>'
    : '<div class="panel"><h3>No encoded courses matched those interests</h3><p>Try broadening the interests or use the official subject links below. This prototype deliberately does not invent eligibility rules for courses it has not encoded.</p></div>';
}

// Always provide an official navigation path for subjects that are not encoded
// strongly enough to receive a machine eligibility result.
Object.entries(SUBJECT_LINKS).forEach(([s,u])=>{const a=document.createElement('a');a.href=u;a.target='_blank';a.rel='noreferrer';a.textContent=s;$('#subject-links').appendChild(a)});

// ---------------------------------------------------------------------------
// Adviser / reverse-matching mode
// ---------------------------------------------------------------------------
// This mode deliberately reuses matchCourse() so student and staff views cannot
// drift into separate hidden eligibility implementations.
COURSES.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.title;$('#adviser-course').appendChild(o)});
const SYNTHETIC=[
 {id:'S-001',interest:'Computing',grades:GOLDEN},
 {id:'S-002',interest:'Engineering',grades:[['Mathematics',7],['English Language',5],['Combined Science','6-6'],['Geography',5],['Business',5]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-003',interest:'Business',grades:[['Mathematics',4],['English Language',4],['Business',5],['Geography',4],['History',4]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-004',interest:'Health and Social Care',grades:[['Mathematics',4],['English Language',5],['Combined Science','4-4'],['Geography',4],['History',3]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-005',interest:'Sport',grades:[['Mathematics',3],['English Language',3],['Combined Science','3-3'],['Sport',5]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-006',interest:'Creative Arts',grades:[['Mathematics',3],['English Language',4],['Art & Design',6],['History',3]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-007',interest:'Construction',grades:[['Mathematics',3],['English Language',3],['Combined Science',2],['Geography',2]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-008',interest:'Computing',grades:[['Mathematics',5],['English Language',5],['Computing',6],['Combined Science','5-5'],['Business',4]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-009',interest:'Catering',grades:[['Mathematics',3],['English Language',3],['Business',3],['Geography',3]].map(([subject,grade])=>({subject,grade:String(grade)}))},
 {id:'S-010',interest:'Childcare',grades:[['Mathematics',3],['English Language',4],['Combined Science','3-3'],['Geography',3]].map(([subject,grade])=>({subject,grade:String(grade)}))}
];
function selectedCourse(){return COURSES.find(c=>c.id===$('#adviser-course').value)||COURSES[0]}
function renderCourseRule(){const c=selectedCourse();$('#course-rule-card').innerHTML=`<strong>${c.title}</strong><br>${c.summary}<br><a href="${c.url}" target="_blank" rel="noreferrer">Official source ↗</a>`;renderCohort()}
$('#adviser-course').addEventListener('change',renderCourseRule);
$('#load-cohort').addEventListener('click',()=>{state.cohort=structuredClone(SYNTHETIC);renderCohort()});
function renderCohort(){const body=$('#cohort-results');body.innerHTML='';const c=selectedCourse();state.cohort.map(person=>({person,result:matchCourse(person.grades,c)})).sort((a,b)=>b.result.score-a.result.score).forEach(({person,result})=>{const tr=document.createElement('tr');tr.innerHTML=`<td><strong>${escapeHtml(person.id)}</strong></td><td>${escapeHtml(person.interest||'—')}</td><td><span class="badge ${result.status}">${result.status==='green'?'Likely':result.status==='amber'?'Check':'No'}</span></td><td>${result.checks.map(x=>`${x.pass?'✓':'!'} ${x.label}`).join('<br>')}</td>`;body.appendChild(tr)});if(!state.cohort.length)body.innerHTML='<tr><td colspan="4">Load the synthetic cohort or import a CSV to begin.</td></tr>'}
$('#cohort-file').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;state.cohort=parseCohortCsv(await f.text());renderCohort()});

// Lightweight CSV parsing for the demonstration. For a production integration,
// prefer an approved structured data contract rather than arbitrary CSV upload.
function parseCsvLine(line){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===','&&!q){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out}
function parseCohortCsv(text){const lines=text.split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const h=parseCsvLine(lines[0]);const idI=h.findIndex(x=>/^id$/i.test(x)),intI=h.findIndex(x=>/^interest$/i.test(x));return lines.slice(1).map((line,rowIndex)=>{const vals=parseCsvLine(line);const grades=h.map((name,i)=>({subject:name,grade:vals[i]})).filter((_,i)=>i!==idI&&i!==intI&&vals[i]);return{id:vals[idI]||`row-${rowIndex+2}`,interest:vals[intI]||'',grades}})}

renderCourseRule();

// ---------------------------------------------------------------------------
// 42-Day Student Fit & Retention - Swap Not Drop decision support
// ---------------------------------------------------------------------------
// All records below are deliberately synthetic and cannot be written back to
// a College system. The College's established process remains learner-led,
// staff-supported and human-decided. Course matching is activated only when
// diagnosis indicates that transfer is an appropriate intervention.
const RETENTION_LEARNERS=[
  {id:'SYN-1042',name:'Maya Thompson',day:23,risk:'High',programme:'Level 3 Health & Social Care',area:'Health & care',attendance:68,concernCode:'support_need',status:'Supportive conversation',reason:'Attendance changed after the learner disclosed that an existing support arrangement had not carried into the new programme.',qualifications:'Five GCSEs recorded; verification source not shown in this synthetic view.',entryRequirement:'Not relevant until transfer is an appropriate intervention.',promonitor:'Open - discussion and support action recorded (synthetic)',recommended:'Confirm the unmet need, route to Learner Support and review whether engagement improves.',outcome:'support_intervention',transferAppropriate:false,transferAgreed:false,skills:['Empathy','Communication','Organisation'],interests:['Caring for people','Mental health','Community support'],alternatives:[{title:'T Level Health (Adult Nursing)',courseCode:'SYN-HSC-TL',level:'3',area:'Health & care',entry:'Likely - requires Curriculum Lead review',overlap:'Caring practice and communication',career:'Aligned to stated nursing interest',capacity:'Requires human check',compliance:'Placement suitability requires confirmation',why:'Related health pathway using existing caring strengths.',group:'HSC-TL-A',startDate:'14 September 2026'},{title:'BTEC Applied Psychology',courseCode:'SYN-PSY-L3',level:'3',area:'Science',entry:'Requires human check',overlap:'Communication and mental-health interest',career:'Potentially aligned',capacity:'Requires human check',compliance:'Eligibility requires confirmation',why:'A contingency only if support does not resolve the concern.',group:'PSY-L3-A',startDate:'14 September 2026'},{title:'BTEC Early Years Educator',courseCode:'SYN-EYE-L3',level:'3',area:'Health & care',entry:'Likely - requires review',overlap:'Empathy and organisation',career:'Adjacent',capacity:'Requires human check',compliance:'Placement checks required',why:'Related caring route retained as a dormant option.',group:'EYE-L3-A',startDate:'14 September 2026'}],reciprocal:null,history:['19 Aug - tutor concern recorded','22 Aug - supportive conversation opened','27 Aug - Learner Support action proposed']},
  {id:'SYN-1088',name:'Alex Nguyen',day:18,risk:'High',programme:'Level 3 Engineering',area:'Engineering',attendance:61,concernCode:'course_mismatch',status:'Awaiting Curriculum Lead',reason:'The learner describes a sustained preference for software-led design and does not feel the current workshop-led programme is the right subject fit.',qualifications:'Mathematics 6; English Language 5; Combined Science 5-5 (synthetic, human-verified for demo).',entryRequirement:'Alternative rules are shown as indicative evidence, not admissions decisions.',promonitor:'Intention to Transfer open - discussion and progress record (synthetic)',recommended:'Discuss the diagnosis with the learner, then ask the relevant Curriculum Lead to review viable alternatives.',outcome:'internal_transfer',transferAppropriate:true,transferAgreed:false,skills:['Problem solving','CAD','Numeracy'],interests:['Software design','Technology','Practical projects'],alternatives:[{title:'T Level Digital Production',courseCode:'SYN-DIG-TL',level:'3',area:'Digital',entry:'Likely - encoded grades appear to be met',overlap:'Problem solving, design and numeracy',career:'Strong software-product alignment',capacity:'Requires human check',compliance:'Industry placement and current criteria require confirmation',why:'Closest subject and skills overlap with the learner\'s stated direction.',group:'DIG-TL-A',startDate:'14 September 2026'},{title:'Level 3 Computing',courseCode:'SYN-COM-L3',level:'3',area:'Digital',entry:'Likely - encoded grades appear to be met',overlap:'Numeracy and technology',career:'Strong computing alignment',capacity:'Requires human check',compliance:'Curriculum Lead review required',why:'Offers a broader software route while retaining analytical skills.',group:'COM-L3-A',startDate:'14 September 2026'},{title:'Level 3 Design & Development',courseCode:'SYN-DDD-L3',level:'3',area:'Creative',entry:'Requires human check',overlap:'CAD and product design',career:'Potential design alignment',capacity:'Requires human check',compliance:'Portfolio requirement requires confirmation',why:'Potential fit where product design matters more than pure software.',group:'DDD-L3-A',startDate:'14 September 2026'}],reciprocal:['Omar Ali','Level 3 Digital','Level 3 Engineering'],history:['16 Aug - workshop engagement flagged','21 Aug - learner preference recorded','28 Aug - Curriculum Lead review requested']},
  {id:'SYN-1116',name:'Jordan Clarke',day:17,risk:'Medium',programme:'A Level Biology',area:'Science',attendance:76,concernCode:'academic_difficulty',status:'Monitoring',reason:'The learner is finding the pace and assessment method difficult but remains interested in science.',qualifications:'Current and prior attainment available in the synthetic record.',entryRequirement:'Adjacent or lower-level provision is considered only if academic support is insufficient.',promonitor:'Support actions recorded; no transfer intention at present (synthetic)',recommended:'Agree academic support, clarify assessment expectations and review progress before opening transfer matching.',outcome:'support_intervention',transferAppropriate:false,transferAgreed:false,skills:['Scientific method','Analysis','Teamwork'],interests:['Laboratory work','Health science','Practical learning'],alternatives:[{title:'BTEC Applied Science',courseCode:'SYN-SCI-L3',level:'3',area:'Science',entry:'Likely - requires review',overlap:'Science and practical assessment',career:'Aligned',capacity:'Requires human check',compliance:'Eligibility requires confirmation',why:'Dormant adjacent pathway if support does not resolve the concern.',group:'SCI-L3-A',startDate:'14 September 2026'}],reciprocal:null,history:['18 Aug - academic concern captured','24 Aug - support plan agreed','29 Aug - review scheduled']},
  {id:'SYN-1171',name:'Riya Shah',day:16,risk:'Monitor',programme:'T Level Digital Production',area:'Digital',attendance:91,concernCode:'belonging',status:'Monitoring',reason:'The learner reports feeling isolated in the new group despite positive attendance and course engagement.',qualifications:'Not relevant to the current pastoral intervention.',entryRequirement:'Not relevant to the current intervention.',promonitor:'Pastoral discussion recorded; monitoring (synthetic)',recommended:'Use pastoral and peer-belonging support, then review with the learner.',outcome:'remain',transferAppropriate:false,transferAgreed:false,skills:['Coding','Collaboration','UX thinking'],interests:['Web products','Data','User experience'],alternatives:[],reciprocal:null,history:['15 Aug - learner check-in','23 Aug - peer-support option discussed','29 Aug - remain and monitor']},
  {id:'SYN-1210',name:'Ethan Williams',day:15,risk:'Medium',programme:'Level 3 Sport',area:'Sport',attendance:74,concernCode:'careers',status:'Awaiting Careers',reason:'The learner is unsure whether the current programme supports their longer-term direction.',qualifications:'Synthetic qualifications available for a later, learner-led course discussion.',entryRequirement:'Do not assess alternatives until Careers Guidance clarifies direction.',promonitor:'Careers referral action recorded (synthetic)',recommended:'Arrange Careers Guidance and keep the learner under review.',outcome:'careers_review',transferAppropriate:false,transferAgreed:false,skills:['Coaching','Leadership','Communication'],interests:['Fitness','Working with young people','Community sport'],alternatives:[{title:'Sport Coaching & Development',courseCode:'SYN-SPC-L3',level:'3',area:'Sport',entry:'Likely - requires review',overlap:'Coaching and leadership',career:'Requires Careers discussion',capacity:'Requires human check',compliance:'Current criteria require confirmation',why:'Dormant until the learner clarifies their direction.',group:'SPC-L3-A',startDate:'14 September 2026'}],reciprocal:null,history:['17 Aug - uncertainty recorded','25 Aug - supportive conversation','30 Aug - Careers referral proposed']},
  {id:'SYN-1264',name:'Samira Khan',day:20,risk:'Medium',programme:'Level 2 Creative Media',area:'Creative',attendance:72,concernCode:'transport',status:'Supportive conversation',reason:'Late arrival and absence correlate with an unreliable transport connection rather than dissatisfaction with the programme.',qualifications:'Not relevant to the access intervention.',entryRequirement:'Not relevant unless course fit later becomes the concern.',promonitor:'Transport/access discussion recorded (synthetic)',recommended:'Investigate transport, timetable and accessibility options before considering a course change.',outcome:'support_intervention',transferAppropriate:false,transferAgreed:false,skills:['Visual communication','Teamwork'],interests:['Photography','Media'],alternatives:[],reciprocal:null,history:['20 Aug - travel pattern noted','24 Aug - learner conversation','31 Aug - transport options requested']},
  {id:'SYN-1307',name:'Leo Morgan',day:21,risk:'High',programme:'Level 3 Business',area:'Business',attendance:70,concernCode:'known_alternative',status:'Transfer agreed',reason:'The learner has consistently requested a digital programme and the receiving Curriculum Lead has completed a synthetic suitability review.',qualifications:'Mathematics 5; English Language 5; other GCSE evidence recorded (synthetic).',entryRequirement:'Likely met against the demo rule set; final eligibility remains a human check.',promonitor:'Intention to Transfer open pending completion (synthetic)',recommended:'Prepare the reviewed handoff for Student Recruitment; do not send or enact automatically.',outcome:'internal_transfer',transferAppropriate:true,transferAgreed:true,skills:['Communication','Numeracy','Digital presentation'],interests:['Technology','Data','Digital products'],alternatives:[{title:'Level 3 Computing',courseCode:'SYN-COM-L3',level:'3',area:'Digital',entry:'Likely - encoded grades appear to be met',overlap:'Numeracy and digital presentation',career:'Aligned to stated digital direction',capacity:'Requires human check',compliance:'Final Curriculum Lead confirmation retained',why:'Known learner preference with relevant qualification and skills evidence.',group:'COM-L3-B',startDate:'14 September 2026'},{title:'T Level Digital Production',courseCode:'SYN-DIG-TL',level:'3',area:'Digital',entry:'Requires human check',overlap:'Data and digital products',career:'Strong potential alignment',capacity:'Requires human check',compliance:'Placement eligibility requires confirmation',why:'Plausible alternative retained for discussion.',group:'DIG-TL-A',startDate:'14 September 2026'}],reciprocal:['Ava Patel','Level 3 Computing','Level 3 Business'],history:['19 Aug - known preference confirmed','25 Aug - Curriculum Lead review','1 Sep - transfer agreed in synthetic workflow']},
  {id:'SYN-1349',name:'Noah Edwards',day:24,risk:'High',programme:'Level 2 Public Services',area:'Public services',attendance:64,concernCode:'conduct',status:'Conduct procedure',reason:'A conduct concern requires the College procedure and appropriate support; it is not evidence that another course is suitable.',qualifications:'Not used to determine the conduct pathway.',entryRequirement:'Course matching is suppressed for this concern.',promonitor:'Relevant discussion/intervention record (synthetic)',recommended:"Follow the College's Learner Conduct Procedure and record appropriate interventions in ProMonitor.",outcome:'support_intervention',transferAppropriate:false,transferAgreed:false,skills:['Teamwork','Physical fitness'],interests:['Public service'],alternatives:[],reciprocal:null,history:['21 Aug - concern recorded','24 Aug - staff review started','1 Sep - conduct pathway continuing']},
  {id:'SYN-1392',name:'Ella Brooks',day:26,risk:'High',programme:'Level 3 Art & Design',area:'Creative',attendance:59,concernCode:'external_environment',status:'External transition review',reason:'After support conversations, the learner believes a different environment and specialist provision may better meet their needs.',qualifications:'Available for informed external guidance only; no automated eligibility decision.',entryRequirement:'External provider requirements require direct human confirmation.',promonitor:'Progress and guidance actions recorded (synthetic)',recommended:'Support Careers and Student Services to explore an informed external-provider transition.',outcome:'external_transition',transferAppropriate:false,transferAgreed:false,skills:['Illustration','Portfolio development'],interests:['Specialist arts provision'],alternatives:[],reciprocal:null,history:['22 Aug - broader concern discussed','27 Aug - support options reviewed','2 Sep - external guidance pathway agreed']},
  {id:'SYN-1425',name:'Jamie Price',day:29,risk:'High',programme:'Level 2 Public Services',area:'Public services',attendance:48,concernCode:'external_environment',status:'Potential withdrawal review',reason:'Multiple support routes have been discussed and the learner is considering leaving education; no system-generated withdrawal outcome is permitted.',qualifications:'Retained only as contextual evidence in the synthetic case.',entryRequirement:'Not applicable to the withdrawal review.',promonitor:'Actions and discussions recorded pending group review (synthetic)',recommended:'Refer the potential full withdrawal to the Student Recruitment Group for a human decision and record the outcome.',outcome:'potential_withdrawal',transferAppropriate:false,transferAgreed:false,skills:['Teamwork','Communication'],interests:['Employment exploration'],alternatives:[],reciprocal:null,history:['23 Aug - concern recorded','28 Aug - support routes reviewed','2 Sep - Student Recruitment Group review required']}
];

const retentionState={selected:RETENTION_LEARNERS[0],evidenceTab:'intervention',optimised:false,selectedAlternative:0};

function renderRetentionQueue(){
  const query=$('#learner-search').value.trim().toLowerCase();
  const concern=$('#concern-filter').value;
  const area=$('#area-filter').value;
  const status=$('#status-filter').value;
  const learners=RETENTION_LEARNERS.filter(l=>(!query||`${l.name} ${l.id}`.toLowerCase().includes(query))&&(concern==='All concerns'||interventionFor(l.concernCode).label===concern)&&(area==='All areas'||l.area===area)&&(status==='All statuses'||l.status===status));
  $('#queue-count').textContent=`${learners.length} learner${learners.length===1?'':'s'}`;
  $('#learner-queue').innerHTML=learners.map((l,index)=>`<button type="button" class="learner-row ${l.id===retentionState.selected.id?'active':''}" data-learner="${l.id}" role="option" aria-selected="${l.id===retentionState.selected.id}"><span class="priority">${index+1}</span><span><strong>${escapeHtml(l.name)}</strong><small>${l.id} · Day ${l.day} · ${escapeHtml(interventionFor(l.concernCode).label)}</small></span><span><small>${escapeHtml(l.programme)}</small><b class="risk ${l.risk.toLowerCase()}">${escapeHtml(l.status)}</b></span></button>`).join('')||'<p class="empty-state">No synthetic learners match these filters.</p>';
  $$('[data-learner]').forEach(button=>button.addEventListener('click',()=>{retentionState.selected=RETENTION_LEARNERS.find(l=>l.id===button.dataset.learner);retentionState.evidenceTab='intervention';retentionState.optimised=false;retentionState.selectedAlternative=0;renderRetention()}));
}

function renderDiagnosis(){
  const l=retentionState.selected;
  const intervention=interventionFor(l.concernCode);
  $('#selected-name').textContent=l.name;$('#selected-day').textContent=`Day ${l.day} of ${$('#qualifying-period').value}`;$('#selected-programme').textContent=l.programme;
  $('#concern-summary').textContent=l.reason;
  $('#case-facts').innerHTML=`<span><small>Concern</small><strong>${escapeHtml(intervention.label)}</strong></span><span><small>Status</small><strong>${escapeHtml(l.status)}</strong></span><span><small>Curriculum area</small><strong>${escapeHtml(l.area)}</strong></span><span><small>Attendance</small><strong>${l.attendance}%</strong></span>`;
  $('#diagnosis-content').innerHTML=`<div><small>Possible intervention</small><strong>${escapeHtml(intervention.action)}</strong></div><div><small>Suggested next action</small><strong>${escapeHtml(l.recommended)}</strong></div><div><small>Responsible College role / team</small><strong>${escapeHtml(intervention.owner)}</strong></div><div><small>Current supported outcome</small><strong>${escapeHtml(outcomeLabel(l.outcome))}</strong></div>`;
  $('#monitor-learner').textContent='Update review status';
  $('#start-conversation').textContent='Record supportive conversation';
}

function renderEvidence(){
  const l=retentionState.selected;
  const optionState=alternativesState(l);
  if(retentionState.evidenceTab==='alternatives'){
    if(!optionState.visible){
      $('#evidence-content').innerHTML=`<div class="dormant-options"><strong>${escapeHtml(optionState.label)}</strong><p>${escapeHtml(optionState.reason)}</p><small>${l.alternatives.length?`${Math.min(l.alternatives.length,3)} warm-start contingency option(s) are precomputed but intentionally not shown as recommendations.`:'No course alternatives are needed for this pathway.'}</small></div>`;
    }else{
      $('#evidence-content').innerHTML=`<div class="warm-list">${warmStartAlternatives(l.alternatives).map(a=>`<article><span>${a.order}</span><div><strong>${escapeHtml(a.title)}</strong><small>${escapeHtml(a.entry)} · Capacity: ${escapeHtml(a.capacity)}</small><em>Potential alternative · human review required</em></div></article>`).join('')}</div>`;
    }
  }else if(retentionState.evidenceTab==='history'){
    $('#evidence-content').innerHTML=`<ol class="evidence-history">${l.history.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol><p class="method-note">Synthetic events for workflow testing. In an authorised service, decisions and status changes would require an agreed audit trail.</p>`;
  }else if(retentionState.evidenceTab==='promonitor'){
    $('#evidence-content').innerHTML=`<h4>Intention to Transfer status</h4><p>${escapeHtml(l.promonitor)}</p><p class="method-note"><strong>Record, not request.</strong> The ProMonitor Intention to Transfer comment records action, discussion and progress. It does not request or enact a transfer. Assistant Principals, Curriculum Leads and Careers Guidance use this information to track the 42-day cohort.</p><p class="method-note"><strong>Potential integration / subject to technical validation.</strong> This static prototype has no verified live ProMonitor API or connection.</p>`;
  }else{
    const withdrawal=withdrawalReviewPath(l);
    $('#evidence-content').innerHTML=`<h4>What is the right intervention?</h4><p>${escapeHtml(l.recommended)}</p>${withdrawal.length?`<div class="withdrawal-path"><strong>${withdrawal.map(escapeHtml).join(' → ')}</strong><small>Full withdrawal is reviewed; it is not generated by this system.</small></div>`:''}<h4>Qualifications and entry requirements</h4><p><strong>Qualifications:</strong> ${escapeHtml(l.qualifications)}</p><p><strong>Entry requirements:</strong> ${escapeHtml(l.entryRequirement)}</p><p class="method-note">The application supports people making decisions. It does not make the decision, and no protected characteristic is used to rank options.</p>`;
  }
  $$('.evidence-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.evidenceTab===retentionState.evidenceTab));
}

function renderTransfer(){
  const l=retentionState.selected;
  const state=alternativesState(l);
  const panel=$('#transfer-panel');
  panel.classList.toggle('dormant',!state.visible);
  $('#transfer-state').textContent=state.visible?(l.transferAgreed?'Transfer handoff ready':'Human review required'):'Dormant - transfer not indicated';
  if(!state.visible){
    $('#transfer-content').innerHTML=`<div class="dormant-options"><strong>Course Matcher remains in the background.</strong><p>${escapeHtml(state.reason)}</p><small>Warm-start options are contingency information, not recommendations to move the learner.</small></div>`;
    return;
  }
  const options=warmStartAlternatives(l.alternatives);
  const selected=options[Math.min(retentionState.selectedAlternative,options.length-1)];
  let handoff='';
  if(l.transferAgreed){
    const h=buildTransferHandoff(l,selected);
    handoff=`<div class="handoff-card"><div><p class="step-kicker">${escapeHtml(h.state)}</p><h4>Reviewed information for Student Recruitment</h4></div><dl><div><dt>Student Name</dt><dd>${escapeHtml(h.studentName)}</dd></div><div><dt>Student ID</dt><dd>${escapeHtml(h.studentId)}</dd></div><div><dt>Course Code transferring to</dt><dd>${escapeHtml(h.courseCode)}</dd></div><div><dt>Group</dt><dd>${escapeHtml(h.group)}</dd></div><div><dt>Start Date</dt><dd>${escapeHtml(h.startDate)}</dd></div></dl><p>Demonstration state only. Nothing has been emailed, written to ProMonitor or transferred automatically.</p></div>`;
  }else{
    handoff='<button class="primary agree-transfer" id="agree-transfer" type="button">Demonstrate human transfer agreement</button><p class="method-note">Requires learner discussion, Curriculum Lead review and confirmation of entry, compliance and capacity.</p>';
  }
  $('#transfer-content').innerHTML=`<div class="transfer-layout"><div><h4>Potential alternatives</h4><div class="alternative-grid">${options.map((a,index)=>`<button type="button" class="alternative-card ${index===retentionState.selectedAlternative?'selected':''}" data-alternative="${index}"><small>Potential alternative ${a.order}</small><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.entry)}</span><span>Capacity: ${escapeHtml(a.capacity)}</span></button>`).join('')}</div><div class="skills-topology"><span><small>Current programme</small>${escapeHtml(l.programme)}</span><i>→</i><span><small>Transferable skills</small>${l.skills.map(escapeHtml).join(' · ')}</span><i>→</i><span><small>Potential destination</small>${escapeHtml(selected.title)}</span></div></div><article class="alternative-detail"><p class="step-kicker">KNOWN / LIKELY / REQUIRES HUMAN CHECK</p><h4>${escapeHtml(selected.title)}</h4><dl><div><dt>Subject / skills overlap</dt><dd>${escapeHtml(selected.overlap)}</dd></div><div><dt>Career alignment</dt><dd>${escapeHtml(selected.career)}</dd></div><div><dt>Curriculum area / level</dt><dd>${escapeHtml(selected.area)} / ${escapeHtml(selected.level)}</dd></div><div><dt>Capacity</dt><dd>${escapeHtml(selected.capacity)}</dd></div><div><dt>Compliance / eligibility</dt><dd>${escapeHtml(selected.compliance)}</dd></div><div><dt>Why it may fit</dt><dd>${escapeHtml(selected.why)}</dd></div></dl>${handoff}</article></div>`;
  $$('[data-alternative]').forEach(button=>button.addEventListener('click',()=>{retentionState.selectedAlternative=Number(button.dataset.alternative);renderTransfer()}));
  $('#agree-transfer')?.addEventListener('click',()=>{l.transferAgreed=true;l.outcome='internal_transfer';l.status='Transfer agreed';renderRetention()});
}

function renderReciprocal(){
  const l=retentionState.selected;
  const content=$('#reciprocal-content');
  const allowed=capacityOptimisationAllowed({learnerSuitability:l.transferAppropriate,entryCompliance:l.transferAgreed,learnerChoice:l.transferAgreed,humanApproval:l.transferAgreed});
  if(!retentionState.optimised||!allowed||!l.reciprocal){content.innerHTML=`<div class="no-reciprocal"><strong>Capacity modelling waits until learner-fit decisions are complete.</strong><p>${l.reciprocal?'This synthetic case has a possible backfill relationship, but it remains unavailable until suitability, entry/compliance, learner choice and human approval are all confirmed.':'No reciprocal scenario is needed for this selected learner.'}</p></div>`;return}
  const [other,otherCurrent,otherProposed]=l.reciprocal;
  content.innerHTML=`<article><small>Learner-approved destination</small><strong>${escapeHtml(l.name)}</strong><span>${escapeHtml(l.alternatives[0].title)}</span><b>Capacity requires live human confirmation</b></article><span class="swap-label">Possible backfill after fit</span><article><small>Synthetic backfill case</small><strong>${escapeHtml(other)}</strong><span>${escapeHtml(otherCurrent)} → ${escapeHtml(otherProposed)}</span><b>Suitability and eligibility still required</b></article><article><small>Safety order</small><strong>Learner first</strong><span>Capacity never creates the recommendation.</span><b>Human approval retained</b><small>Indicative funding-equivalent: £0 net modelled change - institutional planning comparison only.</small></article>`;
}

function renderRetention(){renderRetentionQueue();renderDiagnosis();renderEvidence();renderTransfer();renderReciprocal()}

['learner-search','concern-filter','area-filter','status-filter'].forEach(id=>$('#'+id).addEventListener(id==='learner-search'?'input':'change',renderRetentionQueue));
$('#qualifying-period').addEventListener('change',()=>{renderDiagnosis();renderEvidence()});
$$('[data-evidence-tab]').forEach(b=>b.addEventListener('click',()=>{retentionState.evidenceTab=b.dataset.evidenceTab;renderEvidence()}));
$$('.retention-nav').forEach(b=>b.addEventListener('click',()=>{$$('.retention-nav').forEach(x=>x.classList.toggle('active',x===b));const targets={learners:'.attention-panel',transfer:'.transfer-panel',capacity:'.reciprocal-panel',pilot:'.pilot-kpis',overview:'.retention-kpis'};document.querySelector(targets[b.dataset.dashboardView])?.scrollIntoView({behavior:'smooth',block:'center'})}));
$('#optimise-scenario').addEventListener('click',()=>{retentionState.optimised=true;renderReciprocal();$('#optimise-scenario').textContent='Capacity check demonstrated';});
$('#monitor-learner').addEventListener('click',()=>{retentionState.selected.status='Monitoring';$('#monitor-learner').textContent='Review status updated in demo';renderRetentionQueue();renderDiagnosis()});
$('#start-conversation').addEventListener('click',()=>{retentionState.selected.status='Supportive conversation';$('#start-conversation').textContent='Conversation recorded in demo';renderRetentionQueue();renderDiagnosis()});
renderRetention();
