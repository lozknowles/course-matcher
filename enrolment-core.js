export const PROGRAMMES = [
  {id:'digital', name:'Digital technologies', level:'Level 3', places:{Lincoln:32, Newark:16}, colour:'#087f78'},
  {id:'engineering', name:'Engineering', level:'Level 3', places:{Lincoln:32, Newark:16}, colour:'#76529b'},
  {id:'health', name:'Health & social care', level:'Level 3', places:{Lincoln:36, Newark:20}, colour:'#c41669'},
  {id:'business', name:'Business', level:'Level 3', places:{Lincoln:30, Newark:18}, colour:'#2376a8'},
  {id:'construction', name:'Construction', level:'Level 2', places:{Lincoln:28, Newark:20}, colour:'#a85c00'},
  {id:'creative', name:'Creative arts', level:'Level 3', places:{Lincoln:30, Newark:14}, colour:'#087f78'}
];
export const STAGES = ['Applied','In review','Offered','Enrolled'];
const firstNames = ['Amelia','Oliver','Sofia','Jack','Isla','Leo','Maya','Noah','Grace','Ethan','Freya','Adam'];
const lastNames = ['Taylor','Wilson','Patel','Clarke','Walker','Ahmed','Evans','Singh','Parker','Wright','Bennett','Hughes','Morgan','Reed','Foster','Ward','Green','Bailey','Cole','Brooks'];
export const programmeFor = id => PROGRAMMES.find(programme => programme.id === id);

export function makeCohort(year='2026/27') {
  const startYear = Number(year.slice(0,4));
  const count = startYear === 2026 ? 240 : 210;
  return Array.from({length:count}, (_, i) => {
    const stage = i%10 < 1 ? 0 : i%10 < 3 ? 1 : i%10 < 5 ? 2 : 3;
    const month = 4 + Math.floor(i / (count/6));
    const day = 1 + i%15;
    const date = `${startYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return {id:`DEMO-${startYear}-${String(i+1).padStart(4,'0')}`, name:`${firstNames[i%12]} ${lastNames[Math.floor(i/12)%20]}`, programme:PROGRAMMES[i%6].id, campus:Math.floor(i/6)%3 === 0 ? 'Newark':'Lincoln', year, stage, applied:date, checked:stage >= 2, history:[{label:'Sample application created',date}, ...(stage ? [{label:STAGES[stage],date}] : [])]};
  });
}

export function scopeRecords(records, {year='2026/27',campus='all',programme='all',status='all',query=''}={}) {
  const search = query.trim().toLocaleLowerCase('en-GB');
  return records.filter(record => record.year === year && (campus === 'all' || record.campus === campus)
    && (programme === 'all' || record.programme === programme)
    && (status === 'all' || (status === 'pending' ? record.stage < 2 : status === 'offers' ? record.stage >= 2 : record.stage === Number(status)))
    && (!search || [record.id,record.name,programmeFor(record.programme)?.name,record.campus].some(value=>String(value).toLocaleLowerCase('en-GB').includes(search))));
}

export function summary(records) {
  const stages = STAGES.map((_,index)=>records.filter(record=>record.stage === index).length);
  return {applications:records.length,offers:stages[2]+stages[3],enrolled:stages[3],pending:stages[0]+stages[1],stages};
}

export function capacity(records,campus='all') {
  return PROGRAMMES.map(programme=>{
    const enrolled = records.filter(record=>record.programme === programme.id && record.stage === 3).length;
    const places = campus === 'all' ? programme.places.Lincoln+programme.places.Newark : programme.places[campus];
    return {...programme,enrolled,places,percentage:Math.round(enrolled/places*100)};
  });
}

export function trend(records) {
  return ['Apr','May','Jun','Jul','Aug','Sep'].map((month,index)=>({month,
    applications:records.filter(record=>Number(record.applied.slice(5,7))<=index+4).length,
    enrolled:records.filter(record=>Number(record.applied.slice(5,7))<=index+4 && record.stage === 3).length
  }));
}

export function advanceRecord(record,{checked=false,date}={}) {
  if (!record || record.stage >= 3) throw new Error('This sample is already enrolled.');
  if (record.stage >= 1 && !checked) throw new Error('Complete the sample review checklist first.');
  const stage = record.stage+1;
  return {...record,stage,checked:record.checked || checked,history:[...record.history,{label:STAGES[stage],date:date || `${record.year.slice(0,4)}-09-16`}]};
}

export function addSample(records,{year='2026/27',campus='Lincoln',programme='digital'}={}) {
  if (!programmeFor(programme) || !['Lincoln','Newark'].includes(campus) || !['2026/27','2025/26'].includes(year)) throw new Error('Select a valid sample programme, campus and intake.');
  const ordinal = records.filter(record=>record.year === year).length+1;
  const date = `${year.slice(0,4)}-09-16`;
  const record = {id:`DEMO-${year.slice(0,4)}-${String(ordinal).padStart(4,'0')}`,name:`Sample learner ${ordinal}`,programme,campus,year,stage:0,applied:date,checked:false,history:[{label:'Sample application created',date}]};
  return {record,records:[...records,record]};
}

export function recordsCsv(records) {
  const cell = value => `"${String(value).replace(/^[=+\-@]/,'\'$&').replaceAll('"','""')}"`;
  const rows = [['SYNTHETIC DEMONSTRATION DATA ONLY'],['Reference','Sample learner','Programme','Campus','Intake','Stage','Applied'],...records.map(record=>[record.id,record.name,programmeFor(record.programme).name,record.campus,record.year,STAGES[record.stage],record.applied])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
