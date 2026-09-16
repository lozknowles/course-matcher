import {demandForOccupation,periodLabel} from './demand-core.js';
const $=id=>document.getElementById(id);
const add=(parent,tag,text)=>{const node=document.createElement(tag);node.textContent=text;parent.append(node);return node;};
const count=value=>new Intl.NumberFormat('en-GB').format(value);
let snapshot=null,selected=null,failed=false;
export function selectDemandOccupation(occupation){selected=occupation;render();}
function render(){
  $('demand-history-body').replaceChildren();$('demand-source').replaceChildren();$('demand-history').hidden=true;
  if(!snapshot){$('demand-value').textContent=failed?'Unavailable':'Loading…';$('demand-context').textContent=failed?'The recruitment reference could not be loaded. Career pathways and pay remain available.':'Loading the published ONS recruitment reference.';return;}
  const result=demandForOccupation(snapshot,selected,$('demand-area').value);
  $('demand-value').textContent=result.status==='available'?count(result.latest.value):result.status==='suppressed'?'Suppressed':'Unavailable';
  $('demand-period').textContent=result.latest?periodLabel(result.latest.period):'';
  $('demand-context').textContent=result.record?`${result.area.name} · ${result.record.occupationTitle}. ${result.status==='available'?'New online adverts for this wider occupation group.':result.reason}`:result.reason;
  if(result.record){
    $('demand-history').hidden=false;
    for(const observation of result.record.observations){const row=add($('demand-history-body'),'tr','');add(row,'th',periodLabel(observation.period)).scope='row';add(row,'td',observation.status==='available'?count(observation.value):observation.status==='suppressed'?'Suppressed':'Unavailable');}
  }
  add($('demand-source'),'span','Source: ONS using Textkernel · published 21 August 2026 · ');
  const link=add($('demand-source'),'a','View dataset and quality notes');link.href=snapshot.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
}
$('demand-area').addEventListener('change',render);
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
fetch('./ons-demand-reference.json',{cache:'no-cache',signal:controller.signal}).then(response=>{if(!response.ok)throw new Error('request failed');return response.json();}).then(data=>{if(data.schemaVersion!==1||!Array.isArray(data.records))throw new Error('invalid data');snapshot=data;render();}).catch(()=>{failed=true;render();}).finally(()=>clearTimeout(timer));
