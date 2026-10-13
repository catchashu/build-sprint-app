import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api';
import {extractSerpEvidence} from '../shared/evidence';
const raw=JSON.parse(readFileSync('artifacts/full-research-verified-snapshot.json','utf8')),confirmed=JSON.parse(raw.confirmedReview);
const client=new ConvexHttpClient('https://ardent-fly-778.convex.cloud'),token=crypto.randomUUID();
function cli(name:string,args:unknown){const r=spawnSync(process.execPath,['node_modules/convex/bin/main.js','run',name,JSON.stringify(args),'--prod'],{encoding:'utf8',maxBuffer:10000000});if(r.status!==0)throw Error(`Production operation failed: ${name}`);return r.stdout.trim()?JSON.parse(r.stdout):null;}
const id=await client.mutation(api.firstValue.create,{offering:raw.offering,context:'',token}),identity={id,token};writeFileSync('artifacts/full-research-production-receipt.json',JSON.stringify(identity));
for(const response of raw.responses)cli('firstValue:save',{id,response});
cli('firstValue:save',{id,state:'complete',cards:JSON.stringify(confirmed.cards)});
let review=(await client.query(api.cardReview.get,identity))!;
for(const card of review.cards){await client.mutation(api.cardReview.decision,{...identity,revision:review.revision,cardId:card.groupId,decision:confirmed.decisions[card.groupId]});review=(await client.query(api.cardReview.get,identity))!;}
await client.mutation(api.cardReview.accept,{...identity,revision:review.revision});
const code=readFileSync('artifacts/invite-code.txt','utf8').trim();assert.equal((await client.mutation(api.payments.invite,{...identity,code})).ok,true);
const researchId=cli('fullResearch:prepare',identity);assert.equal(cli('fullResearch:prepare',identity),researchId);
// Replay actual provider responses to verify production without purchasing duplicate searches.
cli('fullResearch:save',{researchId,seeds:[]});
await client.mutation(api.fullResearch.start,identity);await client.mutation(api.fullResearch.start,identity);
console.log('Production replay started with saved real evidence; no new searches.');
let completed=false,previous='';
for(let i=0;i<240;i++){
 const status=(await client.query(api.fullResearch.get,identity))!;assert.equal(status.searchCount,0);
 if(status.state!==previous){console.log(`Production phase: ${status.state}`);previous=status.state;}
 if(status.state==='failed')throw Error(status.error??'Research failed');
 if(status.state==='complete'){
  const map=(await client.query(api.mapReview.get,identity))!,evidence=extractSerpEvidence(raw.responses.map(JSON.parse));
  for(const card of map.cards)for(const q of card.queries)assert.deepEqual(q,evidence.find(e=>e.id===q.id));
  for(const q of status.questions)await client.mutation(api.fullResearch.answer,{...identity,questionId:q.id,answer:'uncertain'});
  const latest=(await client.query(api.mapReview.get,identity))!;await client.mutation(api.mapReview.accept,{...identity,revision:latest.revision});
  assert.equal((await client.query(api.mapReview.get,identity))?.accepted,true);
  await client.mutation(api.fullResearch.start,identity);assert.equal((await client.query(api.fullResearch.get,identity))!.state,'complete');
  writeFileSync('artifacts/full-research-production-result.json',JSON.stringify({status,map},null,2));
  console.log(`PASS: ${map.cards.length} sourced areas on production; ${status.questions.length} answers saved; map confirmed and reopened without restarting or spending a search.`);completed=true;break;
 }
 await new Promise(r=>setTimeout(r,3000));
}
assert.ok(completed,'Production research is still running; do not restart it.');
