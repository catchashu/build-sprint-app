import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import type {ConvexClient} from 'convex/browser';
import type {Id} from '../convex/_generated/dataModel';
import {mountUnlock} from '../src/unlock';
const settled=()=>new Promise<void>(r=>setImmediate(r));
function setup(){
 const window=new Window();Object.assign(globalThis,{window,document:window.document});
 const root=window.document.createElement('div');window.document.body.append(root);
 const state={accepted:true,unlocked:null as null|{via:'comped'},paymentReady:false,inviteReady:true,orderPending:false,testMode:true};
 let emit:(value:typeof state)=>void=()=>{},resolve:(value:{ok:boolean;message:string})=>void=()=>{},continued=0;
 const submitted:string[]=[];
 const client={onUpdate:(_api:unknown,_identity:unknown,callback:typeof emit)=>{emit=callback;callback({...state});return()=>{};},mutation:(_api:unknown,args:{code:string})=>{submitted.push(args.code);return new Promise<{ok:boolean;message:string}>(r=>{resolve=r;});}};
 const stop=mountUnlock(client as unknown as ConvexClient,{id:'test-run' as Id<'firstValueRuns'>,token:'test-only'},root as unknown as HTMLElement,()=>{},()=>{continued++;});
 const button=(text:string)=>{const b=[...root.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,`Missing ${text}`);return b;};
 button('Have an invite code?').click();
 const input=()=>root.querySelector('input')!;
 const type=(value:string)=>{input().value=value;input().dispatchEvent(new window.Event('input'));};
 return{window,root,state,button,input,type,submitted,emit:()=>emit({...state}),resolve:(ok:boolean)=>resolve({ok,message:ok?'Unlocked':'That invite code is not valid.'}),continued:()=>continued,close:()=>{stop();window.happyDOM.abort();}};
}
test('invite editing keeps the same field, focus and selection through updates; Show and Clear are explicit',()=>{
 const s=setup();try{
  s.type('Sample-Code');const input=s.input();input.focus();input.setSelectionRange(2,6);
  s.emit();assert.ok(s.input()===input, "Input must stay mounted");assert.ok(s.window.document.activeElement===input, "Input must keep focus");assert.equal(input.selectionStart,2);assert.equal(input.selectionEnd,6);
  s.button('Show code').click();assert.equal(input.type,'text');assert.equal(input.value,'Sample-Code');
  s.button('Hide code').click();assert.equal(input.type,'password');
  s.button('Clear code').click();assert.equal(input.value,'');assert.ok(s.window.document.activeElement===input, "Input must keep focus");assert.equal(s.button('Apply').disabled,true);assert.match(s.root.textContent??'',/code cleared/i);
  s.emit();assert.equal(input.value,'');assert.ok(s.input()===input, "Input must stay mounted");
  s.type('Replacement');assert.equal(s.button('Apply').disabled,false);assert.equal(input.getAttribute('autocapitalize'),'none');assert.equal((input as unknown as HTMLInputElement).spellcheck,false);
 }finally{s.close();}
});
test('a rejected invite can be cleared and replaced, submits once, then continues after unlock',async()=>{
 const s=setup();try{
  s.type('Wrong');s.button('Apply').click();assert.deepEqual(s.submitted,['Wrong']);assert.equal(s.button('Applying...').disabled,true);
  s.emit();s.resolve(false);await settled();assert.match(s.root.textContent??'',/not valid/);assert.equal(s.input().disabled,false);
  s.button('Clear code').click();assert.doesNotMatch(s.root.textContent??'',/not valid/);
  s.type('Replacement');s.button('Apply').click();s.button('Applying...').click();assert.deepEqual(s.submitted,['Wrong','Replacement']);
  s.state.unlocked={via:'comped'};s.emit();s.resolve(true);await settled();assert.equal(s.continued(),1);s.emit();await settled();assert.equal(s.continued(),1);
 }finally{s.close();}
});
