import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { audienceTabs, explainerClose } from '../src/explainerControls';
test('audience selection starts on own website and updates content, keyboard focus and accessibility state',()=>{
 const w=new Window();const previous=globalThis.document;Object.assign(globalThis,{document:w.document});
 try{
  const {tabs,content}=audienceTabs(['Own website','Client/team'],['Own copy','Client copy']);w.document.body.append(tabs as any,content as any);
  const buttons=tabs.querySelectorAll('button');assert.equal(buttons[0].getAttribute('aria-selected'),'true');assert.equal(content.textContent,'Own copy');
  buttons[1].click();assert.equal(buttons[0].getAttribute('aria-selected'),'false');assert.equal(buttons[1].getAttribute('aria-selected'),'true');assert.equal(content.textContent,'Client copy');
  buttons[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}) as any);assert.equal(content.textContent,'Own copy');assert.equal(w.document.activeElement,buttons[0]);
  let closed=false;const close=explainerClose(()=>closed=true);assert.equal(close.textContent,'Close');assert.equal(close.querySelector('svg')?.getAttribute('aria-hidden'),'true');close.click();assert.equal(closed,true);
 }finally{Object.assign(globalThis,{document:previous});}
});
