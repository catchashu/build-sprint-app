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
  const detail=root.querySelector('.plan-evidence')!;detail.setAttribute('open','');emit(view);assert.equal(root.querySelector('.plan-evidence'),detail);
  assert.equal(root.querySelector('.plan-sources a')?.getAttribute('href'),input.review.cards[0].queries[0].sources[0].reference);
  const form=root.querySelector('form')!,inputEl=form.querySelector('textarea')!,submit=form.querySelector('button')!;
  assert.equal(submit.disabled,true);inputEl.value='Use a clearer title';inputEl.dispatchEvent(new window.Event('input'));submit.click();submit.click();
  assert.equal(calls.length,2);assert.equal(calls[1].selectedNodeId,'p');assert.equal(calls[1].expectedId,'job');assert.equal(calls[1].correction,'Use a clearer title');
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
