import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api';
import {extractSerpEvidence} from '../shared/evidence';
const source=JSON.parse(readFileSync('artifacts/first-view-latest-failure.json','utf8'));
const prod=process.argv.includes('--recover-production');
const client=new ConvexHttpClient(prod?'https://ardent-fly-778.convex.cloud':'https://dynamic-crane-178.convex.cloud');
function cli(name:string,args:unknown){const r=spawnSync(process.execPath,['node_modules/convex/bin/main.js','run',name,JSON.stringify(args),...(prod?['--prod']:[])],{encoding:'utf8',maxBuffer:10000000});if(r.status!==0)throw Error(`Operation failed: ${name}: ${r.stderr.slice(-1500)}`);return r.stdout.trim()?JSON.parse(r.stdout):null;}
const token=prod?source.token:crypto.randomUUID();
const id=prod?source._id:await client.mutation(api.firstValue.create,{offering:source.offering,context:source.context,token});
const identity={id,token};
if(!prod){
 for(const response of source.responses)cli('firstValue:save',{id,response});
 for(const batch of source.batches)cli('firstValue:save',{id,batch});
 cli('firstValue:save',{id,seeds:[],state:'failed',failureKind:'build'});
} else {
 const current=cli('firstValue:read',{id});
 assert.equal(current.state,'failed');assert.equal(current.failureKind,'insufficient');
 assert.deepEqual(current.responses,source.responses);assert.deepEqual(current.batches,source.batches);
 cli('firstValue:save',{id,failureKind:'build'});
}
await client.mutation(api.firstValue.start,identity);
console.log(prod?'Recovering saved production run; no new searches.':'Replaying saved grouping on development; no new searches.');
for(let i=0;i<180;i++){
 const status=await client.query(api.firstValue.get,identity); assert.ok(status);
 if(status.state==='failed')throw Error(status.error ?? 'First view failed');
 if(status.state==='complete'){
  const saved=cli('firstValue:read',{id}),cards=JSON.parse(saved.cards),evidence=extractSerpEvidence(source.responses.map(JSON.parse));
  assert.equal(cards.length,1);assert.ok(cards[0].queries.length>=2);
  for(const q of cards[0].queries)assert.deepEqual(q,evidence.find(e=>e.id===q.id));
  assert.deepEqual(saved.responses,source.responses);assert.deepEqual(saved.batches,source.batches);
  assert.equal(saved.searchCount,prod?source.searchCount:0);
  if(prod)assert.deepEqual(saved.searches,source.searches);
  if(!prod){
   let review=(await client.query(api.cardReview.get,identity))!;
   await client.mutation(api.cardReview.decision,{...identity,cardId:review.cards[0].groupId,decision:'correct',revision:review.revision});
   review=(await client.query(api.cardReview.get,identity))!;
   await client.mutation(api.cardReview.accept,{...identity,revision:review.revision});
   assert.equal((await client.query(api.cardReview.get,identity))?.accepted,true);
  }
  writeFileSync(`artifacts/one-card-${prod?'recovered':'replay'}.json`,JSON.stringify({id,state:saved.state,cardCount:cards.length,queryCount:cards[0].queries.length,searchCount:saved.searchCount}));
  console.log(`PASS: one card with ${cards[0].queries.length} unchanged sourced examples; saved evidence preserved; ${prod?'user review left pending':'review approved and reopened'}; no searches added.`);break;
 }
 if(i===179)throw Error('Still running; do not restart');
 await new Promise(resolve=>setTimeout(resolve,2000));
}
