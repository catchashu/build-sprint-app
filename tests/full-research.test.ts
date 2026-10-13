import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewedAssignments, researchAttempt, materializeDemandMap } from '../shared/fullResearch.ts';
const source={provider:'SerpAPI',reference:'https://serpapi.com/searches/test.json',field:'related_searches.query',retrievedAt:'2026-10-12'};
const evidence=[1,2,3].map(i=>({id:`e${i}`,query:`Query ${i}`,volume:null,sources:[source]}));
const review={revision:2,accepted:true,cards:[{groupId:'kept',label:'User label',need:'Corrected meaning',queries:[evidence[0]]},{groupId:'out',label:'Not offered',need:'No',queries:[evidence[1]]}],decisions:{kept:'correct',out:'excluded'},notes:[]};
test('research preserves corrected meaning and exclusion despite contrary AI assignments',()=>{
 const assignments=reviewedAssignments(evidence,review as any,{e1:{destination:'excluded',reason:'AI'},e2:{destination:'cluster'},e3:{destination:'unresolved',reason:'Ambiguous',question:'Offered?'}} as any);
 assert.equal(assignments.e1.destination,'cluster');assert.equal((assignments.e1 as any).label,'User label');assert.equal(assignments.e2.destination,'excluded');
 const result=materializeDemandMap(evidence,assignments,{});
 assert.deepEqual(result.cards[0].queries,[evidence[0]]);assert.equal(result.cards[0].demand,'Insufficient evidence');assert.equal(result.unresolved.length,1);
});
test('research retry allowance is bounded and skips completed requests',()=>{
 assert.equal(researchAttempt(['a','b'],[{query:'a',status:'complete'}]),'b');
 assert.equal(researchAttempt(['a'],[{query:'a',status:'failed',error:'SerpAPI returned HTTP 503.'}]),'a');
 assert.equal(researchAttempt(['a'],[{query:'a',status:'failed',error:'SerpAPI returned HTTP 503.'},{query:'a',status:'failed',error:'SerpAPI returned HTTP 503.'}]),undefined);
 assert.equal(researchAttempt(['x'],Array.from({length:10},(_,i)=>({query:String(i),status:'failed',error:'SerpAPI returned HTTP 503.'}))),undefined);
});
