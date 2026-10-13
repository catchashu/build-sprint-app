import test from 'node:test';
import assert from 'node:assert/strict';
import { convexTest } from 'convex-test';
import schema from '../convex/schema';
import { api, internal } from '../convex/_generated/api';
import { planFixture } from './website-plan-fixture';
const modules={'../convex/_generated/server.js':()=>import('../convex/_generated/server.js'),'../convex/websitePlan.ts':()=>import('../convex/websitePlan.ts')};
async function fixture(){
 const {input,plan}=planFixture(),t=convexTest(schema,modules),token='test-private-token';
 const id=await t.run(ctx=>ctx.db.insert('firstValueRuns',{token,offering:input.offering,context:'',state:'complete',searchCount:4,searches:[],responses:['saved provider response'],batches:[],unlock:{via:'comped',at:1,understandingJson:'{}'}}));
 const mapId=await t.run(ctx=>ctx.db.insert('fullResearchRuns',{runId:id,token,offering:input.offering,context:input.context,state:'complete',responses:['saved original evidence'],batches:[],searches:[],confirmedReview:JSON.stringify(input.review),reviewJson:JSON.stringify(input.review),understandingJson:'{}',cards:JSON.stringify(input.review.cards),questionsJson:'[]',answersJson:'[]'}));
 return {t,id,token,mapId,input,plan};
}
test('plan requires unlock and confirmed map; duplicate start and reopening use the saved job without searches',async()=>{
 const {t,id,token,mapId,input,plan}=await fixture();
 await assert.rejects(()=>t.mutation(internal.websitePlan.reserve,{id,token:'wrong'}));
 await t.run(ctx=>ctx.db.patch(mapId,{reviewJson:JSON.stringify({...input.review,accepted:false})}));await assert.rejects(()=>t.mutation(internal.websitePlan.reserve,{id,token}),/Confirm/);
 await t.run(ctx=>ctx.db.patch(mapId,{reviewJson:JSON.stringify(input.review)}));
 const job=await t.mutation(internal.websitePlan.reserve,{id,token});assert.equal(job.run,true);
 assert.deepEqual(await t.mutation(internal.websitePlan.reserve,{id,token}),{planId:job.planId,run:false});
 await t.mutation(internal.websitePlan.saveRaw,{planId:job.planId,rawJson:JSON.stringify(plan)});await t.mutation(internal.websitePlan.finish,{planId:job.planId});
 assert.equal((await t.query(api.websitePlan.get,{id,token})).state,'complete');
 assert.equal((await t.mutation(internal.websitePlan.reserve,{id,token})).run,false);
 const read=await t.query(api.websitePlan.get,{id,token});assert.deepEqual(read.plan,plan);assert.equal('token'in read,false);
 assert.deepEqual((await t.run(ctx=>ctx.db.get(id)))?.responses,['saved provider response']);assert.deepEqual((await t.run(ctx=>ctx.db.get(mapId)))?.responses,['saved original evidence']);
 await t.run(ctx=>ctx.db.patch(id,{unlock:undefined}));await assert.rejects(()=>t.query(api.websitePlan.get,{id,token}),/unlocked/);
});
test('failed corrections preserve old plan; retry is bounded by a single active job and later map edits invalidate it',async()=>{
 const {t,id,token,mapId,input,plan}=await fixture();const original=await t.mutation(internal.websitePlan.reserve,{id,token});
 await t.mutation(internal.websitePlan.saveRaw,{planId:original.planId,rawJson:JSON.stringify(plan)});await t.mutation(internal.websitePlan.finish,{planId:original.planId});
 const args={id,token,expectedId:original.planId,selectedNodeId:'s',correction:'Use clearer editing label'};
 const correction=await t.mutation(internal.websitePlan.reserve,args);
 await assert.rejects(()=>t.mutation(internal.websitePlan.reserve,args),/changed/);
 await t.mutation(internal.websitePlan.finish,{planId:correction.planId,error:'Test failure'});
 assert.deepEqual((await t.query(api.websitePlan.get,{id,token})).plan,plan);
 assert.equal((await t.mutation(internal.websitePlan.reserve,{id,token})).planId,correction.planId);
 const changed={...plan,nodes:plan.nodes.map(n=>n.id==='s'?{...n,label:'Film editing'}:n)};
 await t.mutation(internal.websitePlan.saveRaw,{planId:correction.planId,rawJson:JSON.stringify(changed)});await t.mutation(internal.websitePlan.finish,{planId:correction.planId});
 assert.deepEqual((await t.run(ctx=>ctx.db.get(original.planId)))?.planJson,JSON.stringify(plan));
 await t.run(ctx=>ctx.db.patch(mapId,{reviewJson:JSON.stringify({...input.review,revision:3,accepted:false})}));assert.equal((await t.query(api.websitePlan.get,{id,token})).state,'review_required');
 await t.run(ctx=>ctx.db.patch(mapId,{reviewJson:JSON.stringify({...input.review,revision:3})}));assert.equal((await t.query(api.websitePlan.get,{id,token})).state,'ready');
});
test('consequential plan answer is saved as business context and never as new search evidence',async()=>{
 const {t,id,token,plan}=await fixture();const first=await t.mutation(internal.websitePlan.reserve,{id,token});
 await t.mutation(internal.websitePlan.saveRaw,{planId:first.planId,rawJson:JSON.stringify({...plan,outcome:'needs_clarification',nodes:[],question:'Is editing available separately?'})});await t.mutation(internal.websitePlan.finish,{planId:first.planId});
 const next=await t.mutation(internal.websitePlan.reserve,{id,token,expectedId:first.planId,answer:'Yes, for business films.'});
 const job=await t.run(ctx=>ctx.db.get(next.planId));assert.deepEqual(JSON.parse(job!.inputJson).clarifications,[{question:'Is editing available separately?',answer:'Yes, for business films.'}]);
 assert.equal((await t.run(ctx=>ctx.db.get(id)))?.searchCount,4);
});
