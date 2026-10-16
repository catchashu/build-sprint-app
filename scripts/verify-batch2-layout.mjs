// Local browser regression. Set PLAYWRIGHT_MODULE to an existing Playwright installation if needed.
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import assert from 'node:assert/strict';
import fs from 'node:fs';
const mock=`
const cards=[['Hospital beds','Hospitals need adjustable beds for patient care.'],['Examination furniture','Clinics need tables suitable for consultations and examinations.']].map(([label,need],i)=>({groupId:String(i),label,need,queries:Array.from({length:5},(_,j)=>({id:i+'-'+j,query:['hospital furniture suppliers','adjustable patient beds','clinical examination tables','hospital ward furniture','medical furniture maintenance'][j],volume:null,sources:[{provider:'Google',field:'related_searches.query',reference:'https://google.com/search?q=hospital+furniture',retrievedAt:'2026-10-16'}]}))}));
const first={revision:0,accepted:false,cards,decisions:{0:'pending',1:'pending'},pending:null,last:null,notes:[]};
const map={...structuredClone(first),unlocked:false,clarificationPending:true};
const payment={accepted:true,unlocked:null,paymentReady:false,inviteReady:true,orderPending:false,testMode:true};
const research={state:'ready',searches:[],searchCount:0,hasCards:false,questions:[],answers:[]};
const listeners=new Map();window.calls=[];
const emit=(name,value)=>listeners.get(name)?.(structuredClone(value));
window.updateActivity=(count)=>{research.searches=Array.from({length:count},(_,i)=>({query:'Hospital furniture search '+i,status:i===count-1?'running':'complete'}));research.searchCount=count;research.state=count>3?'grouping':'searching';emit('fullResearch:get',research);};
window.finishFullResearch=()=>{research.state='complete';research.hasCards=true;research.searchCount=4;research.searches=[{query:'sample search',status:'failed',error:'Sample provider failure'}];research.questions=[{id:'q1',question:'Do you supply furniture for home care as well as hospitals?',reason:'This changes which customer needs should be included.'},{id:'q2',question:'Is installation included in your offering?',reason:'This changes how we interpret installation searches.'}];emit('fullResearch:get',research);};
function answer(id){research.answers.push({questionId:id});map.clarificationPending=research.questions.some(q=>!research.answers.some(a=>a.questionId===q.id));emit('fullResearch:get',research);emit('mapReview:get',map);}
export class ConvexClient{
 onUpdate(api,args,callback){const name=api[Symbol.for('functionName')];listeners.set(name,callback);if(name==='firstValue:get')callback({state:'complete',searchCount:4,searchLimit:4,searches:[],cards:JSON.stringify(cards)});if(name==='cardReview:get')emit(name,first);if(name==='payments:get')emit(name,payment);if(name==='fullResearch:get')emit(name,research);if(name==='mapReview:get')emit(name,map);return()=>listeners.delete(name);}
 async mutation(api,args){const name=api[Symbol.for('functionName')];window.calls.push(name);
 if(name==='firstValue:create')return 'sample';
 if(name==='cardReview:decision'||name==='mapReview:decision'){const view=name.startsWith('map')?map:first;view.decisions[args.cardId]=args.decision;view.accepted=false;view.revision++;emit(name.startsWith('map')?'mapReview:get':'cardReview:get',view);}
 if(name==='cardReview:accept'||name==='mapReview:accept'){const view=name.startsWith('map')?map:first;view.accepted=true;view.revision++;emit(name.startsWith('map')?'mapReview:get':'cardReview:get',view);}
 if(name==='payments:invite'){if(args.code!=='SAMPLE'){return {ok:false,message:'That invite code is not valid. Check it and try again.'};}payment.unlocked={via:'comped'};emit('payments:get',payment);return {ok:true,message:'Invite accepted.'};}
 if(name==='fullResearch:start'){research.state='searching';queueMicrotask(()=>emit('fullResearch:get',research));}
 if(name==='fullResearch:answer')answer(args.questionId);
 }
 async action(api,args){const name=api[Symbol.for('functionName')];window.calls.push(name);if(name==='fullResearch:customAnswer')answer(args.questionId);return '';}
}`;
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{for(const [width,height]of [[320,568],[375,667],[390,844],[1280,900]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});
 await context.addInitScript(()=>{const viewport=new EventTarget();Object.assign(viewport,{height:innerHeight,offsetTop:0,scale:1});Object.defineProperty(window,'visualViewport',{value:viewport});window.keyboard=h=>{viewport.height=h;viewport.dispatchEvent(new Event('resize'));};});
 const page=await context.newPage();await page.route('**/convex_browser.js*',r=>r.fulfill({contentType:'application/javascript',body:mock}));
 await page.goto('http://127.0.0.1:5174/');
 const settle=()=>page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
 const capture=async name=>{await settle();await page.screenshot({path:'artifacts/batch2-'+name+'-'+width+'x'+height+'.png',fullPage:true});};
 const fit=async name=>{await settle();const data=await page.evaluate(()=>{const p=document.querySelector('.panel');return {width:innerWidth,overflow:document.documentElement.scrollHeight-innerHeight,trayScroll:p.scrollHeight-p.clientHeight};});assert.equal(data.width,width);assert.ok(data.overflow<=1,JSON.stringify({name,width,...data}));assert.ok(data.trayScroll<=1,JSON.stringify({name,width,...data}));results.push({name,width,height,...data});};
 await page.getByLabel('What do you offer?').fill('We supply hospital furniture.');await page.getByRole('button',{name:'Plan my website',exact:true}).click();
 await page.getByRole('heading',{name:'Do you have a website I should use as context?'}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Any competitor or inspiration sites I should look at?'}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('button',{name:'✓ Accept',exact:true}).click();await page.getByRole('button',{name:'✓ Accept',exact:true}).click();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Unlock the full Topic Gibbon plan'}).waitFor();await capture('unlock');await fit('unlock');
 assert.equal(await page.getByText(/Payment options/).isVisible(),false);
 const anchored=async()=>{await settle();const box=await page.locator('.panel').boundingBox();assert.ok(Math.abs(box.y+box.height-(await page.evaluate(()=>innerHeight)))<1,'Unlock tray must meet viewport bottom');};
 await anchored();await page.setViewportSize({width,height:height+60});await anchored();await page.setViewportSize({width,height});await anchored();
 await page.getByRole('button',{name:'Enter invite code',exact:true}).click();await page.getByLabel('Enter invite code').fill('WRONG');await fit('invite');await capture('invite');await anchored();
 await page.getByRole('button',{name:'Show code',exact:true}).click();assert.equal(await page.getByLabel('Enter invite code').getAttribute('type'),'text');
 await page.getByRole('button',{name:'Hide code',exact:true}).click();assert.equal(await page.getByLabel('Enter invite code').getAttribute('type'),'password');
 await page.getByRole('button',{name:'Back to unlock options',exact:true}).click();await anchored();
 await page.getByRole('button',{name:'Enter invite code',exact:true}).click();assert.equal(await page.getByLabel('Enter invite code').inputValue(),'WRONG');
 if(width<600){await page.evaluate(()=>window.keyboard(330));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='true');await settle();const b=await page.getByRole('button',{name:'Apply',exact:true}).boundingBox();assert.ok(b.y+b.height<=330);await capture('invite-keyboard');await page.evaluate(()=>window.keyboard(innerHeight));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='false');}
 await page.getByRole('button',{name:'Apply',exact:true}).click();await page.getByText(/That invite code is not valid/).waitFor();
 await page.getByRole('button',{name:'Clear code',exact:true}).click();await page.getByLabel('Enter invite code').fill('SAMPLE');
 await page.evaluate(()=>{window.player=document.querySelector('video');window.resets=0;player.addEventListener('loadstart',()=>window.resets++);});
 await page.getByRole('button',{name:'Apply',exact:true}).click();await page.getByRole('heading',{name:'Researching real search demand in India'}).waitFor();await fit('research');await capture('research');
 assert.equal(await page.locator('.search-activity').getAttribute('open'),'');
 const geometry=()=>page.locator('.panel').boundingBox();const beforeActivity=await geometry();
 await page.evaluate(()=>window.updateActivity(3));await settle();assert.deepEqual(await geometry(),beforeActivity);
 await page.evaluate(()=>window.updateActivity(7));await settle();assert.deepEqual(await geometry(),beforeActivity);
 assert.equal(await page.locator('.recent-searches li').count(),3);assert.match(await page.locator('.recent-searches li').first().innerText(),/search 6.*running/s);await fit('recent-activity');await capture('recent-activity');
 await page.getByRole('button',{name:'View all search activity',exact:true}).click();assert.equal(await page.locator('.search-history li').count(),7);await capture('activity-history');await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.search-activity>summary').click();await page.evaluate(()=>window.updateActivity(8));assert.equal(await page.locator('.search-activity').getAttribute('open'),null);
 await page.locator('.search-activity>summary').click();await fit('activity-reopened');
 await page.evaluate(()=>window.finishFullResearch());await page.getByText('Do you supply furniture for home care as well as hospitals?',{exact:true}).waitFor();assert.equal(await page.locator('.demand-map').isVisible(),false);await fit('question');await capture('question');
 await page.getByRole('button',{name:'This is part of my offering',exact:true}).click();await page.getByText('Is installation included in your offering?',{exact:true}).waitFor();
 await page.getByText('Something else',{exact:true}).click();await page.getByLabel('Tell me what I should understand instead.').fill('Installation is available only for larger hospital orders.');
 if(width<600){await page.evaluate(()=>window.keyboard(330));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='true');await settle();const b=await page.getByRole('button',{name:'Use this answer',exact:true}).boundingBox();await capture('question-keyboard');assert.ok(b.y+b.height<=330,JSON.stringify(b));await page.evaluate(()=>window.keyboard(innerHeight));await page.waitForFunction(()=>document.querySelector('#app').dataset.keyboard==='false');}
 await page.getByRole('button',{name:'Use this answer',exact:true}).click();await page.getByText('Cluster 1 of 2',{exact:true}).waitFor();await fit('map');await capture('map');
 await page.getByRole('button',{name:/View all searches|Read full cluster and view all searches/}).click();assert.equal(await page.locator('dialog li').count(),5);assert.equal(await page.locator('dialog .coverage-note').isVisible(),true);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'✓ Accept',exact:true}).click();await page.getByRole('button',{name:'✕ Reject',exact:true}).click();await page.getByRole('heading',{name:'Your cluster decisions'}).waitFor();await capture('summary');
 assert.equal(await page.evaluate(()=>player===document.querySelector('video')&&resets===0),true);
 await page.getByRole('button',{name:'Confirm demand map',exact:true}).click();assert.equal(await page.locator('#app').getAttribute('data-canvas-step'),'plan');
 const calls=await page.evaluate(()=>window.calls);assert.equal(calls.filter(n=>n==='fullResearch:start').length,1);assert.equal(calls.filter(n=>n==='mapReview:accept').length,1);assert.equal(calls.filter(n=>n==='payments:createOrder').length,0);
 await context.close();
}fs.writeFileSync('artifacts/batch2-browser-checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
