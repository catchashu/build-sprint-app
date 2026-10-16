import { canvasMode, setCanvasMode } from "./canvasLayout";
import { trayGeometry, transitionTray } from "./trayTransition";
import type { ConvexClient } from 'convex/browser';
import type { Id } from '../convex/_generated/dataModel';
import { api } from '../convex/_generated/api';
import { mountReview } from './cardReview';
import type { Clarification } from '../shared/fullResearch';
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function mountResearch(client:ConvexClient,identity:{id:Id<'firstValueRuns'>;token:string},root:HTMLElement,onConfirmed:()=>void=()=>{}){
 let volumesRequested=false, suggestionsUnavailable=false;
 const app=root.closest<HTMLElement>('#app');
 let alive=true,starting=false,started=false,stopReview:(()=>void)|undefined,questionKey='',answerBusy=false;
 const heading=el('h2','Preparing your full research'),status=el('p','','muted'),error=el('p','','error'),questions=el('section','','research-question'),map=el('div','','review demand-map'),activity=el('details'),log=el('ul');
 type SearchActivity={query:string;status:string;error?:string};
 let searches:SearchActivity[]=[],history:HTMLDialogElement|undefined,historyList:HTMLUListElement|undefined;
 activity.className='search-activity';activity.open=true;log.className='recent-searches';
 const allActivity=el('button','View all search activity','secondary');allActivity.type='button';
 const historyRows=()=>searches.slice().reverse().map(s=>el('li',`${s.query} — ${s.status}${s.error?`: ${s.error}`:''}`));
 allActivity.onclick=()=>{
  history?.remove();history=el('dialog','','cluster-evidence search-history');history.setAttribute('aria-label','Search activity history');
  const header=el('div','','explainer-header'),close=el('button','Close','explainer-close');close.type='button';close.onclick=()=>history?.close();
  header.append(el('h2','Search activity'),close);historyList=el('ul');historyList.append(...historyRows());history.append(header,historyList);root.append(history);history.showModal();
  history.addEventListener('close',()=>{history?.remove();history=undefined;historyList=undefined;});
 };
 heading.classList.add('research-heading');status.classList.add('research-status');
 heading.tabIndex=-1;status.setAttribute('role','status');error.setAttribute('role','alert');activity.append(el('summary','Search activity'),log,allActivity);
 const retry=el('button','Try again','primary');retry.type='button';retry.hidden=true;
 const limits=el('p','Your completed search results are saved. If you refresh, your research will resume.','small muted research-limits');
 root.append(heading,status,error,questions,map,retry,activity,limits);
 async function start(){if(starting||!alive)return;starting=true;retry.disabled=true;error.textContent='';try{await client.mutation(api.fullResearch.start,identity);}catch{error.textContent='Research could not start. Your unlock and review are saved.';retry.hidden=false;}finally{starting=false;retry.disabled=false;}}
 retry.onclick=()=>void start();
 const stop=client.onUpdate(api.fullResearch.get,identity,run=>{
  if(!alive)return;
  const before=app?trayGeometry(app):null;
  if(!run){setCanvasMode(root,'review');heading.textContent='This research could not be opened.';error.textContent='Return to your saved run and unlock it first.';return;}
  if(run.state==='ready'&&!started){started=true;void start();}
  if(run.state==='complete'&&!volumesRequested){volumesRequested=true;void client.mutation(api.searchVolume.start,identity).catch(()=>{});}
  const phases:Record<string,string>={ready:'Preparing your full research',planning:'Choosing searches from your confirmed offering',searching:'Researching real search demand in India',cleaning:'Cleaning and organising the evidence',grouping:'Grouping searches by underlying need',complete:'Here is your India demand map',failed:'Research paused. Your work is safe.'};
  heading.textContent=phases[run.state]??'Opening your research';
  status.textContent=run.state==='complete'?'Searches are grouped by what people are trying to do. Inspect the evidence or correct an area below.':run.state!=='failed'?`${run.searchCount} search attempts started. Refreshing will resume this run.`:'';
  error.textContent=run.error??'';retry.hidden=run.state!=='failed';
  searches=run.searches;
  log.replaceChildren(...searches.slice(-3).reverse().map(s=>{const row=el('li'),query=el('span',s.query,'activity-query');query.title=s.query;row.append(query,el('span',s.status,'small muted'));return row;}));
  if(!searches.length)log.append(el('li','No searches started yet.','small muted'));
  allActivity.disabled=!searches.length;historyList?.replaceChildren(...historyRows());
  suggestionsUnavailable=run.searches.some((s:{status:string})=>s.status==='failed');
  limits.textContent=run.state==='failed'?'Your completed search results are saved. Select Try again to resume.':'Your completed search results are saved. If you refresh, your research will resume.';
  if(run.state==='complete'&&!run.hasCards)status.textContent='There is not enough observable evidence for a demand map. Your research remains saved.';
  const pending:Clarification|undefined=run.questions.find((q:Clarification)=>!run.answers.some((a:{questionId:string})=>a.questionId===q.id));
  map.hidden=!!pending||run.state!=='complete';
  heading.hidden=!!pending;
  activity.hidden=!!pending||run.state==='complete';limits.hidden=activity.hidden;
  status.hidden=!!pending||run.state==='complete'&&!!run.hasCards;
  questions.hidden=!pending;
  if(app){
   if(pending)app.dataset.reviewView='question';
   else if(run.state!=='complete')delete app.dataset.reviewView;
   else if(stopReview)app.dataset.reviewView=map.dataset.reviewView??'card';
  }
  if(run.state==='complete'&&run.hasCards&&!stopReview)stopReview=mountReview(client,identity,map,onConfirmed,{demandMap:true,deck:true,suggestionsUnavailable:()=>suggestionsUnavailable});
  if(run.state==='complete'&&run.hasCards&&!pending)heading.textContent='Review your demand map';
  setCanvasMode(root,canvasMode('research',run.state,!!pending));
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
  if(app&&!pending&&run.state==='complete')app.ownerDocument.defaultView?.dispatchEvent(new Event('resize'));
  if(app&&before){const after=trayGeometry(app);if(Math.abs(after.panel-before.panel)>1)transitionTray(app,before,after);}
 },()=>{error.textContent='The connection was interrupted. Your research is saved. Refresh to reconnect.';});
 return()=>{alive=false;stop();stopReview?.();history?.remove();};
}
