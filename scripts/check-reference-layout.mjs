// Run against a local Vite preview. Supply PLAYWRIGHT_MODULE if Playwright is provided outside this project.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const previewUrl=process.env.PREVIEW_URL || 'http://127.0.0.1:5174/';
import assert from 'node:assert/strict';
import fs from 'node:fs';
fs.mkdirSync('artifacts',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
for(const [width,height] of [[375,667],[390,844],[320,568],[1280,900]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
 await context.addInitScript(()=>{const v=new EventTarget();Object.assign(v,{height:innerHeight,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{value:v});window.setTestKeyboard=(height,offsetTop=0)=>{v.height=height;v.offsetTop=offsetTop;v.dispatchEvent(new Event('resize'));};});
 const page=await context.newPage();await page.goto(previewUrl);
 await page.getByLabel('What do you offer?').fill('We supply frozen momos to cafes in Delhi.');await page.getByRole('button',{name:'Plan my website',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#app').dataset.canvasStep==='website'&&!document.querySelector('#app').dataset.trayMoving);
 await page.evaluate(()=>{window.originalVideo=document.querySelector('video');window.resets=0;originalVideo.addEventListener('loadstart',()=>window.resets++);window.samples=[];window.sampling=true;function frame(){samples.push(document.querySelector('.panel').getBoundingClientRect().height);if(sampling)requestAnimationFrame(frame);}frame();});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#app').dataset.canvasStep==='references'&&!document.querySelector('#app').dataset.trayMoving);
 const metrics=await page.evaluate(()=>{sampling=false;const p=document.querySelector('.panel'),r=p.getBoundingClientRect();return {width:innerWidth,height:innerHeight,panelHeight:r.height,panelBottom:r.bottom,scroll:p.scrollHeight-p.clientHeight,pageOverflow:document.documentElement.scrollHeight-innerHeight,intermediateHeights:new Set(samples.map(Math.round)).size,videoSame:originalVideo===document.querySelector('video'),resets};});
 assert.ok(metrics.scroll<=1);assert.ok(metrics.pageOverflow<=1);assert.ok(metrics.panelBottom<=height+1);assert.ok(metrics.intermediateHeights>3);assert.equal(metrics.videoSame,true);assert.equal(metrics.resets,0);
 for(const label of ['Reference website 1 (optional)','Reference website 2 (optional)']){const r=await page.getByLabel(label).boundingBox();assert.ok(r.y+r.height<=height);}
 await page.screenshot({path:`artifacts/step2-references-${width}x${height}.png`});
 const first=page.getByLabel('Reference website 1 (optional)'),second=page.getByLabel('Reference website 2 (optional)');
 await first.fill('https://example.com');await second.fill('https://example.org');
 if(width<600){
  // No test-side scrolling: focusing either field must be handled by the app.
  await first.focus();
  await page.evaluate(()=>window.setTestKeyboard(300));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='true');
  async function visible(locator,bottom,top=0){await page.waitForFunction(({name,bottom,top})=>{const input=[...document.querySelectorAll('input')].find(i=>i.closest('label')?.textContent.includes(name));const r=input.getBoundingClientRect();return r.top>=top&&r.bottom<=bottom;},{name:await locator.evaluate(i=>i.closest('label').textContent),bottom,top});}
  await visible(first,300);
  await second.focus();await visible(second,300);
  await first.focus();await visible(first,300);
  // Keyboard animation and browser panning can arrive in multiple viewport events.
  await page.evaluate(()=>window.setTestKeyboard(230,45));await visible(first,275,45);
  await second.focus();await visible(second,275,45);
  await page.evaluate(()=>window.setTestKeyboard(300,0));await visible(second,300);
  const next=page.getByRole('button',{name:'Continue',exact:true});const box=await next.boundingBox();assert.ok(box.y+box.height<=301);
  await page.evaluate(()=>{const k=document.createElement('div');k.id='keyboard-preview';k.textContent='Simulated Android keyboard area';Object.assign(k.style,{position:'fixed',top:'300px',bottom:'0',left:'0',right:'0',background:'#20232d',color:'white',display:'grid',placeItems:'center',fontSize:'14px',zIndex:'999'});document.body.append(k);});
  await page.screenshot({path:`artifacts/step2-keyboard-${width}x${height}.png`});
  await page.evaluate(()=>document.querySelector('#keyboard-preview').remove());
  await page.evaluate(()=>window.setTestKeyboard(innerHeight));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='false');assert.equal(await page.locator('.panel').evaluate(p=>p.scrollTop),0);
 }
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#app').dataset.canvasStep==='website'&&!document.querySelector('#app').dataset.trayMoving);
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#app').dataset.canvasStep==='references'&&!document.querySelector('#app').dataset.trayMoving);
 assert.equal(await first.inputValue(),'https://example.com');assert.equal(await second.inputValue(),'https://example.org');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await page.locator('#app').getAttribute('data-tray-moving'),null);
 results.push(metrics);await context.close();
}
console.log(JSON.stringify(results));fs.writeFileSync('artifacts/step2-checks.json',JSON.stringify(results,null,2));
// Exercise Continue with both optional fields blank through the real UI, substituting only the backend client to avoid starting paid research.
const context=await browser.newContext();const page=await context.newPage();
await page.route('**/convex_browser.js*',route=>route.fulfill({contentType:'application/javascript',body:`export class ConvexClient { constructor(){window.calls=[];} async mutation(name,args){window.calls.push({kind:'mutation',args});return 'test-run';} async action(name,args){window.calls.push({kind:'action',args});return '';} onUpdate(){return ()=>{};} }`}));
await page.goto(previewUrl);await page.getByLabel('What do you offer?').fill('We supply hospital beds.');await page.getByRole('button',{name:'Plan my website',exact:true}).click();await page.getByRole('heading',{name:'Do you have a website I should use as context?'}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('heading',{name:'Any competitor or inspiration sites I should look at?'}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForFunction(()=>window.calls?.length===2);
const calls=await page.evaluate(()=>window.calls);assert.deepEqual(calls.map(c=>c.kind),['mutation','mutation']);assert.equal(calls[0].args.context,'');assert.equal(calls[0].args.offering,'We supply hospital beds.');assert.equal(await page.locator('#app').getAttribute('data-canvas-step'),'result');console.log('PASS: both optional references blank proceeds to research handoff; backend mocked, no paid searches.');
await browser.close();
