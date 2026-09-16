import {PROGRAMMES,STAGES,programmeFor,makeCohort,scopeRecords,summary,capacity,trend,advanceRecord,addSample,recordsCsv} from './enrolment-core.js';

const $ = id => document.getElementById(id);
const add = (parent,tag,text,className) => { const node=document.createElement(tag); if(text!=null)node.textContent=text; if(className)node.className=className; parent.append(node); return node; };
const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
const number = value => new Intl.NumberFormat('en-GB').format(value);
let records = [...makeCohort(),...makeCohort('2025/26')],currentView='overview',page=0,reviewId=null;
const scope = () => ({year:$('year-filter').value,campus:$('campus-filter').value});
const filters = () => ({...scope(),programme:$('programme-filter').value,status:$('status-filter').value,query:$('application-search').value});
const scoped = () => scopeRecords(records,scope());
const filtered = () => scopeRecords(records,filters()).sort((a,b)=>b.applied.localeCompare(a.applied)||b.id.localeCompare(a.id));
const announce = message => { $('announcement').textContent=message; };
const stageBadge = (parent,stage) => add(parent,'span',STAGES[stage],`status stage-${stage}`);
const progress = (parent,value,max,colour,label) => { const bar=add(parent,'progress'); bar.value=value;bar.max=max||1;bar.style.setProperty('--progress-color',colour);bar.setAttribute('aria-label',label);return bar; };

function learnerCell(row,record){
  const td=add(row,'td'),button=add(td,'button',null,'name-button');button.type='button';
  const avatar=add(button,'span',record.name.split(' ').map(part=>part[0]).slice(0,2).join(''),'avatar');avatar.setAttribute('aria-hidden','true');
  const name=add(button,'span',null,'learner-text');add(name,'strong',record.name);add(name,'small',record.id);
  button.setAttribute('aria-label',`Review sample application for ${record.name}`);button.addEventListener('click',()=>openReview(record.id));
}
function rowFor(host,record,full=false){
  const row=add(host,'tr');learnerCell(row,record);add(row,'td',programmeFor(record.programme).name);
  if(full)add(row,'td',record.campus);
  add(row,'td',dateLabel(record.applied));stageBadge(add(row,'td'),record.stage);
  if(full){const button=add(add(row,'td'),'button','Review','text-button');button.addEventListener('click',()=>openReview(record.id));button.setAttribute('aria-label',`Open ${record.id}`);}
}
function renderApplications(){
  const rows=filtered(),pageCount=Math.max(1,Math.ceil(rows.length/10));page=Math.max(0,Math.min(page,pageCount-1));
  $('application-rows').replaceChildren();rows.slice(page*10,page*10+10).forEach(record=>rowFor($('application-rows'),record,true));
  if(!rows.length){const cell=add(add($('application-rows'),'tr'),'td','No sample applications match these filters. Try a different name, programme or stage.');cell.colSpan=6;}
  $('application-result-count').textContent=`${number(rows.length)} sample applications · ${scope().year} · ${scope().campus === 'all' ? 'all campuses':scope().campus}`;
  $('page-label').textContent=`Page ${page+1} of ${pageCount}`;$('previous-applications').disabled=page===0;$('next-applications').disabled=page>=pageCount-1;
}
function renderCapacity(rows){
  const data=capacity(rows,scope().campus);$('capacity-list').replaceChildren();$('programme-cards').replaceChildren();
  data.forEach(programme=>{
    const item=add($('capacity-list'),'div',null,'capacity-item'),line=add(item,'div',null,'capacity-line');
    add(line,'span',programme.name);add(line,'span',`${programme.enrolled} / ${programme.places}`);
    const track=add(item,'div',null,'capacity-track');progress(track,programme.enrolled,programme.places,programme.colour,`${programme.name}: ${programme.enrolled} enrolled out of ${programme.places} sample places`);add(track,'span',`${programme.percentage}%`);
    const card=add($('programme-cards'),'article',null,'programme-card');card.style.setProperty('--progress-color',programme.colour);add(card,'h3',programme.name);add(card,'p',`${programme.level} · ${scope().campus === 'all' ? 'Lincoln & Newark':scope().campus}`);
    add(card,'strong',`${programme.enrolled} / ${programme.places}`,'capacity-number');add(card,'p','Sample learners enrolled / illustrative places');
    const bar=add(card,'div',null,'capacity-track');progress(bar,programme.enrolled,programme.places,programme.colour,`${programme.percentage}% of illustrative places filled`);add(bar,'span',`${programme.percentage}%`);
    const pending=rows.filter(record=>record.programme===programme.id && record.stage<2).length;add(card,'p',`${pending} awaiting review · ${Math.max(0,programme.places-programme.enrolled)} sample places remaining`);
    const button=add(card,'button','View applications','secondary');button.addEventListener('click',()=>{$('programme-filter').value=programme.id;$('status-filter').value='all';$('application-search').value='';page=0;setView('applications');});
  });
}
function renderPipeline(totals){
  $('pipeline').replaceChildren();const colours=['#2376a8','#a76b00','#76529b','#087f78'];
  totals.stages.forEach((count,index)=>{const row=add($('pipeline'),'div',null,'pipeline-row'),button=add(row,'button',STAGES[index]);button.addEventListener('click',()=>selectStatus(String(index)));progress(row,count,Math.max(1,totals.applications),colours[index],`${STAGES[index]}: ${count} of ${totals.applications} applications`);add(row,'b',number(count));});
  $('pipeline-note').textContent=`${totals.enrolled} sample learners ready for their next chapter`;
}
function renderChart(){
  const points=trend(scoped()),canvas=$('trend-chart'),box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;
  const scale=window.devicePixelRatio||1;canvas.width=Math.round(box.width*scale);canvas.height=Math.round(box.height*scale);
  const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.clearRect(0,0,box.width,box.height);
  const w=box.width,h=box.height,left=37,right=23,top=16,bottom=29,max=Math.max(50,Math.ceil(Math.max(...points.map(point=>point.applications))/50)*50);
  const x=index=>left+(w-left-right)*index/5,y=value=>h-bottom-(h-top-bottom)*value/max;
  ctx.font='10px Arial';ctx.lineWidth=1;ctx.textAlign='right';ctx.textBaseline='middle';
  for(let tick=0;tick<=4;tick++){const value=max*tick/4;ctx.strokeStyle='#e7eeef';ctx.beginPath();ctx.moveTo(left,y(value));ctx.lineTo(w-right,y(value));ctx.stroke();ctx.fillStyle='#627d8a';ctx.fillText(Math.round(value),left-9,y(value));}
  ctx.textAlign='center';points.forEach((point,index)=>{ctx.fillStyle='#627d8a';ctx.fillText(point.month,x(index),h-9);});
  for(const [key,colour,fill] of [['applications','#087f78','#e8f4f1'],['enrolled','#c41669',null]]){
    if(fill){ctx.beginPath();ctx.moveTo(x(0),y(0));points.forEach((point,index)=>ctx.lineTo(x(index),y(point[key])));ctx.lineTo(x(5),y(0));ctx.closePath();ctx.fillStyle=fill;ctx.fill();}
    ctx.beginPath();points.forEach((point,index)=>index?ctx.lineTo(x(index),y(point[key])):ctx.moveTo(x(index),y(point[key])));ctx.strokeStyle=colour;ctx.lineWidth=2.5;ctx.stroke();
    points.forEach((point,index)=>{ctx.beginPath();ctx.arc(x(index),y(point[key]),3.5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.stroke();});
  }
  $('trend-data').replaceChildren();points.forEach(point=>{const row=add($('trend-data'),'tr');add(row,'th',point.month);add(row,'td',point.applications);add(row,'td',point.enrolled);});
  canvas.setAttribute('aria-label',`Cumulative sample applications from April to September. September: ${points[5].applications} applications, of which ${points[5].enrolled} are now enrolled. A data table and definition follow.`);
}
function render(){
  const rows=scoped(),totals=summary(rows);
  for(const [id,value] of [['applications-total',totals.applications],['offers-total',totals.offers],['enrolled-total',totals.enrolled],['pending-total',totals.pending]])$(id).textContent=number(value);
  $('enrolled-share').textContent=`${totals.applications?Math.round(totals.enrolled/totals.applications*100):0}% of applications`;$('nav-count').textContent=totals.pending;$('intake-year').textContent=scope().year.slice(0,4);
  $('recent-rows').replaceChildren();rows.slice().sort((a,b)=>b.applied.localeCompare(a.applied)||b.id.localeCompare(a.id)).slice(0,5).forEach(record=>rowFor($('recent-rows'),record));
  renderPipeline(totals);renderCapacity(rows);renderApplications();renderChart();
  $('report-summary').textContent=`For ${scope().year}, ${scope().campus==='all'?'both campuses':scope().campus} have ${totals.applications} sample applications. ${totals.offers} have reached an offer, ${totals.enrolled} are enrolled and ${totals.pending} are awaiting review.`;
}
function setView(next,focus=true){
  if(!['overview','applications','programmes','reports'].includes(next))return;currentView=next;
  document.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==next);
  document.querySelectorAll('.sidebar [data-view]').forEach(button=>{if(button.dataset.view===next)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  const titles={overview:['Student enrolment','Every application. A clearer next step.'],applications:['Applications','Find a learner. Keep their next step moving.'],programmes:['Programme capacity','A clear view of enrolment and remaining places.'],reports:['Intake reports','Bring the sample intake into one useful view.']};
  $('page-title').textContent=titles[next][0];$('page-description').textContent=titles[next][1];render();
  if(focus){$('page-title').tabIndex=-1;$('page-title').focus({preventScroll:true});$('main').scrollIntoView({block:'start'});}
}
function selectStatus(status){$('status-filter').value=status;$('programme-filter').value='all';$('application-search').value='';page=0;setView('applications');}
function reviewRecord(){return records.find(record=>record.id===reviewId);}
function checklistComplete(){return ['check-results','check-contact','check-choice'].every(id=>$(id).checked);}
function updateAdvanceButton(){const record=reviewRecord();if(!record)return;$('advance-application').disabled=record.stage>=3 || (record.stage>=1&&!checklistComplete());}
function populateReview(){
  const record=reviewRecord();if(!record)return;$('review-title').textContent=record.name;$('review-reference').textContent=`${record.id} · Fictional learner`;$('review-feedback').textContent='';
  $('review-details').replaceChildren();[['Programme',programmeFor(record.programme).name],['Campus',record.campus],['Intake',record.year],['Current stage',STAGES[record.stage]]].forEach(([label,value])=>{add($('review-details'),'dt',label);add($('review-details'),'dd',value);});
  $('review-history').replaceChildren();record.history.forEach(event=>add($('review-history'),'li',`${dateLabel(event.date)} — ${event.label}`));
  $('review-checklist').hidden=record.stage===0||record.stage===3;
  for(const id of ['check-results','check-contact','check-choice'])$(id).checked=record.checked;
  $('advance-application').textContent=['Start sample review','Record sample offer','Confirm sample enrolment','Sample enrolled'][record.stage];updateAdvanceButton();
}
function openReview(id){reviewId=id;populateReview();$('review-dialog').showModal();}

for(const id of ['programme-filter','sample-programme'])PROGRAMMES.forEach(programme=>$(id).append(new Option(programme.name,programme.id)));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.querySelectorAll('[data-status]').forEach(button=>button.addEventListener('click',()=>selectStatus(button.dataset.status)));
for(const id of ['year-filter','campus-filter'])$(id).addEventListener('change',()=>{page=0;render();announce(`Showing ${scope().year} · ${scope().campus === 'all'?'all campuses':scope().campus}.`);});
for(const id of ['application-search','programme-filter','status-filter'])$(id).addEventListener(id==='application-search'?'input':'change',()=>{page=0;renderApplications();});
$('previous-applications').addEventListener('click',()=>{page--;renderApplications();});$('next-applications').addEventListener('click',()=>{page++;renderApplications();});
$('new-application').addEventListener('click',()=>{$('sample-campus').value=scope().campus==='all'?'Lincoln':scope().campus;$('sample-intake').textContent=`Academic year ${scope().year}. A fictional name and reference will be generated.`;$('application-dialog').showModal();});
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
$('application-form').addEventListener('submit',event=>{event.preventDefault();const result=addSample(records,{year:scope().year,campus:$('sample-campus').value,programme:$('sample-programme').value});records=result.records;$('campus-filter').value='all';$('application-dialog').close();selectStatus('0');announce(`${result.record.name} created. Open Review to follow the sample application through to enrolment.`);});
for(const id of ['check-results','check-contact','check-choice'])$(id).addEventListener('change',updateAdvanceButton);
$('advance-application').addEventListener('click',()=>{try{const updated=advanceRecord(reviewRecord(),{checked:checklistComplete()});records=records.map(record=>record.id===updated.id?updated:record);populateReview();render();$('review-feedback').textContent=`Sample status updated to ${STAGES[updated.stage].toLowerCase()}.`;announce(`${updated.name}: ${STAGES[updated.stage]}. Dashboard totals updated.`);}catch(error){$('review-feedback').textContent=error.message;}});
document.querySelectorAll('.export-records').forEach(button=>button.addEventListener('click',()=>{const data=filtered(),url=URL.createObjectURL(new Blob([recordsCsv(data)],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`lincoln-demo6-synthetic-${scope().year.replace('/','-')}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);announce(`Exported ${data.length} synthetic applications for the current filters.`);}));
$('reset-demo').addEventListener('click',()=>{records=[...makeCohort(),...makeCohort('2025/26')];$('year-filter').value='2026/27';$('campus-filter').value='all';$('programme-filter').value='all';$('status-filter').value='all';$('application-search').value='';page=0;setView('overview');announce('Original sample data restored.');});
new ResizeObserver(()=>{if(currentView==='overview')renderChart();}).observe($('trend-chart').parentElement);
render();
