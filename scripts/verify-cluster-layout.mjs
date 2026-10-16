// Run with Vite running locally. PLAYWRIGHT_MODULE can point to an existing Playwright installation.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const mock=`
const cards = [
 ['Hospital beds for patient care','Hospitals need beds suited to patient care, ward use and adjustable positioning.',['hospital bed supplier india','electric hospital beds','adjustable patient beds']],
 ['Examination room furniture','Clinics need suitable tables and furniture for consultations and examinations.',['examination table supplier','clinical examination couch','doctor examination table']],
 ['Medical equipment rental','People want to rent equipment temporarily for care at home.',['hospital bed rental','medical equipment on rent','patient bed rental near me']]
].map(([label,need,queries],i)=>({groupId:String(i),label,need,queries:queries.map((query,j)=>({id:i+'-'+j,query,volume:null,sources:[{provider:'Google',field:'related_searches.query',reference:'https://www.google.com/search?q='+encodeURIComponent(query),retrievedAt:'2026-10-16'}]}))}));
cards[1].label='Specialist hospital furniture for intensive care, examination rooms, rehabilitation wards and long-term patient positioning across multiple clinical departments';
cards[1].need='Clinical procurement teams need to compare adjustable furniture, cleaning requirements, patient positioning, ward layouts, maintenance support and delivery arrangements before choosing equipment. '.repeat(5);
cards[1].queries=Array.from({length:8},(_,i)=>({...cards[1].queries[i%3],id:'long-'+i,query:'specialist hospital furniture for intensive care and rehabilitation patient positioning with maintenance support and installation '+i}));
const review={revision:0,cards,decisions:Object.fromEntries(cards.map(c=>[c.groupId,'pending'])),accepted:false,pending:null,last:null,notes:[]};
let first,reviewListener;
const run={state:'searching',searchCount:2,searchLimit:4,searches:[{query:'hospital furniture supplier india',status:'complete'}],canRetry:true,cards:null};
const emit=()=>reviewListener?.(structuredClone(review));
window.completeResearch=()=>{run.state='complete';run.error=null;run.cards=JSON.stringify(cards);first(structuredClone(run));};
window.failResearch=()=>{run.state='failed';run.error='There is not enough evidence. Try again or edit your context.';first(structuredClone(run));};
window.setSuggestionsUnavailable=(missing)=>{run.searches=missing?[{query:'sample failed search',status:'failed',error:'Test provider failure'}]:[{query:'sample successful search',status:'complete'}];first(structuredClone(run));};
window.testReview=review;window.testCalls=[];
export class ConvexClient {
 constructor(){}
 onUpdate(api,args,callback){const name=api[Symbol.for('functionName')];if(name==='firstValue:get'){first=callback;callback(structuredClone(run));}else if(name==='cardReview:get'){reviewListener=callback;emit();}return ()=>{};}
 async mutation(api,args){const name=api[Symbol.for('functionName')];window.testCalls.push({name,args});
 if(name==='firstValue:create')return 'sample-run';
 if(name==='cardReview:decision'){if(window.failSave){window.failSave=false;throw Error('Offline');}review.decisions[args.cardId]=args.decision;review.revision++;review.accepted=false;emit();}
 if(name==='cardReview:apply'){review.pending={cardId:args.cardId,id:'fix'};review.last={...args,id:'fix',state:'running'};emit();window.finishCorrection=()=>{review.pending=null;review.last.state='complete';review.cards.find(c=>c.groupId===args.cardId).label='Hospital beds for wards';review.decisions[args.cardId]='pending';review.revision++;emit();};}
 if(name==='cardReview:accept'){review.accepted=true;review.revision++;emit();}
 }
 async action(){return '';}
}`;
const results=[];
try {
for(const [width,height] of [[390,844],[375,667],[320,568],[320,480],[1280,900]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
 await context.addInitScript(()=>{const v=new EventTarget();Object.assign(v,{height:innerHeight,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{value:v});window.setTestKeyboard=(height)=>{v.height=height;v.dispatchEvent(new Event('resize'));};});
 const page=await context.newPage();page.on('pageerror',e=>console.log('PAGEERROR',e.message));
 await page.route('**/convex_browser.js*',r=>r.fulfill({contentType:'application/javascript',body:mock}));
 await page.goto('http://127.0.0.1:5174/');
 await page.getByLabel('What do you offer?').fill('We supply hospital beds and examination tables to hospitals in India.');
 await page.getByRole('button',{name:'Plan my website',exact:true}).click();
 await page.getByRole('heading',{name:'Do you have a website I should use as context?'}).waitFor();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Any competitor or inspiration sites I should look at?'}).waitFor();
 await page.evaluate(()=>{window.originalVideo=document.querySelector('video');window.resets=0;originalVideo.addEventListener('loadstart',()=>window.resets++);});
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Finding your customers',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#app').dataset.trayMoving);
 const capture=async name=>{await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});await page.screenshot({path:'artifacts/stable-deck-'+name+'-'+width+'x'+height+'.png',fullPage:true});};
 const fit=async name=>{const metric=await page.evaluate(()=>{const p=document.querySelector('.panel');return {page:document.documentElement.scrollHeight-innerHeight,internal:p.scrollHeight-p.clientHeight,horizontal:document.documentElement.scrollWidth-innerWidth};});results.push({width,height,name,...metric});assert.ok(metric.internal<=1,JSON.stringify({name,width,...metric}));assert.ok(metric.horizontal<=1);if(width>=375)assert.ok(metric.page<=1,JSON.stringify({name,width,...metric}));};
 await fit('research');await capture('research');
 await page.evaluate(()=>window.failResearch());
 assert.match(await page.locator('#message').textContent(),/not enough evidence/);
 assert.equal(await page.getByRole('button',{name:'Try again',exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'Edit context',exact:true}).isVisible(),true);
 await page.evaluate(()=>window.completeResearch());
 await page.getByText('Cluster 1 of 3',{exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('#app').dataset.trayMoving);
 await fit('cluster');await capture('cluster');
 await page.evaluate(()=>window.setSuggestionsUnavailable(true));
 assert.equal(await page.locator('#message').textContent(),'');
 assert.equal(await page.locator('.initial-activity li.error').count(),1);
 await page.getByRole('button',{name:/View all searches|Read full cluster and view all searches/}).click();
 assert.equal(await page.locator('dialog .coverage-note').isVisible(),true);
 assert.equal(await page.locator('dialog .coverage-note').getAttribute('role'),null);
 assert.equal(await page.locator('dialog .coverage-note.error').count(),0);
 await capture('coverage-note');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Review decisions',exact:true}).click();
 assert.equal(await page.locator('#message').textContent(),'');assert.equal(await page.locator('.coverage-note').count(),0);
 await page.getByRole('button',{name:'Review',exact:true}).first().click();
 await page.evaluate(()=>window.setSuggestionsUnavailable(false));
 await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const geometry=()=>page.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return [r.y,r.height];};return {panel:rect('.panel'),stage:rect('.stage'),nav:rect('.deck-navigation'),card:rect('article:not([hidden])'),title:rect('article:not([hidden]) h3'),actions:rect('article:not([hidden])>.review-actions')};});
 const baseline=await geometry();
 const stable=async label=>{const actual=await geometry();for(const key of ['panel','stage','nav','card','actions'])for(let i=0;i<2;i++)assert.ok(Math.abs(actual[key][i]-baseline[key][i])<1,JSON.stringify({label,width,key,actual,baseline}));results.push({width,label,stable:true});};
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await stable('long cluster');await fit('long cluster');assert.equal(await page.evaluate(()=>innerWidth),width);await capture('long-cluster');
 const evidenceBefore=await page.evaluate(()=>JSON.stringify(window.testReview.cards[1]));
 const cardBounds=await page.locator('article:visible').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));assert.ok(cardBounds.scroll<=cardBounds.height+1,JSON.stringify(cardBounds));
 await page.getByRole('button',{name:'Read full cluster and view all searches',exact:true}).click();
 assert.equal(await page.locator('dialog li').count(),8);assert.equal(await page.locator('dialog>p').first().textContent(),await page.evaluate(()=>window.testReview.cards[1].need));
 await capture('long-evidence');await page.getByRole('button',{name:'Close',exact:true}).click();
 assert.equal(await page.evaluate(()=>JSON.stringify(window.testReview.cards[1])),evidenceBefore);
 await page.getByRole('button',{name:'Fix this',exact:true}).click();await page.getByLabel('Choose what needs fixing.').selectOption('split');
 await page.waitForFunction(()=>!document.querySelector('#app').dataset.trayMoving);
 const correctionFrame=await geometry();for(const key of ['panel','stage','nav'])assert.deepEqual(correctionFrame[key],baseline[key]);
 const applyBox=await page.getByRole('button',{name:'Apply fix',exact:true}).boundingBox();assert.ok(applyBox.y>=0&&applyBox.y+applyBox.height<=height);
 await capture('long-correction');await page.getByRole('button',{name:'Cancel',exact:true}).click();await stable('cancel long correction');
 await page.getByRole('button',{name:'Previous',exact:true}).click();await stable('revisit short');
 assert.equal(await page.locator('article:visible').count(),1);
 await page.getByRole('button',{name:/View all searches|Read full cluster and view all searches/}).click();await page.getByRole('dialog').waitFor();
 await page.getByText('Source',{exact:true}).first().click();assert.equal(await page.getByRole('link').count(),1);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Fix this',exact:true}).click();await page.getByLabel('Choose what needs fixing.').selectOption('label');
 await page.getByLabel('Tell me what I should understand instead.').fill('These are beds supplied to hospital wards, not home rental.');
 await page.waitForFunction(()=>!document.querySelector('#app').dataset.trayMoving);
 await fit('correction');await capture('correction');
 if(width<600){await page.evaluate(()=>window.setTestKeyboard(330));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='true');const b=await page.getByRole('button',{name:'Apply fix',exact:true}).boundingBox();results.push({width,name:'keyboard',applyBottom:b.y+b.height});assert.ok(b.y+b.height<=330);await capture('keyboard');await page.evaluate(()=>window.setTestKeyboard(innerHeight));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='false');}
 await page.getByRole('button',{name:'Apply fix',exact:true}).click();await page.evaluate(()=>window.finishCorrection());
 await page.getByRole('heading',{name:'Hospital beds for wards',exact:true}).waitFor();await stable('after correction');
 await page.evaluate(()=>window.failSave=true);await page.getByRole('button',{name:'✓ Accept',exact:true}).click();await page.getByText(/couldn’t save that change/).waitFor();assert.equal(await page.locator('article:visible').getAttribute('data-card-id'),'0');
 await page.getByRole('button',{name:'✓ Accept',exact:true}).click();await page.getByText('Cluster 2 of 3',{exact:true}).waitFor();await stable('accepted short to long');
 await page.getByRole('button',{name:'✕ Reject',exact:true}).click();await page.getByText('Cluster 3 of 3',{exact:true}).waitFor();await stable('rejected long to short');
 await page.getByRole('button',{name:'✕ Reject',exact:true}).click();await page.getByRole('heading',{name:'Your cluster decisions'}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('#app').dataset.trayMoving);await capture('summary');
 await page.getByRole('button',{name:'Review',exact:true}).last().click();await page.getByRole('button',{name:'✓ Accept',exact:true}).click();
 await page.getByRole('button',{name:'Review',exact:true}).nth(1).click();await page.getByRole('button',{name:'✓ Accept',exact:true}).click();await page.getByText('3 accepted · 0 rejected · 0 to review',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.originalVideo===document.querySelector('video')&&window.resets===0),true);
 await page.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await page.locator('#app').getAttribute('data-canvas-step'),'unlock');
 await context.close();
}
fs.writeFileSync('artifacts/stable-deck-browser-checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
} finally {await browser.close();}
