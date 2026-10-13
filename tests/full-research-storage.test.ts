import test from 'node:test';
import assert from 'node:assert/strict';
import {convexTest} from 'convex-test';
import schema from '../convex/schema.ts';
import {api,internal} from '../convex/_generated/api.js';
const modules={'../convex/_generated/server.js':()=>import('../convex/_generated/server.js'),'../convex/fullResearch.ts':()=>import('../convex/fullResearch.ts'),'../convex/mapReview.ts':()=>import('../convex/mapReview.ts')};
async function fixture(){
 const t=convexTest(schema,modules),token='test-token-with-more-than-thirty-two-characters';
 const source={provider:'SerpAPI',reference:'https://serpapi.com/searches/test.json',field:'related_searches.query',retrievedAt:'2026-10-12'};
 const evidence=[1,2,3].map(i=>({id:`e${i}`,query:`Observed ${i}`,volume:null,sources:[source]}));
 const review={revision:0,accepted:true,cards:[{groupId:'a',label:'Confirmed',need:'User meaning',queries:evidence.slice(0,2)}],decisions:{a:'correct'},notes:[]};
 const id=await t.run(ctx=>ctx.db.insert('firstValueRuns',{token,offering:'Test offering',context:'',state:'complete',searchCount:2,searches:[],responses:[],batches:[],cards:JSON.stringify(review.cards),reviewJson:JSON.stringify(review)}));
 const researchId=await t.run(ctx=>ctx.db.insert('fullResearchRuns',{runId:id,token,offering:'Test offering',context:'{}',state:'planning',responses:[],batches:[],searches:[],confirmedReview:JSON.stringify(review),seeds:['one','two']}));
 return {t,token,id,researchId,review,evidence};
}
test('research requires unlock; re-entry is idempotent and capability tokens remain private',async()=>{
 const {t,id,token,researchId}=await fixture();
 await assert.rejects(()=>t.mutation(api.fullResearch.start,{id,token}),/Unlock/);
 await t.run(ctx=>ctx.db.patch(id,{unlock:{via:'comped',at:1,understandingJson:'{}',reviewJson:'{}'}}));
 await t.mutation(api.fullResearch.start,{id,token});await t.mutation(api.fullResearch.start,{id,token});
 assert.equal((await t.run(ctx=>ctx.db.get(researchId)))?.searches.length,0);
 assert.equal(await t.query(api.fullResearch.get,{id,token:'wrong'}),null);
 const view=await t.query(api.fullResearch.get,{id,token});assert.ok(view);assert.equal('token' in view,false);assert.equal('responses' in view,false);
});
test('completed search is durable and duplicate finishes cannot add or overwrite evidence',async()=>{
 const {t,researchId}=await fixture();
 const first=await t.mutation(internal.fullResearch.reserve,{researchId});assert.ok(first);assert.equal(first.query,'one');
 await t.mutation(internal.fullResearch.finishSearch,{researchId,index:first.index,response:'saved original'});
 await t.mutation(internal.fullResearch.finishSearch,{researchId,index:first.index,response:'duplicate'});
 const second=await t.mutation(internal.fullResearch.reserve,{researchId});assert.ok(second);assert.equal(second.query,'two');
 assert.deepEqual((await t.run(ctx=>ctx.db.get(researchId)))?.responses,['saved original']);
});
test('clarification adds only supplied evidence once and is required before map confirmation',async()=>{
 const {t,id,token,researchId,review,evidence}=await fixture();
 const map={cards:review.cards,excluded:[],unresolved:[{evidence:evidence[2],question:'Offered?',reason:'Unknown'}]};
 await t.mutation(internal.fullResearch.complete,{researchId,mapJson:JSON.stringify(map),questionsJson:JSON.stringify([{id:'q',question:'Do you offer this?',label:'Clarified area',need:'Confirmed need',evidenceIds:['e3'],reason:'Would change coverage'}])});
 await assert.rejects(()=>t.mutation(api.mapReview.accept,{id,token,revision:0}),/clarification/);
 await assert.rejects(()=>t.mutation(api.fullResearch.answer,{id,token:'wrong',questionId:'q',answer:'relevant'}));
 await t.mutation(api.fullResearch.answer,{id,token,questionId:'q',answer:'relevant'});
 await t.mutation(api.fullResearch.answer,{id,token,questionId:'q',answer:'relevant'});
 const view=await t.query(api.mapReview.get,{id,token});assert.ok(view);assert.equal(view.cards.length,2);assert.deepEqual(view.cards[1].queries,[evidence[2]]);
 await t.mutation(api.mapReview.accept,{id,token,revision:view.revision});
 assert.equal((await t.query(api.mapReview.get,{id,token}))?.accepted,true);
 assert.equal((await t.run(ctx=>ctx.db.get(id)))?.searchCount,2);
});
test('map correction preserves source evidence and leaves the original first view unchanged',async()=>{
 const {t,id,token,researchId,review}=await fixture();
 await t.mutation(internal.fullResearch.complete,{researchId,mapJson:JSON.stringify({cards:review.cards,excluded:[],unresolved:[]}),questionsJson:'[]'});
 const jobId=await t.run(ctx=>ctx.db.insert('mapCorrections',{runId:id,cardId:'a',kind:'label',note:'Corrected need',revision:0,requestId:'test-correction-request',state:'running'}));
 await t.run(ctx=>ctx.db.patch(researchId,{reviewPending:jobId,reviewLast:jobId}));
 await t.mutation(internal.mapReview.finish,{jobId,resultJson:JSON.stringify({outcome:'updated',label:'Corrected',need:'Corrected need',explanation:'Used user correction'})});
 const view=await t.query(api.mapReview.get,{id,token});assert.ok(view);assert.equal(view.cards[0].label,'Corrected');assert.deepEqual(view.cards[0].queries,review.cards[0].queries);
 assert.equal(JSON.parse((await t.run(ctx=>ctx.db.get(id)))!.cards!)[0].label,'Confirmed');
 await assert.rejects(()=>t.mutation(api.mapReview.accept,{id,token,revision:view.revision}));
});
