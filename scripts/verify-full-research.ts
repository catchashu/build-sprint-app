import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api';
const raw=JSON.parse(readFileSync('artifacts/focused-search-live-snapshot.json','utf8'));
const first=JSON.parse(readFileSync('artifacts/focused-search-live-result.json','utf8'));
const client=new ConvexHttpClient('https://dynamic-crane-178.convex.cloud'),token=crypto.randomUUID();
function cli(name:string,args:unknown){const r=spawnSync(process.execPath,['node_modules/convex/bin/main.js','run',name,JSON.stringify(args)],{encoding:'utf8',maxBuffer:10000000});if(r.status!==0)throw Error(`Server operation failed: ${name}`);return r.stdout.trim()?JSON.parse(r.stdout):null;}
const id=await client.mutation(api.firstValue.create,{offering:raw.offering,context:raw.context,token}),identity={id,token};
writeFileSync('artifacts/full-research-live-receipt.json',JSON.stringify(identity));
for(const response of raw.responses)cli('firstValue:save',{id,response});
cli('firstValue:save',{id,state:'complete',cards:first.cards});
await assert.rejects(()=>client.mutation(api.fullResearch.start,identity));
let review=(await client.query(api.cardReview.get,identity))!;
const corrected=review.cards[0],excluded=review.cards.at(-1)!;
const jobId=await client.mutation(api.cardReview.apply,{...identity,revision:review.revision,cardId:corrected.groupId,kind:'label',note:'Use the label "Family-office provider selection". Keep the same underlying meaning and evidence.',requestId:crypto.randomUUID()});
for(let i=0;i<100;i++){const job=await client.query(api.cardReview.result,{...identity,jobId});if(job?.state==='complete')break;if(job?.state==='failed')throw Error(job.error!);await new Promise(r=>setTimeout(r,2000));}
review=(await client.query(api.cardReview.get,identity))!;
for(const card of review.cards){await client.mutation(api.cardReview.decision,{...identity,revision:review.revision,cardId:card.groupId,decision:card.groupId===excluded.groupId?'excluded':'correct'});review=(await client.query(api.cardReview.get,identity))!;}
await client.mutation(api.cardReview.accept,{...identity,revision:review.revision});
const code=readFileSync('artifacts/invite-code.txt','utf8').trim();assert.equal((await client.mutation(api.payments.invite,{...identity,code})).ok,true);
await client.mutation(api.fullResearch.start,identity);await client.mutation(api.fullResearch.start,identity);
console.log('PASS: locked research rejected; corrected review and exclusion accepted; invite unlock saved; duplicate start accepted safely.');
let previous='';let completed=false;
for(let i=0;i<400;i++){
 const run=await client.query(api.fullResearch.get,identity);assert.ok(run);
 const summary=JSON.stringify({phase:run.state,attempts:run.searchCount,complete:run.searches.filter((s:any)=>s.status==='complete').length});
 if(summary!==previous){console.log(summary);previous=summary;}
 if(run.state==='failed')throw Error(run.error??"Research failed");
 if(run.state==='complete'){
 const map=(await client.query(api.mapReview.get,identity))!;
 const kept=map.cards.find(c=>c.groupId===`review:${corrected.groupId}`);assert.ok(kept);assert.equal(kept.label,'Family-office provider selection');
 const removed=new Set(excluded.queries.map(q=>q.query));assert.ok(map.cards.every(c=>c.queries.every(q=>!removed.has(q.query))));
 const queries=map.cards.flatMap(c=>c.queries);assert.equal(new Set(queries.map(q=>q.id)).size,queries.length);assert.ok(queries.every(q=>q.sources.length&&q.volume===null));
 const before=run.searchCount;await client.mutation(api.fullResearch.start,identity);assert.equal((await client.query(api.fullResearch.get,identity))!.searchCount,before);
 writeFileSync('artifacts/full-research-live-result.json',JSON.stringify({status:run,map},null,2));
 console.log(`PASS: ${map.cards.length} demand areas, ${queries.length} retained sourced queries, ${run.questions.length} consequential questions; correction and exclusion preserved. Re-entry did not restart searches.`);completed=true;break;
 }
 await new Promise(r=>setTimeout(r,3000));
}
assert.ok(completed,'Research still running; do not restart it.');
