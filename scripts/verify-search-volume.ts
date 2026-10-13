import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ConvexHttpClient} from 'convex/browser';
import {api} from '../convex/_generated/api';
import {demandSummary} from '../shared/searchVolume';
import {planWorkbook} from '../src/planExport';

// Uses only the dedicated assistant-created film test run; never logs its token.
const identity=JSON.parse(readFileSync('artifacts/website-plan-browser-receipt.json','utf8').replace(/^\uFEFF/,''));
const client=new ConvexHttpClient('https://ardent-fly-778.convex.cloud');
const before=await client.query(api.websitePlan.get,identity);
assert.ok(before.offering);
assert.match(before.offering,/corporate films and edit business videos/);
await client.mutation(api.searchVolume.start,identity);
await client.mutation(api.searchVolume.start,identity);
for(let i=0;i<35;i++){
 const after=await client.query(api.websitePlan.get,identity);
 if(after.volumeState==='unavailable')throw Error('The real volume lookup was unavailable; no repeated paid request was made.');
 if(after.volumes){
  assert.deepEqual(after.plan,before.plan);assert.deepEqual(after.cards,before.cards);
  assert.ok(after.volumes.rows.some((r:any)=>r.volume!==null),'Provider returned no estimates');
  await client.mutation(api.searchVolume.start,identity);
  assert.deepEqual((await client.query(api.websitePlan.get,identity)).volumes,after.volumes);
  writeFileSync('artifacts/search-volume-live-result.json',JSON.stringify(after,null,2));
  await (await planWorkbook(after.plan,after.cards,after.offering,after.volumes)).xlsx.writeFile('artifacts/search-volume-live.xlsx');
  console.log(JSON.stringify({state:after.volumeState,costUSD:after.volumes.cost,requested:after.volumes.rows.length,measured:after.volumes.rows.filter((r:any)=>r.volume!==null).length,areas:after.cards.map((c:any)=>({label:c.label,...demandSummary(c.queries,after.volumes)})),preservedPlan:true,preservedSearches:true,repeatedStartReusesSnapshot:true},null,2));
  process.exit(0);
 }
 await new Promise(r=>setTimeout(r,1500));
}
throw Error('Volume lookup did not finish; inspect saved state before retrying.');
