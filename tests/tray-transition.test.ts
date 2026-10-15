import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { transitionTray } from '../src/trayTransition';

test('tray transitions keep the same content nodes and release temporary sizing on finish',()=>{
 const w=new Window();const app=w.document.createElement('main');const video=w.document.createElement('video');const input=w.document.createElement('input');input.value='Saved';app.append(video,input);
 const old=globalThis.matchMedia;Object.assign(globalThis,{matchMedia:()=>({matches:false})});
 const animation=new w.EventTarget();let frames:any;
 Object.assign(app,{animate:(keyframes:any)=>{frames=keyframes;return animation;}});
 try{
  transitionTray(app as any,{stage:200,panel:400},{stage:300,panel:300});
  assert.equal(app.dataset.trayMoving,'true');assert.equal(app.querySelector('video'),video);assert.equal(input.value,'Saved');
  assert.equal(frames[0].gridTemplateRows,'200px 400px');assert.equal(frames[1].gridTemplateRows,'300px 300px');
  animation.dispatchEvent(new w.Event('finish'));assert.equal(app.dataset.trayMoving,undefined);
  Object.assign(globalThis,{matchMedia:()=>({matches:true})});
  assert.equal(transitionTray(app as any,{stage:200,panel:400},{stage:300,panel:300}),undefined);
  assert.equal(app.dataset.trayMoving,undefined);
 }finally{Object.assign(globalThis,{matchMedia:old});}
});
