import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {revealReferenceInput} from '../src/canvasLayout';
test('reference keyboard reveals either focused input within the tray without scrolling other screens',()=>{
 const w=new Window();const previous={document:globalThis.document,HTMLElement:globalThis.HTMLElement};Object.assign(globalThis,{document:w.document,HTMLElement:w.HTMLElement});
 try{
  const app=w.document.createElement('main'),panel=w.document.createElement('section'),first=w.document.createElement('input'),second=w.document.createElement('input');panel.className='panel';app.dataset.canvasStep='references';app.dataset.keyboard='true';panel.append(first,second);app.append(panel);w.document.body.append(app);
  Object.assign(panel,{getBoundingClientRect:()=>({top:50,bottom:290})});
  Object.assign(first,{getBoundingClientRect:()=>({top:280,bottom:338})});first.focus();revealReferenceInput(app as any);assert.equal(panel.scrollTop,56);
  Object.assign(second,{getBoundingClientRect:()=>({top:20,bottom:78})});second.focus();revealReferenceInput(app as any);assert.equal(panel.scrollTop,18);
  app.dataset.canvasStep='website';revealReferenceInput(app as any);assert.equal(panel.scrollTop,18);
 }finally{Object.assign(globalThis,previous);}
});
