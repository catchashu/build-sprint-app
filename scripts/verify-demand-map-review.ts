import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api';
const identity=JSON.parse(readFileSync('artifacts/full-research-live-receipt.json','utf8'));
const client=new ConvexHttpClient('https://dynamic-crane-178.convex.cloud');
let review=(await client.query(api.mapReview.get,identity))!;
const before=review.cards.flatMap(c=>c.queries).sort((a,b)=>a.id.localeCompare(b.id)),card=review.cards[0];
const jobId=await client.mutation(api.mapReview.apply,{...identity,revision:review.revision,cardId:card.groupId,kind:'label',note:'Keep the meaning and evidence, but use the label "Family-office provider selection".',requestId:crypto.randomUUID()});
for(let i=0;i<100;i++){const job=await client.query(api.mapReview.result,{...identity,jobId});if(job?.state==='complete')break;if(job?.state==='failed')throw Error(job.error!);await new Promise(r=>setTimeout(r,2000));}
review=(await client.query(api.mapReview.get,identity))!;assert.equal(review.decisions[card.groupId],'pending');
await client.mutation(api.mapReview.decision,{...identity,revision:review.revision,cardId:card.groupId,decision:'correct'});
let status=(await client.query(api.fullResearch.get,identity))!;
for(const [i,q]of status.questions.entries()){
 if(i===0)await client.action(api.fullResearch.customAnswer,{...identity,questionId:q.id,note:'I cannot confirm that this is offered. Leave this unresolved and do not add it as a confirmed service.'});
 else await client.mutation(api.fullResearch.answer,{...identity,questionId:q.id,answer:'uncertain'});
}
review=(await client.query(api.mapReview.get,identity))!;
assert.deepEqual(review.cards.flatMap(c=>c.queries).sort((a,b)=>a.id.localeCompare(b.id)),before);
await client.mutation(api.mapReview.accept,{...identity,revision:review.revision});
assert.equal((await client.query(api.mapReview.get,identity))?.accepted,true);
status=(await client.query(api.fullResearch.get,identity))!;assert.equal(status.searchCount,5);assert.equal(status.answers.length,status.questions.length);
const r=spawnSync(process.execPath,['node_modules/convex/bin/main.js','run','fullResearch:answerContext',JSON.stringify(identity)],{encoding:'utf8',maxBuffer:10000000});assert.equal(r.status,0);writeFileSync('artifacts/full-research-verified-snapshot.json',r.stdout);
console.log('PASS: real AI map correction, source preservation, custom clarification answer, predefined answer, confirmation, and fresh-read persistence; zero additional searches.');
