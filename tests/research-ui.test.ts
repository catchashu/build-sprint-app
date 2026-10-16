import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { getFunctionName } from 'convex/server';
import { mountResearch } from '../src/research.ts';
import type { ConvexClient } from 'convex/browser';
import type { Id } from '../convex/_generated/dataModel';
test('research auto-starts once, preserves the demand-map deck and exposes all evidence',async()=>{
 const window=new Window();const oldDocument=globalThis.document;const oldOption=globalThis.Option;
 const oldWindow=globalThis.window;globalThis.window=window as unknown as typeof globalThis.window;
 globalThis.document=window.document as unknown as Document;
 globalThis.Option=function(text:string,value:string){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;} as unknown as typeof Option;
 const callbacks=new Map<string,(value:any)=>void>(),calls:string[]=[];
 const client={onUpdate:(ref:any,_args:any,callback:(value:any)=>void)=>{const name=getFunctionName(ref);callbacks.set(name,callback);return()=>callbacks.delete(name);},mutation:async(ref:any)=>{calls.push(getFunctionName(ref));return null;}} as unknown as ConvexClient;
 const root=window.document.createElement('section');window.document.body.append(root);
 let openedPlan=0;
 const stop=mountResearch(client,{id:'fake' as Id<'firstValueRuns'>,token:'test-token'},root as unknown as HTMLElement,()=>openedPlan++);
 try{
 const ready={state:'ready',searches:[],searchCount:0,questions:[],answers:[],accepted:false};
 callbacks.get('fullResearch:get')!(ready);callbacks.get('fullResearch:get')!(ready);await Promise.resolve();assert.deepEqual(calls,['fullResearch:start']);
 assert.match(root.textContent,/Your completed search results are saved. If you refresh, your research will resume./);
 const complete={...ready,state:'complete',hasCards:true};callbacks.get('fullResearch:get')!(complete);
 const queries=Array.from({length:5},(_,i)=>({id:`e${i}`,query:`Observed ${i}`,volume:null,sources:[{provider:'SerpAPI',reference:'https://serpapi.com/searches/a.json',field:'related_searches.query',retrievedAt:'2026-10-12'}]}));
 callbacks.get('mapReview:get')!({revision:0,cards:[{groupId:'a',label:'Need',need:'Confirmed need',queries}],decisions:{a:'correct'},notes:[],accepted:false,pending:null,last:null});
 const list=root.querySelector('.cards')!;list.scrollTop=350;
 assert.match(root.textContent,/View all searches/);assert.match(root.textContent,/Search volumes are not available in this version/);assert.doesNotMatch(root.textContent,/DataForSEO|monthly estimates|strongest measured|Checking India search volumes/);
 (root.querySelector('[data-action=evidence]') as unknown as HTMLButtonElement).click();
 assert.equal(root.querySelectorAll('dialog li').length,5);
 (root.querySelector('dialog button') as unknown as HTMLButtonElement).click();
 callbacks.get('fullResearch:get')!(complete);assert.equal(root.querySelector('.cards'),list);assert.equal(list.scrollTop,350);
 assert.equal([...root.querySelectorAll('button')].find(b=>b.textContent==='Confirm demand map')?.disabled,false);
 [...root.querySelectorAll('button')].find(b=>b.textContent==='Confirm demand map')!.click();await new Promise<void>(r=>setImmediate(r));assert.equal(openedPlan,1);assert.equal(calls.at(-1),'mapReview:accept');
 callbacks.get('mapReview:get')!({revision:0,cards:[{groupId:'a',label:'Need',need:'Confirmed need',queries}],decisions:{a:'correct'},notes:[],accepted:true,pending:null,last:null});
 const build=[...root.querySelectorAll('button')].find(b=>b.textContent==='Build my website plan');assert.ok(build);build.click();assert.equal(openedPlan,2);
 }finally{stop();assert.equal(callbacks.size,0);globalThis.document=oldDocument;globalThis.Option=oldOption;globalThis.window=oldWindow;await window.happyDOM.close();}
});
