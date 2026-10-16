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
const emit=(name,value)=>{const snapshot=structuredClone(value);setTimeout(()=>listeners.get(name)?.(snapshot),80);};window.refreshReview=()=>emit('cardReview:get',first);
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
try{for(const [width,height] of [[390,718],[320,568],[375,667],[390,844],[1280,900]]){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
 await page.route('**/convex_browser.js*',r=>r.fulfill({contentType:'application/javascript',body:mock}));await page.goto('http://127.0.0.1:5174/');
 const settle=()=>page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
 const check=async(name,action)=>{await settle();const data=await page.evaluate(()=>{const app=document.querySelector('#app'),p=app.querySelector('.panel'),s=app.querySelector('.stage');return {view:app.dataset.reviewView,stage:s.getBoundingClientRect().height,top:p.getBoundingClientRect().top,bottom:p.getBoundingClientRect().bottom,height:innerHeight,overflow:document.documentElement.scrollHeight-innerHeight,internal:p.scrollHeight-p.clientHeight};});await page.screenshot({path:`artifacts/transition-${name}-${width}x${height}.png`,fullPage:true});results.push({name,width,...data});console.log(results.at(-1));if(data.view==='summary'){assert.ok(data.top>=0&&data.top<Math.max(49,data.height-(data.bottom-data.top)+1),JSON.stringify(data));}else assert.ok(data.top>=0&&data.bottom<=data.height+1,JSON.stringify(data));assert.ok(data.internal<=1);if(action){const button=page.getByRole('button',{name:action,exact:true});if(data.view==='summary')await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=data.height);if(data.view==='summary')await page.evaluate(()=>window.scrollTo(0,0));}};
 await page.getByLabel('What do you offer?').fill('We supply hospital furniture.');await page.getByRole('button',{name:'Plan my website',exact:true}).click();
 await page.getByRole('heading',{name:'Do you have a website I should use as context?'}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByRole('heading',{name:'Any competitor or inspiration sites I should look at?'}).waitFor();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByText('Cluster 1 of 2',{exact:true}).waitFor();await check('card','✓ Accept');
 await page.getByRole('button',{name:'✓ Accept',exact:true}).click();await page.getByText('Cluster 2 of 2',{exact:true}).waitFor();await page.getByRole('button',{name:'✕ Reject',exact:true}).click();await page.getByRole('heading',{name:'Your cluster decisions'}).waitFor();
 await check('summary','Continue');await page.evaluate(()=>window.refreshReview());await page.waitForTimeout(100);await check('summary-update','Continue');
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByRole('heading',{name:'Unlock the full Topic Gibbon plan'}).waitFor();await check('unlock','Enter invite code');
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('heading',{name:'Your cluster decisions'}).waitFor();await check('back-summary','Continue');
 await page.getByRole('button',{name:'Review',exact:true}).first().click();await check('revisit','✓ Accept');
 await page.setViewportSize({width,height:height-60});await check('shorter-card','✓ Accept');await page.getByRole('button',{name:'Review decisions',exact:true}).click();await check('shorter-summary','Continue');
 await page.setViewportSize({width,height});await check('restored-summary','Continue');await context.close();
}fs.writeFileSync('artifacts/review-transition-checks.json',JSON.stringify(results,null,2));}finally{await browser.close();}
