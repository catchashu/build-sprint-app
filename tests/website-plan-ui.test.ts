import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import type { ConvexClient } from 'convex/browser';
import type { Id } from '../convex/_generated/dataModel';
import { mountWebsitePlan } from '../src/websitePlan';
import { readSavedState, saveState } from '../src/savedPlan';
import { planFixture } from './website-plan-fixture';
import { groundedPlanSchema } from '../shared/websitePlan';
const settle=()=>new Promise<void>(r=>setImmediate(r));
test('model schema rejects historical first-view IDs before saving a website plan',()=>{
 const {input,plan}=planFixture();assert.throws(()=>groundedPlanSchema(input).parse({...plan,nodes:[{...plan.nodes[0],clusterIds:['old:first-view-id']},plan.nodes[1]]}));
 groundedPlanSchema(input).parse(plan);
});
test('plan view starts once, exposes saved evidence, preserves open details, and submits a targeted correction once',async()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document});const root=window.document.createElement('div');window.document.body.append(root);
 let emit:(v:any)=>void=()=>{},resolve:()=>void=()=>{};const calls:any[]=[];
 const client={onUpdate:(_api:unknown,_identity:unknown,cb:typeof emit)=>{emit=cb;return()=>{};},mutation:(_api:unknown,args:unknown)=>{calls.push(args);return new Promise<void>(r=>resolve=r);}};
 const stop=mountWebsitePlan(client as unknown as ConvexClient,{id:'test' as Id<'firstValueRuns'>,token:'test-only'},root as unknown as HTMLElement,()=>{},()=>{});
 try{
  emit({state:'ready'});emit({state:'ready'});assert.equal(calls.length,1);resolve();await settle();
  const {input,plan}=planFixture(),view={id:'job',state:'complete',plan,cards:input.review.cards.filter(c=>c.groupId!=='x'),offering:input.offering};emit(view);
  assert.match(root.textContent,/Your website plan/);assert.match(root.textContent,/First priority/);assert.match(root.textContent,/View all search evidence \(2\)/);
  assert.match(root.textContent,/1 website page · 1 on-page sections or FAQ groups/);
  assert.match(root.textContent,/Content within Film production \(1\) · no separate URL/);
  assert.match(root.textContent,/Not every search supports this particular recommendation/);
  const detail=root.querySelector('.plan-evidence')!;detail.setAttribute('open','');emit(view);assert.equal(root.querySelector('.plan-evidence'),detail);
  assert.equal(root.querySelector('.plan-sources a')?.getAttribute('href'),input.review.cards[0].queries[0].sources[0].reference);
  const form=root.querySelector('form')!,inputEl=form.querySelector('textarea')!,submit=form.querySelector('button')!;
  assert.equal(submit.disabled,true);inputEl.value='Use a clearer title';inputEl.dispatchEvent(new window.Event('input'));submit.click();submit.click();
  assert.equal(calls.length,3);assert.deepEqual(calls[1],{id:'test',token:'test-only'});assert.equal(calls[2].selectedNodeId,'p');assert.equal(calls[2].expectedId,'job');assert.equal(calls[2].correction,'Use a clearer title');
  resolve();await settle();emit({...view,state:'failed',error:'Try again'});assert.match(root.textContent,/Film production/);assert.ok([...root.querySelectorAll('button')].some(b=>b.textContent==='Try again'));
 }finally{stop();await window.happyDOM.close();}
});
test('closing a tab restores its saved plan while another open tab retains its own run',()=>{
 const w=new Window(),key='test-run',state={screen:'plan',id:'new-run',token:'private-test-token'};
 saveState(w.sessionStorage as unknown as Storage,w.localStorage as unknown as Storage,key,state);
 w.sessionStorage.clear();assert.deepEqual(readSavedState(w.sessionStorage as unknown as Storage,w.localStorage as unknown as Storage,key,()=>({screen:'landing'})),state);
 w.sessionStorage.setItem(key,JSON.stringify({screen:'result',id:'other-tab-run'}));assert.equal(readSavedState<any>(w.sessionStorage as unknown as Storage,w.localStorage as unknown as Storage,key,()=>({})).id,'other-tab-run');
 w.happyDOM.abort();
});

test('plan analytics runs only after complete output is mounted and distinguishes restored results',async()=>{
 for(const resumed of [false,true]){
  const window=new Window();Object.assign(globalThis,{window,document:window.document});
  const root=window.document.createElement('div');window.document.body.append(root);
  let emit:(view:any)=>void=()=>{};const seen:string[]=[];
  const client={onUpdate:(_api:unknown,_id:unknown,cb:typeof emit)=>{emit=cb;return()=>{};},mutation:async()=>{}};
  const stop=mountWebsitePlan(client as unknown as ConvexClient,{id:'test' as Id<'firstValueRuns'>,token:'private'},root as unknown as HTMLElement,()=>{},()=>{}, {
   viewed(kind){assert.ok(root.querySelector('.plan-node'));seen.push(kind);throw Error('analytics unavailable');},
  });
  try{
   const {input,plan}=planFixture();const view={state:'complete',plan,cards:input.review.cards,offering:input.offering};
   if(!resumed){emit({state:'generating'});emit({...view,state:'failed'});assert.deepEqual(seen,[]);}
   emit(view);assert.deepEqual(seen,[resumed?'reopened':'new']);emit(view);assert.equal(seen.length,1);
   stop();emit({...view,error:'late update'});assert.equal(seen.length,1);
  }finally{stop();await window.happyDOM.close();}
 }
});

test('Excel event follows generated download, skips failures, and tolerates analytics errors',async(t)=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document});
 const root=window.document.createElement('div');window.document.body.append(root);
 let emit:(view:any)=>void=()=>{},downloads=0,exports=0,fail=true;
 t.mock.method(URL,'createObjectURL',()=>{if(fail)throw Error('generation unavailable');return 'blob:synthetic';});
 t.mock.method(URL,'revokeObjectURL',()=>{});
 t.mock.method(window.HTMLAnchorElement.prototype,'click',()=>{downloads++;});
 const originalTimeout=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',((fn:any,delay:number,...args:any[])=>originalTimeout(fn,delay===60000?0:delay,...args)) as typeof setTimeout);
 const client={onUpdate:(_api:unknown,_id:unknown,cb:typeof emit)=>{emit=cb;return()=>{};},mutation:async()=>{}};
 const stop=mountWebsitePlan(client as unknown as ConvexClient,{id:'test' as Id<'firstValueRuns'>,token:'private'},root as unknown as HTMLElement,()=>{},()=>{}, {
  exported(){assert.equal(downloads,1);exports++;throw Error('analytics unavailable');},
 });
 const wait=async(predicate:()=>boolean)=>{for(let i=0;i<200&&!predicate();i++)await new Promise(r=>originalTimeout(r,10));assert.ok(predicate());};
 try{
  const {input,plan}=planFixture();emit({state:'complete',plan,cards:input.review.cards,offering:input.offering});
  (root.querySelector('button[data-export]') as unknown as HTMLButtonElement).click();
  assert.equal(exports,0);await wait(()=>!!root.querySelector('.error')?.textContent);
  assert.equal(exports,0);assert.equal(downloads,0);
  fail=false;(root.querySelector('button[data-export]') as unknown as HTMLButtonElement).click();
  await wait(()=>root.textContent.includes('Your Excel file is ready.'));
  assert.equal(downloads,1);assert.equal(exports,1);
 }finally{stop();await window.happyDOM.close();}
});
