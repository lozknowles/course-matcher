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
// 42-day student fit and retention management prototype
// ---------------------------------------------------------------------------
// All records below are deliberately synthetic and cannot be written back to
// a college system. Recommendations expose their evidence and remain subject
// to a human conversation and the normal admissions process.
const RETENTION_LEARNERS=[
  {id:'SYN-1042',name:'Maya Thompson',day:23,period:42,risk:'High',fit:'Fair',programme:'Level 3 Health & Social Care',campus:'Lincoln',area:'Health & care',attendance:68,skills:['Empathy','Communication','Organisation'],interests:['Caring for people','Mental health','Community support'],reason:'Attendance is below the synthetic early-engagement benchmark and assessment confidence is incomplete.',alternatives:[['T Level Health (Adult Nursing)','Good','6 spaces'],['BTEC Applied Psychology','Good','4 spaces'],['BTEC Early Years Educator','Fair','5 spaces']],close:'A Level Psychology — mathematics grade is one below the mandatory criterion.',reciprocal:['Taylor Green','Level 3 Business','Level 3 Health & Social Care'],history:['19 Aug · Tutor concern recorded','22 Aug · Attendance pattern reviewed','27 Aug · Student interests reconfirmed']},
  {id:'SYN-1088',name:'Alex Nguyen',day:18,period:42,risk:'High',fit:'Poor',programme:'Level 3 Engineering',campus:'Lincoln',area:'Engineering',attendance:61,skills:['Problem solving','CAD','Numeracy'],interests:['Designing products','Technology','Practical projects'],reason:'Low workshop participation and a sustained preference for software-led design suggest a fit conversation.',alternatives:[['T Level Digital Production','Good','7 spaces'],['Level 3 Computing','Good','3 spaces'],['Level 3 Design & Development','Fair','2 spaces']],close:'A Level Computer Science — GCSE English evidence is incomplete.',reciprocal:['Omar Ali','Level 3 Digital','Level 3 Engineering'],history:['16 Aug · Workshop engagement flagged','21 Aug · Careers preference updated','28 Aug · Tutor review requested']},
  {id:'SYN-1116',name:'Jordan Clarke',day:17,period:42,risk:'Medium',fit:'Fair',programme:'A Level Biology',campus:'Lincoln',area:'Health & care',attendance:76,skills:['Scientific method','Analysis','Teamwork'],interests:['Laboratory work','Health science','Practical learning'],reason:'Academic potential is evident, but the learner reports a strong preference for applied and practical assessment.',alternatives:[['BTEC Applied Science','Good','5 spaces'],['T Level Laboratory Science','Good','4 spaces'],['Level 3 Health & Social Care','Fair','5 spaces']],close:'T Level Health (Adult Nursing) — placement suitability still needs confirmation.',reciprocal:null,history:['18 Aug · Learning preference captured','24 Aug · Assessment pattern reviewed','29 Aug · Curriculum comparison prepared']},
  {id:'SYN-1171',name:'Riya Shah',day:16,period:42,risk:'Monitor',fit:'Good',programme:'T Level Digital Production',campus:'Newark',area:'Digital',attendance:91,skills:['Coding','Collaboration','UX thinking'],interests:['Web products','Data','User experience'],reason:'Positive engagement and attendance. No transfer is recommended; retain and monitor.',alternatives:[['Remain on current programme','Good','Recommended'],['Level 3 Computing','Good','4 spaces'],['Level 3 Business','Fair','6 spaces']],close:'No blocked close match.',reciprocal:null,history:['15 Aug · Strong induction engagement','23 Aug · Positive tutor note','29 Aug · Remain-and-monitor recommendation']},
  {id:'SYN-1210',name:'Ethan Williams',day:15,period:42,risk:'Medium',fit:'Fair',programme:'Level 3 Sport',campus:'Lincoln',area:'Sport',attendance:74,skills:['Coaching','Leadership','Communication'],interests:['Fitness','Working with young people','Community sport'],reason:'Attendance is variable and career intent aligns more strongly with coaching and education.',alternatives:[['Sport Coaching & Development','Good','8 spaces'],['Public Services','Fair','6 spaces'],['Early Years Educator','Fair','5 spaces']],close:'T Level Education — English criterion needs checking.',reciprocal:['Mia Thompson','T Level Education','Level 3 Sport'],history:['17 Aug · Career intent added','25 Aug · Attendance discussion','30 Aug · Alternatives prepared']}
];

const retentionState={selected:RETENTION_LEARNERS[0],evidenceTab:'evidence',topology:'skills',optimised:false};

function renderRetentionQueue(){
  const query=$('#learner-search').value.trim().toLowerCase();
  const risk=$('#risk-filter').value;
  const area=$('#area-filter').value;
  const campus=$('#campus-filter').value;
  const learners=RETENTION_LEARNERS.filter(l=>(!query||`${l.name} ${l.id}`.toLowerCase().includes(query))&&(risk==='All risk levels'||l.risk===risk)&&(area==='All areas'||l.area===area)&&(campus==='All campuses'||l.campus===campus));
  $('#queue-count').textContent=`${learners.length} learner${learners.length===1?'':'s'}`;
  $('#learner-queue').innerHTML=learners.map((l,index)=>`<button type="button" class="learner-row ${l.id===retentionState.selected.id?'active':''}" data-learner="${l.id}" role="option" aria-selected="${l.id===retentionState.selected.id}"><span class="priority">${index+1}</span><span><strong>${escapeHtml(l.name)}</strong><small>${l.id} · Day ${l.day}</small></span><span><small>${escapeHtml(l.programme)}</small><b class="risk ${l.risk.toLowerCase()}">${l.risk}</b></span></button>`).join('')||'<p class="empty-state">No synthetic learners match these filters.</p>';
  $$('[data-learner]').forEach(button=>button.addEventListener('click',()=>{retentionState.selected=RETENTION_LEARNERS.find(l=>l.id===button.dataset.learner);retentionState.optimised=false;renderRetention()}));
}

function renderTopology(){
  const l=retentionState.selected;
  const middle=retentionState.topology==='skills'?l.skills:l.interests;
  $('#topology').innerHTML=`<div class="topology-course current-course"><small>Current programme</small><strong>${escapeHtml(l.programme)}</strong><span>Fit: ${l.fit}</span></div><div class="topology-bridge"><small>${retentionState.topology==='skills'?'Transferable evidence':'Learner intent'}</small>${middle.map(item=>`<span>${escapeHtml(item)}</span>`).join('')}</div><div class="topology-destinations">${l.alternatives.map((a,i)=>`<div class="topology-course ${i<2?'warm-course':'close-course'}"><small>${i<2?'Warm alternative':'Alternative'}</small><strong>${escapeHtml(a[0])}</strong><span>Fit: ${a[1]} · ${a[2]}</span></div>`).join('')}</div>`;
}

function renderEvidence(){
  const l=retentionState.selected;
  $('#selected-name').textContent=l.name;$('#selected-day').textContent=`Day ${l.day} of ${$('#qualifying-period').value}`;$('#selected-programme').textContent=l.programme;
  if(retentionState.evidenceTab==='alternatives'){
    $('#evidence-content').innerHTML=`<div class="warm-list">${l.alternatives.map((a,i)=>`<article><span>${i+1}</span><div><strong>${escapeHtml(a[0])}</strong><small>Fit: ${a[1]} · Capacity: ${a[2]}</small></div></article>`).join('')}</div><div class="close-match"><strong>Close match—not currently eligible</strong><p>${escapeHtml(l.close)}</p></div>`;
  }else if(retentionState.evidenceTab==='history'){
    $('#evidence-content').innerHTML=`<ol class="evidence-history">${l.history.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ol><p class="method-note">Synthetic events shown for workflow testing. Every recommendation change would be retained in an audit trail.</p>`;
  }else{
    $('#evidence-content').innerHTML=`<div class="fit-summary"><span>Current fit <strong>${l.fit}</strong></span><span>Risk <strong>${l.risk}</strong></span><span>Attendance <strong>${l.attendance}%</strong></span></div><h4>Why this is surfaced</h4><p>${escapeHtml(l.reason)}</p><h4>Evidence used</h4><ul>${l.skills.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul><p class="method-note">No protected characteristic is used to rank alternatives.</p>`;
  }
  $$('.evidence-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.evidenceTab===retentionState.evidenceTab));
}

function renderReciprocal(){
  const l=retentionState.selected;
  const content=$('#reciprocal-content');
  if(!l.reciprocal){content.innerHTML=`<div class="no-reciprocal"><strong>No safe reciprocal move suggested</strong><p>${l.risk==='Monitor'?'The evidence supports remaining on the current programme.':'A suitable learner-to-capacity chain has not been identified; continue with the learner-fit conversation only.'}</p></div>`;$('#funding-value').textContent='Not modelled';return}
  const [other,otherCurrent,otherProposed]=l.reciprocal;
  content.innerHTML=`<article><small>Current</small><strong>${escapeHtml(l.name)}</strong><span>${escapeHtml(l.programme)}</span><b>${retentionState.optimised?'18 / 24':'19 / 24'} places</b></article><span class="swap-label">Potential reciprocal move</span><article><small>Proposed, subject to approval</small><strong>${escapeHtml(l.name)}</strong><span>${escapeHtml(l.alternatives[0][0])}</span><b>${retentionState.optimised?'6':'5'} spaces remain</b></article><article><small>Possible backfill learner</small><strong>${escapeHtml(other)}</strong><span>${escapeHtml(otherCurrent)} → ${escapeHtml(otherProposed)}</span><b>Eligibility check required</b></article>`;
  $('#funding-value').textContent=retentionState.optimised?'£0 net modelled change':'£0 change';
}

function renderRetention(){renderRetentionQueue();renderTopology();renderEvidence();renderReciprocal()}

['learner-search','risk-filter','area-filter','campus-filter'].forEach(id=>$('#'+id).addEventListener(id==='learner-search'?'input':'change',renderRetentionQueue));
$('#qualifying-period').addEventListener('change',()=>{RETENTION_LEARNERS.forEach(l=>l.period=Number($('#qualifying-period').value));renderEvidence()});
$$('[data-topology]').forEach(b=>b.addEventListener('click',()=>{retentionState.topology=b.dataset.topology;$$('[data-topology]').forEach(x=>x.classList.toggle('active',x===b));renderTopology()}));
$$('[data-evidence-tab]').forEach(b=>b.addEventListener('click',()=>{retentionState.evidenceTab=b.dataset.evidenceTab;renderEvidence()}));
$$('.retention-nav').forEach(b=>b.addEventListener('click',()=>{$$('.retention-nav').forEach(x=>x.classList.toggle('active',x===b));const targets={learners:'.attention-panel',reciprocal:'.reciprocal-panel',simulation:'.reciprocal-panel',programmes:'.topology-panel',overview:'.retention-kpis'};document.querySelector(targets[b.dataset.dashboardView])?.scrollIntoView({behavior:'smooth',block:'center'})}));
$('#optimise-scenario').addEventListener('click',()=>{retentionState.optimised=true;renderReciprocal();$('#optimise-scenario').textContent='Safe moves modelled';});
$('#monitor-learner').addEventListener('click',()=>{$('#monitor-learner').textContent='Marked for monitoring';});
$('#start-conversation').addEventListener('click',()=>{$('#start-conversation').textContent='Conversation added to plan';});
renderRetention();
