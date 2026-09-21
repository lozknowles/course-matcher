import { COURSES } from './courses.js';
import { matchCourse, rankCourses, validateGrades } from './matcher-core.js';

export const STORAGE_KEY = 'lincoln-digital-journey-v1';
export const STEPS = [
  ['Discover','Find out about us','Find a course that feels like you'],
  ['Open Day','Open Days','Come and picture yourself here'],
  ['Apply','Apply online','Your next chapter starts with an application'],
  ['Your portal','We’ll contact you','Everything you need, in one place'],
  ['Welcome','Attend a Welcome Day','Meet your people'],
  ['Prepare','While you wait','Small steps towards a big beginning'],
  ['Application','Complete your application','A few final details'],
  ['Results','Get your results','Let’s see where your results can take you'],
  ['Enrolment','Attend your Enrolment Day','Let’s get you ready for college'],
  ['Student','Your career starts here','Welcome to your next chapter']
].map(([short,title,subtitle],i)=>({id:i+1,short,title,subtitle}));
export const STATUS = ['NOT_STARTED','AVAILABLE','IN_PROGRESS','ACTION_REQUIRED','COMPLETE'];
export const INTEGRATIONS = [
  ['WORKING','Course matching','Shared Course Matcher rules, exact subject/grade checks and editable verification. Snapshot checked 24 August 2026; current admissions requirements need college confirmation.'],
  ['WORKING','Career information','Existing Skills England and ONS reference explorer. Published snapshots with their own coverage and quality notes.'],
  ['PROTOTYPE','Student journey and capture','Browser state, local OCR, manual evidence classification and review. Files stay in this browser session; only form data and evidence descriptions are saved locally.'],
  ['SIMULATED','College events and identity checks','Bookings, messages, offers, staff identity review and enrolment confirmation use fictional Jamie Taylor records. No email or booking is sent.'],
  ['SIMULATED','DfE request and learner share','Demonstrates the published request/share pattern with a fictional education record. No DfE authentication or API call.'],
  ['PROPOSED','ProSolution handoff','Validated prototype payload awaits a supported college workflow, approved import/export or documented API. No endpoint or database write is implemented. Staff verification remains required.'],
  ['REQUIRES VALIDATION','DfE / QR and identity mapping','QR scanner demonstration accepts only the local DEMO-JAMIE-2027 token. DfE QR semantics, access, supported MIS integration, identity mapping and permissions require confirmation.']
];
export const OPEN_DAYS = [
  {id:'lincoln',title:'Lincoln campus discovery afternoon',date:'2027-03-18',time:'16:00–19:00',campus:'Lincoln',area:'Computing, engineering, creative and care subjects'},
  {id:'newark',title:'Newark campus open morning',date:'2027-04-17',time:'10:00–13:00',campus:'Newark',area:'Meet the team and explore campus options'}
];
export const DEMO_RESULTS = {
  standard:[['Mathematics','6'],['English Language','5'],['Biology','6'],['Chemistry','6'],['Physics','5']],
  alternatives:[['Mathematics','3'],['English Language','3'],['Biology','4'],['Chemistry','3'],['Physics','4']]
};
export const courseFor = state => COURSES.find(c=>c.id===state.courseId) || COURSES.find(c=>c.id==='computing-l3');
export const resultRows = scenario => DEMO_RESULTS[scenario==='alternatives'?'alternatives':'standard'].map(([subject,grade])=>({subject,grade,qualification:'GCSE'}));
const clone = data => structuredClone(data);
const clean = value => String(value ?? '').trim().slice(0,500);
const requireThat = (condition,message) => { if (!condition) throw new Error(message); };

export function createJourney(scenario='standard',now=new Date().toISOString()) {
  return {version:1,scenario:scenario==='alternatives'?'alternatives':'standard',createdAt:now,updatedAt:now,view:1,
    student:{id:'DEMO-JAMIE-2027',firstName:'Jamie',lastName:'Taylor',email:'jamie.taylor@example.test',mobile:'07700 900321',school:'Example Community School',support:'I would like to discuss support at Welcome Day.'},
    courseId:'computing-l3',originalCourseId:'computing-l3',savedCourses:[],interests:['Computing'],predicted:resultRows('standard'),matched:false,
    application:{submittedAt:null,reviewed:false,declarations:false},offer:{issuedAt:null,read:false},
    preparation:{checklist:[],complete:false},documents:{photo:null,identity:null},education:{confirmed:false,dfe:'not-requested'},
    qualifications:{rows:[],confirmedAt:null,source:'',revision:0},careersRequest:null,
    events:{openDay:null,welcomeAttendedAt:null},messages:[],
    enrolment:{checkedInAt:null,identityChecked:false,courseConfirmed:false,contactConfirmed:false,declarations:false,readyAt:null,completedAt:null,inductionViewed:false},
    activity:[{id:1,type:'journey.started',label:'Your journey started',at:now,simulated:true}],tasks:[]};
}

export function assessResults(state) {
  if (!state.qualifications.confirmedAt) return {kind:'pending',label:'Confirm your results first',checks:[],warnings:[],alternatives:[]};
  const rows=state.qualifications.rows;
  const result=matchCourse(rows,courseFor(state));
  const unsupported=rows.some(r=>r.qualification!=='GCSE');
  const kind=unsupported || result.inputIssues.length || courseFor(state).rule.manualOnly ? 'review' : result.hardFailures ? 'options' : 'satisfied';
  return {...result,kind,label:{review:'We need to check your results',options:'Let’s look at your options',satisfied:'Requirements appear satisfied'}[kind],
    alternatives:rankCourses(rows,COURSES,['Computing']).filter(r=>r.status==='green'&&r.course.id!==state.courseId).slice(0,3)};
}

export function applicationChecklist(state) {
  return [
    {key:'photo',label:'Photograph',done:Boolean(state.documents.photo)},
    {key:'identity',label:'Identity evidence',done:Boolean(state.documents.identity)},
    {key:'education',label:'Education history',done:state.education.confirmed},
    {key:'declarations',label:'Application declarations',done:state.application.declarations}
  ];
}
export function enrolmentChecklist(state) {
  const assessment=assessResults(state);
  return [
    {key:'identity',label:'Identity',done:state.enrolment.identityChecked&&Boolean(state.documents.identity)},
    {key:'photo',label:'Photograph',done:Boolean(state.documents.photo)},
    {key:'results',label:'Results',done:Boolean(state.qualifications.confirmedAt)&&(assessment.kind==='satisfied'||Boolean(state.careersRequest?.reviewedAt))},
    {key:'course',label:'Course',done:state.enrolment.courseConfirmed},
    {key:'contact',label:'Contact details',done:state.enrolment.contactConfirmed},
    {key:'education',label:'Education history',done:state.education.confirmed},
    {key:'declarations',label:'Required declarations',done:state.enrolment.declarations}
  ];
}
export function completion(state) {
  return [Boolean(state.matched&&state.savedCourses.length),Boolean(state.events.openDay),Boolean(state.application.submittedAt),Boolean(state.offer.read),Boolean(state.events.welcomeAttendedAt),state.preparation.complete,
    applicationChecklist(state).every(c=>c.done),Boolean(state.qualifications.confirmedAt),Boolean(state.enrolment.completedAt),state.enrolment.inductionViewed];
}
export function currentStep(state) { const index=completion(state).findIndex(done=>!done);return index<0?10:index+1; }
export function journeyStages(state) {
  const done=completion(state),current=currentStep(state);
  return STEPS.map(step=>({...step,status:done[step.id-1]?'COMPLETE':step.id>current?'NOT_STARTED':step.id===current?([7,8,9].includes(step.id)?'ACTION_REQUIRED':step.id===1?'AVAILABLE':'IN_PROGRESS'):'AVAILABLE'}));
}
export function phase(state) { return state.enrolment.completedAt?'Student':state.enrolment.checkedInAt?'Enrolment':state.offer.issuedAt?'Offer holder':state.application.submittedAt?'Applicant':'Prospect'; }
export function outstandingTasks(state) {
  return [...applicationChecklist(state).filter(t=>!t.done).map(t=>({label:`Add ${t.label.toLowerCase()}`,step:7})),...(!state.qualifications.confirmedAt?[{label:'Add and confirm your results',step:8}]:[]),...(state.qualifications.confirmedAt&&assessResults(state).kind!=='satisfied'&&!state.careersRequest?.reviewedAt?[{label:'Discuss your course options with the college',step:8}]:[])];
}
function invalidateEnrolment(state) {state.enrolment.readyAt=null;state.enrolment.completedAt=null;state.enrolment.inductionViewed=false;}
function invalidateResults(state) {state.qualifications.confirmedAt=null;state.qualifications.revision++;state.careersRequest=null;invalidateEnrolment(state);}

export function transition(input,type,data={},now=new Date().toISOString()) {
  const state=clone(input);let label='',simulated=false;
  const gate=stage=>requireThat(completion(state).slice(0,stage-1).every(Boolean),'Complete the earlier steps first, or load a stage example using the demo controls.');
  switch(type) {
    case 'navigate': requireThat(STEPS.some(s=>s.id===Number(data.step)),'Unknown journey step.');state.view=Number(data.step);return state;
    case 'match':
      state.interests=[clean(data.interest||'Computing')];
      if(data.qualification==='other')state.predicted=[];
      else if(data.maths||data.english){state.predicted=resultRows('standard');state.predicted[0].grade=clean(data.maths||'6');state.predicted[1].grade=clean(data.english||'5');}
      state.matched=true;label='Explored courses with Course Matcher';break;
    case 'save-course': requireThat(COURSES.some(c=>c.id===data.id),'Choose a course from the catalogue.');if(!state.savedCourses.includes(data.id))state.savedCourses.push(data.id);state.courseId=data.id;state.originalCourseId=data.id;state.enrolment.courseConfirmed=false;invalidateEnrolment(state);label='Saved a course to your journey';break;
    case 'book-open-day': gate(2);requireThat(OPEN_DAYS.some(e=>e.id===data.id),'Choose an example Open Day.');state.events.openDay={...OPEN_DAYS.find(e=>e.id===data.id),bookedAt:now,simulated:true};label='Open Day booking saved';simulated=true;break;
    case 'save-details': {
      for(const key of ['firstName','lastName','email','mobile','school','support'])if(key in data)state.student[key]=clean(data[key]);
      requireThat(state.student.firstName&&state.student.lastName&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.student.email)&&/^0[0-9 ]{10,14}$/.test(state.student.mobile)&&state.student.school,'Check your name, email, UK phone number and previous school.');
      state.enrolment.contactConfirmed=false;invalidateEnrolment(state);label='Your details updated once for the whole journey';break;
    }
    case 'review-application': gate(3);state.application.reviewed=true;label='Application reviewed';break;
    case 'submit-application': gate(3);requireThat(state.application.reviewed&&data.confirmed===true,'Review and confirm the application before submitting.');state.application.submittedAt=now;state.messages.push({title:'We have your application',body:'Your example application has been received. Your Welcome Day invitation will be here.',at:now,simulated:true});label='Application submitted';simulated=true;break;
    case 'read-offer': gate(4);state.offer={issuedAt:now,read:true};state.messages.push({title:'Your conditional offer',body:'We would love to welcome you. Your place is subject to results, availability and college checks. Welcome Day: 2 July 2027, 10:00, Lincoln campus.',at:now,simulated:true});label='Conditional offer and Welcome Day invitation received';simulated=true;break;
    case 'welcome-attended': gate(5);state.events.welcomeAttendedAt=now;label='Welcome Day attended';simulated=true;break;
    case 'prepare': gate(6);requireThat(data.confirmed===true,'Check your preparation list first.');state.preparation={checklist:['requirements','revision','travel'],complete:true};label='Preparation checklist complete';break;
    case 'document-added': gate(7);requireThat(['photo','identity'].includes(data.kind),'Choose a document type.');requireThat(clean(data.name),'A document name is required.');state.documents[data.kind]={name:clean(data.name),type:clean(data.fileType||'sample'),at:now,synthetic:!!data.synthetic,classification:'Student-selected category',status:'Awaiting college verification'};if(data.kind==='identity')state.enrolment.identityChecked=false;invalidateEnrolment(state);label=`${data.kind==='photo'?'Photograph':'Identity evidence'} added for review`;simulated=!!data.synthetic;break;
    case 'education-confirmed': gate(7);state.education.confirmed=true;invalidateEnrolment(state);label='Education history confirmed';break;
    case 'application-declarations': gate(7);requireThat(data.confirmed===true,'Read and confirm the demo declarations.');state.application.declarations=true;label='Application declarations confirmed';break;
    case 'dfe-request': gate(7);state.education.dfe='requested';label='Example education record request created';simulated=true;break;
    case 'dfe-share': gate(7);requireThat(state.education.dfe==='requested','Create the demo request first.');state.education.dfe='shared';label='Example learner shared their education record';simulated=true;break;
    case 'results-draft': gate(8);requireThat(Array.isArray(data.rows)&&data.rows.length<=40,'Use up to 40 result rows.');state.qualifications.rows=data.rows.map(r=>({subject:clean(r.subject),grade:clean(r.grade),qualification:clean(r.qualification||'GCSE')}));state.qualifications.source=clean(data.source||'Manual entry');invalidateResults(state);label='Results added for your review';simulated=!!data.simulated;break;
    case 'results-confirmed': {
      gate(8);requireThat(data.confirmed===true,'Check every result against the source before confirming.');
      const rows=state.qualifications.rows;requireThat(rows.length&&rows.every(r=>r.subject&&r.grade&&r.qualification),'Complete every result row.');
      const {issues}=validateGrades(rows.filter(r=>r.qualification==='GCSE'));requireThat(!issues.length,issues.map(i=>typeof i==='string'?i:JSON.stringify(i)).join(' ')||'Correct the GCSE results before confirming.');
      state.qualifications.confirmedAt=now;label='Results confirmed by you';break;
    }
    case 'choose-alternative': requireThat(state.qualifications.confirmedAt,'Confirm your results first.');requireThat(assessResults(state).alternatives.some(a=>a.course.id===data.id),'Choose a suggested course to discuss.');state.courseId=data.id;state.enrolment.courseConfirmed=false;invalidateEnrolment(state);state.careersRequest={at:now,reviewedAt:null,courseId:data.id};label='Alternative course added for a careers conversation';simulated=true;break;
    case 'request-careers': requireThat(state.qualifications.confirmedAt,'Confirm your results first.');state.careersRequest={at:now,reviewedAt:null,courseId:state.courseId};label='Careers conversation requested';simulated=true;break;
    case 'staff-results-review': requireThat(state.careersRequest,'Request a careers conversation first.');state.careersRequest.reviewedAt=now;label='Demo staff review completed';simulated=true;break;
    case 'check-in': gate(9);state.enrolment.checkedInAt=now;label='Arrived for enrolment';simulated=true;break;
    case 'scan-demo-qr': requireThat(state.enrolment.checkedInAt,'Start enrolment first.');requireThat(data.token==='DEMO-JAMIE-2027','Only the fictional DEMO-JAMIE-2027 token is accepted. This is not a DfE scanner.');label='Illustrative QR linked to the fictional learner';simulated=true;break;
    case 'enrolment-checks': gate(9);requireThat(state.enrolment.checkedInAt,'Start enrolment first.');for(const key of ['identityChecked','courseConfirmed','contactConfirmed','declarations'])state.enrolment[key]=data[key]===true;invalidateEnrolment(state);label='Enrolment checks updated';simulated=true;break;
    case 'ready-for-college': gate(9);requireThat(state.enrolment.checkedInAt&&enrolmentChecklist(state).every(c=>c.done),'Complete every enrolment check first.');state.enrolment.readyAt=now;label='Ready for college check';break;
    case 'college-confirmed': requireThat(state.enrolment.readyAt&&enrolmentChecklist(state).every(c=>c.done),'Prepare the complete payload for college review first.');state.enrolment.completedAt=now;label='College enrolment confirmed in this demo';simulated=true;break;
    case 'start-college': gate(10);state.enrolment.inductionViewed=true;label='Your first-day information is ready';simulated=true;break;
    default:throw new Error('Unknown journey action.');
  }
  state.updatedAt=now;state.activity.push({id:state.activity.length+1,type,label,at:now,simulated});state.activity=state.activity.slice(-120);state.tasks=outstandingTasks(state);return state;
}

export function enrolmentPayload(state) {
  requireThat(state.enrolment.readyAt&&enrolmentChecklist(state).every(c=>c.done),'The student record is not ready for college review.');
  return {schemaVersion:1,mode:'DEMONSTRATION ONLY',destination:'Proposed ProSolution / college workflow — NOT SENT',learnerReference:state.student.id,student:clone(state.student),application:clone(state.application),course:{id:state.courseId,title:courseFor(state).title},qualifications:clone(state.qualifications),documents:clone(state.documents),checks:enrolmentChecklist(state),staffVerificationRequired:true,integrated:false};
}
export function serialise(state) {return JSON.stringify(state);}
export function restore(value) {
  try { const s=JSON.parse(value);requireThat(s.version===1&&s.student?.id==='DEMO-JAMIE-2027'&&STEPS.some(t=>t.id===s.view)&&Array.isArray(s.activity)&&s.qualifications&&s.documents&&s.enrolment&&s.events&&s.application&&s.offer&&s.preparation&&s.education&&Array.isArray(s.savedCourses),'Invalid save');completion(s);return s;}catch{return null;}
}

// Presenter examples use the same validated events as the interactive UI.
export function advanceDemo(state) {
  let s=state;const send=(type,data)=>{s=transition(s,type,data);};
  switch(currentStep(s)) {
    case 1:send('match');send('save-course',{id:'computing-l3'});break;
    case 2:send('book-open-day',{id:'lincoln'});break;
    case 3:send('review-application');send('submit-application',{confirmed:true});break;
    case 4:send('read-offer');break;
    case 5:send('welcome-attended');break;
    case 6:send('prepare',{confirmed:true});break;
    case 7:send('document-added',{kind:'photo',name:'Jamie sample portrait',synthetic:true});send('document-added',{kind:'identity',name:'Fictional identity evidence',synthetic:true});send('education-confirmed');send('application-declarations',{confirmed:true});break;
    case 8:send('results-draft',{rows:resultRows(s.scenario),source:'Synthetic demonstration results',simulated:true});send('results-confirmed',{confirmed:true});break;
    case 9:send('check-in');if(assessResults(s).kind!=='satisfied'){send('request-careers');send('staff-results-review');}send('enrolment-checks',{identityChecked:true,courseConfirmed:true,contactConfirmed:true,declarations:true});send('ready-for-college');send('college-confirmed');break;
    case 10:send('start-college');break;
  }
  s.view=currentStep(s);return s;
}
export function stageExample(step,scenario='standard') {
  requireThat(STEPS.some(s=>s.id===Number(step)),'Unknown stage.');let state=createJourney(scenario);
  for(let n=1;n<Number(step);n++)state=advanceDemo(state);
  state.view=Number(step);state.activity.push({id:state.activity.length+1,type:'demo.example-loaded',label:`Presenter loaded Step ${step} example`,at:new Date().toISOString(),simulated:true});return state;
}
