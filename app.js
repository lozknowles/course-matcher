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
import { normaliseGrades, parseResultsText, rankCourses, matchCourse, validateGrades, RECOGNISED_GCSE_SUBJECTS } from './matcher-core.js';
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
}
$$('.tab').forEach(t=>t.addEventListener('click',()=>setMode(t.dataset.mode)));

function setStep(n){ $$('.step').forEach(s=>s.classList.toggle('active',Number(s.dataset.step)===n)); }
function showStudentPanel(id, step){ ['results-entry','verify-panel','interest-panel','matches-panel'].forEach(x=>$('#'+x).classList.toggle('hidden',x!==id)); setStep(step); $('#'+id).scrollIntoView({behavior:'smooth',block:'start'}); }

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
$('#confirm-grades').addEventListener('click',()=>{readVerify();if(!state.grades.length||!verifiedGradesAreValid())return;showStudentPanel('interest-panel',3)});
$$('[data-back]').forEach(b=>b.addEventListener('click',()=>showStudentPanel(b.dataset.back,b.dataset.back==='results-entry'?1:2)));

// ---------------------------------------------------------------------------
// Student interests and course matching
// ---------------------------------------------------------------------------
SUBJECTS.forEach(subject=>{const b=document.createElement('button');b.className='chip';b.type='button';b.textContent=subject;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>{const on=b.getAttribute('aria-pressed')==='true';b.setAttribute('aria-pressed',String(!on));if(on)state.interests.delete(subject);else state.interests.add(subject)});$('#interest-chips').appendChild(b)});

$('#run-match').addEventListener('click',()=>{readVerify();if(!verifiedGradesAreValid()){showStudentPanel('verify-panel',2);return}renderMatches();showStudentPanel('matches-panel',4)});
$('#edit-results').addEventListener('click',()=>showStudentPanel('verify-panel',2));

/** Render the explainable course results produced by matcher-core.js. */
function renderMatches(){
  const ranked=rankCourses(state.grades,COURSES,[...state.interests],$('#career-text').value);
  const greens=ranked.filter(x=>x.status==='green').length; const ambers=ranked.filter(x=>x.status==='amber').length;
  $('#match-summary').textContent=`${ranked.length} encoded course${ranked.length===1?'':'s'} shown · ${greens} likely grade match${greens===1?'':'es'} · ${ambers} need closer checking.`;
  const list=$('#match-list');list.innerHTML='';
  ranked.forEach(result=>{
    const c=result.course; const card=document.createElement('article');card.className=`match-card ${result.status}`;
    const statusText={green:'Likely meets encoded grades',amber:'Near match / needs checking',red:'Does not meet encoded grades'}[result.status];
    card.innerHTML=`<div class="match-top"><div><span class="badge ${result.status}">${statusText}</span><h3>${c.title}</h3><p class="course-meta">${c.subject} · Level ${c.level||'Entry'} · ${c.campus}</p></div><div class="course-meta">Criteria checked ${c.checked}</div></div><p>${c.summary}</p><div class="checks">${result.checks.map(x=>`<div class="check ${x.pass?'pass':'fail'}"><strong>${x.label}</strong> — ${x.detail}</div>`).join('')}</div>${result.warnings.length?`<div class="warning-list"><strong>Still needs a human check</strong><ul>${result.warnings.map(w=>`<li>${w}</li>`).join('')}</ul></div>`:''}<p><a class="course-link" href="${c.url}" target="_blank" rel="noreferrer">Verify on official Lincoln College page ↗</a></p>`;
    list.appendChild(card);
  });
  if(!ranked.length) list.innerHTML='<div class="panel"><h3>No encoded courses matched those interests</h3><p>Try broadening the interests or use the official subject links below. This prototype deliberately does not invent eligibility rules for courses it has not encoded.</p></div>';
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
