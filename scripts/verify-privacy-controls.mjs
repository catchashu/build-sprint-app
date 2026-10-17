// Local browser regression; uses an existing Playwright installation.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const key='topic-gibbon:privacy-consent:v1';
const geometry=page=>page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,boxes:Object.fromEntries(['.stage','.landing-logo','h1','textarea','.explainers'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{top:r.top+scrollY,height:r.height}];}))}));
try{for(const [width,height]of [[320,568],[390,844],[1280,900]]){
 for(const action of ['Accept','Decline','Close','Escape','Customize']){
  const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
  const page=await context.newPage(),requests=[],errors=[];
  page.on('request',r=>{if(r.url().includes('posthog.com'))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:5174/');await page.evaluate(()=>document.fonts.ready);
  const notice=page.getByRole('dialog',{name:'Optional analytics',exact:true});await notice.waitFor();
  const before=await geometry(page);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);
  assert.equal(await notice.locator('p').first().textContent(),'Optional analytics help us improve Gibbon. Session recordings require separate consent.');
  const bounds=await notice.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=height&&bounds.x>=0&&bounds.x+bounds.width<=width);
  assert.equal(await notice.evaluate(e=>e.scrollHeight>e.clientHeight+1),false);
  const buttons=await notice.locator('.privacy-actions button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,width:r.width,height:r.height};}));
  assert.ok(buttons.every(r=>r.height>=44&&r.width>=44));assert.ok(buttons.every(r=>Math.abs(r.top-buttons[0].top)<1));
  if(action==='Accept')await page.screenshot({path:`artifacts/privacy-compact-${width}.png`});
  if(action==='Escape')await page.keyboard.press('Escape');
  else if(action==='Customize'){
   await notice.getByRole('button',{name:'Customize',exact:true}).click();const choices=page.getByRole('dialog',{name:'Privacy choices',exact:true});
   assert.equal(await choices.getByRole('checkbox').nth(0).isChecked(),false);assert.equal(await choices.getByRole('checkbox').nth(1).isChecked(),false);
   await choices.getByRole('checkbox').nth(1).check();await choices.getByRole('button',{name:'Cancel',exact:true}).click();await notice.waitFor();
   await notice.getByRole('button',{name:'Customize',exact:true}).click();assert.equal(await choices.getByRole('checkbox').nth(1).isChecked(),false);
   await choices.getByRole('checkbox').nth(1).check();await choices.getByRole('button',{name:'Save preferences',exact:true}).click();await choices.waitFor({state:'detached'});
  }else await notice.getByRole('button',{name:action,exact:true}).click();
  await notice.waitFor({state:'detached'});
  const expected={version:1,choiceMade:true,analytics:action==='Accept',recording:action==='Customize'};
  assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key),expected);
  const after=await geometry(page);assert.deepEqual(after,before,'No Landing geometry or page-height changes');assert.ok(after.scrollHeight<=Math.max(height,586),'No new scrolling beyond existing short Landing');
  await page.reload();await page.getByRole('button',{name:'What?',exact:true}).waitFor();assert.equal(await notice.count(),0);
  await page.getByRole('button',{name:'What?',exact:true}).click();await page.getByRole('button',{name:'Privacy',exact:true}).click();const preferences=page.getByRole('dialog',{name:'Privacy choices',exact:true});
  assert.equal(await preferences.getByRole('checkbox').nth(0).isChecked(),expected.analytics);assert.equal(await preferences.getByRole('checkbox').nth(1).isChecked(),expected.recording);
  await preferences.getByRole('button',{name:'Decline optional collection',exact:true}).click();await preferences.waitFor({state:'detached'});await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByLabel('What do you offer?').fill('Synthetic privacy test offering');await page.getByRole('button',{name:'Plan my website',exact:true}).click();
  await page.getByRole('heading',{name:'Do you have a website I should use as context?'}).waitFor();await page.getByRole('button',{name:'Back',exact:true}).click();
  assert.equal(await notice.count(),0);assert.equal(requests.length,0);assert.deepEqual(errors,[]);await context.close();
 }
 console.log(`Compact privacy dialog: all five choices passed at ${width}x${height}`);
}}finally{await browser.close();}
