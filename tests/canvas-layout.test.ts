import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { canvasMode, keyboardOpen, setCanvasMode, watchCanvasViewport } from '../src/canvasLayout';

test('research activity yields to questions, failures and completed results', () => {
  for (const phase of ['planning','searching','cleaning','grouping']) assert.equal(canvasMode('research',phase),'processing');
  assert.equal(canvasMode('research','complete'),'review');
  assert.equal(canvasMode('research','complete',true),'context');
  assert.equal(canvasMode('plan','generating'),'processing');
  assert.equal(canvasMode('plan','checking'),'processing');
  assert.equal(canvasMode('plan','clarification'),'context');
  assert.equal(canvasMode('plan','failed'),'review');
  assert.equal(canvasMode('plan','complete'),'result');
  assert.equal(canvasMode('website'),'context');
  assert.equal(canvasMode('references'),'context');
  assert.equal(canvasMode('unlock'),'review');
  assert.equal(canvasMode('landing'),'landing');
});

test('state updates preserve the playing character and typed input', () => {
  const w=new Window(),app=w.document.createElement('main'),panel=w.document.createElement('section'),video=w.document.createElement('video'),input=w.document.createElement('input');
  app.id='app';input.value='Saved business context';panel.append(input);app.append(video,panel);
  for(const mode of ['processing','review','result'] as const)setCanvasMode(panel as unknown as HTMLElement,mode);
  assert.equal(app.dataset.canvasMode,'result');assert.equal(app.querySelector('video'),video);assert.equal(input.value,'Saved business context');
});

test('keyboard geometry ignores desktop focus, browser chrome and pinch zoom', () => {
  assert.equal(keyboardOpen(true,true,844,430),true);
  assert.equal(keyboardOpen(false,true,844,430),false);
  assert.equal(keyboardOpen(true,false,844,430),false);
  assert.equal(keyboardOpen(true,true,844,780),false);
  assert.equal(keyboardOpen(true,true,844,430,2),false);
});

test('visible viewport shrink and recovery update the tray without clearing its form', () => {
  const w=new Window({width:390,height:844}),app=w.document.createElement('main'),input=w.document.createElement('input');
  w.document.body.append(app);app.append(input);input.value='Preserved';
  const viewport=new w.EventTarget();Object.assign(viewport,{height:844,offsetTop:0,scale:1});
  Object.defineProperty(w,'visualViewport',{value:viewport,configurable:true});
  const previous={window:globalThis.window,document:globalThis.document,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  Object.assign(globalThis,{window:w,document:w.document,requestAnimationFrame:(fn:()=>void)=>{fn();return 1;},cancelAnimationFrame:()=>{}});
  try{
    const stop=watchCanvasViewport(app as unknown as HTMLElement);input.focus();
    Object.assign(viewport,{height:430});viewport.dispatchEvent(new w.Event('resize'));
    assert.equal(app.dataset.keyboard,'true');assert.equal(app.style.getPropertyValue('--keyboard-height'),'430px');
    input.blur();
    assert.equal(app.dataset.keyboard,'true','keep controls stable while Android closes the keyboard after blur');
    Object.assign(viewport,{height:844});viewport.dispatchEvent(new w.Event('resize'));
    assert.equal(app.dataset.keyboard,'false');assert.equal(app.style.getPropertyValue('--keyboard-height'),'');assert.equal(input.value,'Preserved');
    stop();Object.assign(viewport,{height:430});viewport.dispatchEvent(new w.Event('resize'));assert.equal(app.dataset.keyboard,'false');
  }finally{Object.assign(globalThis,previous);}
});
