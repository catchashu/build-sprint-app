import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {convexTest} from 'convex-test';
import schema from '../convex/schema';
import {api,internal} from '../convex/_generated/api';
const modules={'../convex/_generated/server.js':()=>import('../convex/_generated/server.js'),'../convex/searchVolume.ts':()=>import('../convex/searchVolume.ts')};
function environment(ctx:TestContext, flag:string|undefined='true', login:string|undefined='test-login', password:string|undefined='test-password'){
 const values={USE_DATAFORSEO:flag,DATAFORSEO_LOGIN:login,DATAFORSEO_PASSWORD:password};
 const previous=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));
 for(const [k,v] of Object.entries(values)){if(v===undefined)delete process.env[k];else process.env[k]=v;}
 ctx.after(()=>{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
 ctx.mock.timers.enable({apis:['setTimeout']});
}
function mockFetch(ctx:TestContext, implementation:typeof fetch){
 const previous=globalThis.fetch;const mock=ctx.mock.fn(implementation);globalThis.fetch=mock;
 ctx.after(()=>{globalThis.fetch=previous;});return mock;
}
async function fixture(){
 const t=convexTest(schema,modules),token='test-only';
 const id=await t.run(ctx=>ctx.db.insert('firstValueRuns',{token,offering:'Films',context:'',state:'complete',searchCount:1,searches:[],responses:[],batches:[],unlock:{via:'comped',at:1,understandingJson:'{}'}}));
 const response=JSON.stringify({search_metadata:{id:'test',status:'Success'},search_parameters:{gl:'in'},related_searches:[{query:'corporate film'}]});
 const researchId=await t.run(ctx=>ctx.db.insert('fullResearchRuns',{runId:id,token,offering:'Films',context:'{}',state:'complete',responses:[response],batches:[],searches:[],confirmedReview:'{}',reviewJson:'{}'}));
 return {t,id,token,researchId,response};
}
test('volume reservation is single-use and cannot repeat a possibly billed request after failure or expiry',async ctx=>{
 environment(ctx);
 const {t,researchId,response}=await fixture();
 const reserved=await Promise.all([t.mutation(internal.searchVolume.reserve,{researchId}),t.mutation(internal.searchVolume.reserve,{researchId})]);
 assert.equal(reserved.filter(x=>x!==null).length,1);
 assert.deepEqual(reserved.find(x=>x!==null),['corporate film']);
 await t.mutation(internal.searchVolume.expire,{researchId});
 assert.equal(await t.mutation(internal.searchVolume.reserve,{researchId}),null);
 await t.mutation(internal.searchVolume.finish,{researchId,json:JSON.stringify({taskId:'late',retrievedAt:'2026-10-13',cost:0.09,rows:[]})});
 const run=await t.run(ctx=>ctx.db.get(researchId));
 assert.equal(run?.volumeState,'unavailable');assert.equal(run?.volumeJson,undefined);
 assert.deepEqual(run?.responses,[response]);assert.equal(run?.reviewJson,'{}');
});
test('only the unlocked run owner can queue volumes; completion preserves zero and cannot be overwritten',async ctx=>{
 environment(ctx);
 const {t,id,token,researchId}=await fixture();
 await assert.rejects(()=>t.mutation(api.searchVolume.start,{id,token:'wrong'}));
 await t.run(ctx=>ctx.db.patch(id,{unlock:undefined}));
 await assert.rejects(()=>t.mutation(api.searchVolume.start,{id,token}));
 await t.run(ctx=>ctx.db.patch(id,{unlock:{via:'comped',at:1,understandingJson:'{}'}}));
 await t.mutation(internal.searchVolume.reserve,{researchId});
 const json=JSON.stringify({taskId:'saved',retrievedAt:'2026-10-13',cost:0.09,rows:[{keyword:'corporate film',volume:0,monthly:[]}]});
 await t.mutation(internal.searchVolume.finish,{researchId,json});
 await t.mutation(internal.searchVolume.finish,{researchId});
 await t.mutation(api.searchVolume.start,{id,token});
 assert.equal((await t.run(ctx=>ctx.db.get(researchId)))?.volumeJson,json);
});

for(const [label,flag,login,password] of [
 ['disabled','false','test-login','test-password'],['unset',undefined,'test-login','test-password'],
 ['not explicitly true','TRUE','test-login','test-password'],['missing login','true','','test-password'],['missing password','true','test-login',''],
] as const)test(`DataForSEO ${label}: no network, no queued work, no changes to completed research`,async ctx=>{
 environment(ctx,flag,login,password);
 // The default parameter is deliberate for existing enabled tests; remove the
 // flag explicitly to exercise the default-off state here.
 if(flag===undefined)delete process.env.USE_DATAFORSEO;
 const fetch=mockFetch(ctx,async()=>{throw Error('Must not contact the provider');});
 const {t,id,token,researchId}=await fixture(),before=await t.run(c=>c.db.get(researchId));
 await t.mutation(api.searchVolume.start,{id,token});
 await t.action(internal.searchVolume.lookup,{researchId});
 await t.mutation(internal.searchVolume.retryUnavailable,{researchId});
 const connection=await t.action(internal.searchVolume.connection,{});
 assert.equal(connection.enabled,false);assert.equal(fetch.mock.callCount(),0);
 assert.deepEqual(await t.run(c=>c.db.get(researchId)),before);
});

test('turning enrichment off clears an earlier queued job without contacting the provider',async ctx=>{
 environment(ctx,'false');const {t,researchId}=await fixture();
 const fetch=mockFetch(ctx,async()=>{throw Error('Must not contact the provider');});
 await t.run(c=>c.db.patch(researchId,{volumeState:'queued'}));
 await t.action(internal.searchVolume.lookup,{researchId});
 assert.equal((await t.run(c=>c.db.get(researchId)))?.volumeState,undefined);
 assert.equal(fetch.mock.callCount(),0);
});

test('explicitly enabled enrichment saves a successful provider response once',async ctx=>{
 environment(ctx);const {t,researchId}=await fixture();
 const fetch=mockFetch(ctx,async()=>new Response(JSON.stringify({status_code:20000,tasks:[{id:'test-success',status_code:20000,cost:0.09,result:[{keyword:'corporate film',search_volume:100,location_code:2356,language_code:'en',search_partners:false,monthly_searches:[]}]}]})));
 await t.action(internal.searchVolume.lookup,{researchId});
 await t.action(internal.searchVolume.lookup,{researchId});
 const saved=await t.run(c=>c.db.get(researchId));
 assert.equal(fetch.mock.callCount(),1);assert.equal(saved?.volumeState,'complete');
 assert.equal(JSON.parse(saved!.volumeJson!).rows[0].volume,100);
});

for(const failure of ['authentication','account verification','funding','provider funding status','network'] as const)
test(`${failure} failure leaves research complete and does not automatically retry`,async ctx=>{
 environment(ctx);const {t,id,token,researchId}=await fixture(),before=await t.run(c=>c.db.get(researchId));
 const fetch=mockFetch(ctx,async()=>{
  if(failure==='network')throw Error('Network unavailable');
  const status=failure==='authentication'?401:failure==='account verification'?403:failure==='funding'?402:200;
  return new Response(JSON.stringify({status_code:40200,tasks:null}),{status});
 });
 await t.action(internal.searchVolume.lookup,{researchId});
 await t.action(internal.searchVolume.lookup,{researchId});
 await t.mutation(api.searchVolume.start,{id,token});
 const after=await t.run(c=>c.db.get(researchId));
 assert.equal(fetch.mock.callCount(),1);assert.equal(after?.volumeState,'unavailable');assert.equal(after?.state,'complete');
 assert.equal(after?.reviewJson,before?.reviewJson);assert.deepEqual(after?.responses,before?.responses);
});
