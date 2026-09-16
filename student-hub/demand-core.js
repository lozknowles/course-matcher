export function demandForOccupation(snapshot,occupation,geography='E12000004') {
  const code=String(occupation?.soc2020?.code??'');
  const unavailable=reason=>({status:'unavailable',reason,record:null,area:null,latest:null});
  if(!/^[0-9]{4}$/.test(code))return unavailable('No verified four-digit SOC 2020 code is available for this occupation.');
  if(snapshot?.schemaVersion!==1 || snapshot.classification!=='SOC2020' || snapshot.measure!=='new-online-job-adverts' || snapshot.unit!=='adverts')return unavailable('A compatible ONS recruitment reference is unavailable.');
  const area=snapshot.geographies?.find(area=>area.code===geography);
  const matches=snapshot.records?.filter(record=>record.geography===geography && record.soc2020===code)??[];
  if(!area||matches.length!==1)return unavailable('No unambiguous published observation is available for this occupation group and area.');
  const source=matches[0];
  if(!['monthly','quarterly'].includes(source.frequency)||!Array.isArray(source.observations)||!source.observations.length)return unavailable('The observation period is unavailable.');
  const observations=source.observations.map(observation=>{
    const validPeriod=source.frequency==='monthly'?/^\d{4}-(0[1-9]|1[0-2])$/.test(observation.period):/^\d{4}Q[1-4]$/.test(observation.period);
    const valid=validPeriod&&observation.status==='available'&&Number.isSafeInteger(observation.value)&&observation.value>=0;
    return {...observation,status:valid?'available':observation.status==='suppressed'?'suppressed':'unavailable',value:valid?observation.value:null};
  });
  if(observations.some((row,index)=>index>0&&row.period<=observations[index-1].period))return unavailable('The observation periods are ambiguous.');
  const latest=observations.at(-1);
  return {status:latest.status,area:{...area},latest,record:{...source,observations},reason:latest.status==='suppressed'?'ONS has suppressed this observation for data-quality reasons.':latest.status==='available'?'Published ONS estimate.':'The latest observation is unavailable.'};
}

export function periodLabel(period) {
  if(/^\d{4}Q[1-4]$/.test(period))return `${['Jan–Mar','Apr–Jun','Jul–Sep','Oct–Dec'][Number(period.at(-1))-1]} ${period.slice(0,4)}`;
  if(/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return new Date(`${period}-15T12:00:00Z`).toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  return 'Period unavailable';
}
