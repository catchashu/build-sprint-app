import type { ConvexClient } from 'convex/browser';
import type { Id } from '../convex/_generated/dataModel';
import { api } from '../convex/_generated/api';
import { mountReview } from './cardReview';
import type { Clarification } from '../shared/fullResearch';
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function mountResearch(client:ConvexClient,identity:{id:Id<'firstValueRuns'>;token:string},root:HTMLElement){
 let alive=true,starting=false,started=false,stopReview:(()=>void)|undefined,questionKey='',answerBusy=false;
 const heading=el('h2','Preparing your full research'),status=el('p','','muted'),error=el('p','','error'),questions=el('section','','research-question'),map=el('div','','review demand-map'),activity=el('details'),log=el('ul');
 heading.tabIndex=-1;status.setAttribute('role','status');error.setAttribute('role','alert');activity.append(el('summary','Search activity'),log);
 const retry=el('button','Try again','primary');retry.type='button';retry.hidden=true;
 const limits=el('p','Up to eight additional searches, with at most two extra attempts for temporary failures. Completed results stay saved.','small muted');
 root.append(heading,status,error,questions,map,retry,activity,limits);
 async function start(){if(starting||!alive)return;starting=true;retry.disabled=true;error.textContent='';try{await client.mutation(api.fullResearch.start,identity);}catch{error.textContent='Research could not start. Your unlock and review are saved.';retry.hidden=false;}finally{starting=false;retry.disabled=false;}}
 retry.onclick=()=>void start();
 const stop=client.onUpdate(api.fullResearch.get,identity,run=>{
  if(!alive)return;
  if(!run){heading.textContent='This research could not be opened.';error.textContent='Return to your saved run and unlock it first.';return;}
  if(run.state==='ready'&&!started){started=true;void start();}
  const phases:Record<string,string>={ready:'Preparing your full research',planning:'Choosing searches from your confirmed offering',searching:'Researching real search demand in India',cleaning:'Cleaning and organising the evidence',grouping:'Grouping searches by underlying need',complete:'Here is your India demand map',failed:'Research paused. Your work is safe.'};
  heading.textContent=phases[run.state]??'Opening your research';
  status.textContent=run.state==='complete'?'Searches are grouped by what people are trying to do. Inspect the evidence or correct an area below.':run.state==='searching'?`${run.searchCount} search attempts started. Refreshing will resume this run.`:'';
  error.textContent=run.error??'';retry.hidden=run.state!=='failed';
  log.replaceChildren(...run.searches.map((s:{query:string;status:string;error?:string})=>el('li',`${s.query} - ${s.status}${s.error?`: ${s.error}`:''}`,s.status==='failed'?'error':'')));
  if(run.searches.some((s:{status:string})=>s.status==='failed')){limits.textContent='Some searches failed. The map uses successful saved results; coverage may be incomplete.';}
  if(run.state==='complete'&&run.hasCards&&!stopReview)stopReview=mountReview(client,identity,map,()=>{heading.focus();},{demandMap:true});
  if(run.state==='complete'&&!run.hasCards)status.textContent='There is not enough observable evidence for a demand map. Your research remains saved.';
  const pending:Clarification|undefined=run.questions.find((q:Clarification)=>!run.answers.some((a:{questionId:string})=>a.questionId===q.id));
  const key=pending?.id??'';
  if(key!==questionKey){questionKey=key;questions.replaceChildren();
   if(pending){questions.append(el('h3','One decision before you confirm the map'),el('p',pending.question));
    const details=el('details');details.append(el('summary','Why this matters'),el('p',pending.reason));questions.append(details);
    for(const [answer,label]of [['relevant','This is part of my offering'],['excluded','This is not part of my offering'],['uncertain','Leave this uncertain for now']] as const){const b=el('button',label,'secondary');b.type='button';b.onclick=async()=>{if(answerBusy)return;answerBusy=true;questions.querySelectorAll('button').forEach(n=>n.disabled=true);try{await client.mutation(api.fullResearch.answer,{...identity,questionId:pending.id,answer});}catch{error.textContent='Your answer could not be saved. Try again.';}finally{answerBusy=false;if(alive)questions.querySelectorAll('button').forEach(n=>n.disabled=false);}};questions.append(b);}
    const other=el('details');other.append(el('summary','Something else'));
    const form=el('form'),label=el('label','Tell me what I should understand instead.'),input=el('textarea'),submit=el('button','Use this answer','primary');input.maxLength=2000;label.append(input);submit.type='submit';submit.disabled=true;input.oninput=()=>{submit.disabled=!input.value.trim()||answerBusy;};
    form.append(label,submit);form.onsubmit=event=>{event.preventDefault();if(answerBusy||!input.value.trim())return;answerBusy=true;submit.disabled=true;void client.action(api.fullResearch.customAnswer,{...identity,questionId:pending.id,note:input.value}).catch(()=>{error.textContent='Your answer could not be applied. Your map is unchanged. Try again.';}).finally(()=>{answerBusy=false;if(alive)submit.disabled=!input.value.trim();});};other.append(form);questions.append(other);
   }
  }
 },()=>{error.textContent='The connection was interrupted. Your research is saved. Refresh to reconnect.';});
 return()=>{alive=false;stop();stopReview?.();};
}
