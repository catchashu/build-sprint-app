import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { getFunctionName } from 'convex/server';
import { mountResearch } from '../src/research.ts';
import type { ConvexClient } from 'convex/browser';
import type { Id } from '../convex/_generated/dataModel';
test('research auto-starts once, preserves the demand-map list and exposes all evidence',async()=>{
 const window=new Window();const oldDocument=globalThis.document;const oldOption=globalThis.Option;
 globalThis.document=window.document as unknown as Document;
 globalThis.Option=function(text:string,value:string){const option=window.document.createElement('option');option.textContent=text;option.value=value;return option;} as unknown as typeof Option;
 const callbacks=new Map<string,(value:any)=>void>(),calls:string[]=[];
 const client={onUpdate:(ref:any,_args:any,callback:(value:any)=>void)=>{const name=getFunctionName(ref);callbacks.set(name,callback);return()=>callbacks.delete(name);},mutation:async(ref:any)=>{calls.push(getFunctionName(ref));return null;}} as unknown as ConvexClient;
 const root=window.document.createElement('section');window.document.body.append(root);
 const stop=mountResearch(client,{id:'fake' as Id<'firstValueRuns'>,token:'test-token'},root as unknown as HTMLElement);
 try{
 const ready={state:'ready',searches:[],searchCount:0,questions:[],answers:[],accepted:false};
 callbacks.get('fullResearch:get')!(ready);callbacks.get('fullResearch:get')!(ready);await Promise.resolve();assert.deepEqual(calls,['fullResearch:start']);
 const complete={...ready,state:'complete',hasCards:true};callbacks.get('fullResearch:get')!(complete);
 const queries=Array.from({length:5},(_,i)=>({id:`e${i}`,query:`Observed ${i}`,volume:null,sources:[{provider:'SerpAPI',reference:'https://serpapi.com/searches/a.json',field:'related_searches.query',retrievedAt:'2026-10-12'}]}));
 callbacks.get('mapReview:get')!({revision:0,cards:[{groupId:'a',label:'Need',need:'Confirmed need',queries}],decisions:{a:'correct'},notes:[],accepted:false,pending:null,last:null});
 const list=root.querySelector('.cards')!;list.scrollTop=350;
 assert.match(root.textContent,/View all 5 searches/);assert.match(root.textContent,/Insufficient evidence/);
 callbacks.get('fullResearch:get')!(complete);assert.equal(root.querySelector('.cards'),list);assert.equal(list.scrollTop,350);
 assert.equal([...root.querySelectorAll('button')].find(b=>b.textContent==='Confirm demand map')?.disabled,false);
 }finally{stop();assert.equal(callbacks.size,0);globalThis.document=oldDocument;globalThis.Option=oldOption;await window.happyDOM.close();}
});
