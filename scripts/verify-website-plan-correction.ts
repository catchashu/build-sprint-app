import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api';
const identity=JSON.parse(readFileSync('artifacts/full-research-live-receipt.json','utf8'));
const client=new ConvexHttpClient('https://dynamic-crane-178.convex.cloud');
const before=await client.query(api.websitePlan.get,identity);assert.equal(before.state,'complete');
const node=before.plan.nodes[0],wanted=`${node.label} overview`;
await client.mutation(api.websitePlan.start,{...identity,expectedId:before.id,selectedNodeId:node.id,correction:`Change only this recommendation's label to "${wanted}". Keep its meaning, treatment, parent, priority, coverage, evidence references and all other recommendations unchanged.`});
for(let i=0;i<160;i++){
 const after=await client.query(api.websitePlan.get,identity);
 if(after.state==='failed')throw Error(after.error??'Correction failed');
 if(after.state==='clarification')throw Error(`Unexpected question: ${after.question}`);
 if(after.state==='complete'){
  assert.equal(after.plan.nodes[0].label,wanted);assert.deepEqual(after.plan.nodes.slice(1),before.plan.nodes.slice(1));assert.deepEqual(after.cards,before.cards);
  writeFileSync('artifacts/website-plan-correction-result.json',JSON.stringify(after,null,2));console.log('PASS: real AI correction updated only the selected recommendation; all other recommendations and source evidence are unchanged.');break;
 }
 if(i===159)throw Error('Correction still running; inspect before restarting');
 await new Promise(r=>setTimeout(r,2500));
}
