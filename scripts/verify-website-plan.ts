import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api';
import { validateWebsitePlan } from '../shared/websitePlan';
const prod = process.argv.includes('--prod');
const receipt = process.argv.find(a => a.startsWith('--receipt='))?.slice('--receipt='.length) ?? (prod ? 'artifacts/full-research-production-receipt.json' : 'artifacts/full-research-live-receipt.json');
const identity = JSON.parse(readFileSync(receipt, 'utf8').replace(/^\uFEFF/, ''));
const client = new ConvexHttpClient(prod ? 'https://ardent-fly-778.convex.cloud' : 'https://dynamic-crane-178.convex.cloud');
const before = await client.query(api.fullResearch.get, identity);
const review = await client.query(api.mapReview.get, identity);
assert.ok(review?.accepted, 'Use a confirmed test map');
await client.mutation(api.websitePlan.start, identity);
await client.mutation(api.websitePlan.start, identity);
let last = '', completed = false;
for(let i=0; i<240; i++) {
 const view = await client.query(api.websitePlan.get, identity);
 if(view.state !== last) { console.log(`Website plan: ${view.state}`); last = view.state; }
 if(view.state === 'failed') throw Error(view.error ?? 'Plan failed');
 if(view.state === 'clarification') { console.log(`Needs a business answer: ${view.question}`); writeFileSync('artifacts/website-plan-question.json', JSON.stringify(view)); break; }
 if(view.state === 'complete') {
  assert.ok(view.cards && view.offering && view.plan);
  validateWebsitePlan(view.plan,{offering:view.offering,context:'',review,questions:[],answers:[],unresolved:[],clarifications:[]});
  for(const card of view.cards)assert.deepEqual(card,review.cards.find(c=>c.groupId===card.groupId));
  await client.mutation(api.websitePlan.start,identity);
  const reopened=await client.query(api.websitePlan.get,identity);assert.equal(reopened.id,view.id);assert.deepEqual(reopened.plan,view.plan);
  assert.deepEqual(await client.query(api.fullResearch.get,identity),before);
  assert.deepEqual(await client.query(api.mapReview.get,identity),review);
  writeFileSync(`artifacts/website-plan-${prod?'production':'development'}-result.json`,JSON.stringify(view,null,2));
  console.log(`PASS: ${view.plan.nodes.length} recommendations covering ${view.cards.length} confirmed demand areas; saved plan reopens unchanged; zero new searches.`);completed=true;break;
 }
 await new Promise(r=>setTimeout(r,2500));
}
if(!completed)console.log('Plan is not verified complete; inspect the saved state before continuing.');
