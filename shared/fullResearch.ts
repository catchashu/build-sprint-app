import { z } from 'zod';
import type { Evidence } from './evidence';
import type { Review } from './cardReview';
import type { Assignment } from './batchedPlanning';
import { temporarySearchFailure } from './searchRecovery';
export const RESEARCH_LIMIT=8;
export const researchPlanSchema=z.object({queries:z.array(z.string().min(2).max(80)).min(1).max(RESEARCH_LIMIT)}).strict();
export function researchAttempt(seeds:string[],searches:{query:string;status:string;error?:string}[]) {
 const limit=RESEARCH_LIMIT+Math.min(2,searches.filter(s=>s.status==='failed'&&temporarySearchFailure(s.error)).length);
 if(searches.length>=limit)return undefined;
 return seeds.find(query=>{const tries=searches.filter(s=>s.query===query);return !tries.some(s=>s.status==='complete'||s.status==='running')&&(tries.length===0||(tries.length<2&&temporarySearchFailure(tries.at(-1)?.error)));});
}
const normalize=(q:string)=>q.trim().toLowerCase().replace(/\s+/g,' ');
export function reviewedAssignments(evidence:Evidence[],review:Review,assignments:Record<string,Assignment>):Record<string,Assignment> {
 const out={...assignments};
 for(const card of review.cards)for(const query of card.queries){
  const row=evidence.find(e=>normalize(e.query)===normalize(query.query));if(!row)throw Error('Confirmed evidence is missing.');
  out[row.id]=review.decisions[card.groupId]==='excluded'?{destination:'excluded',reason:'Excluded by the user from the confirmed offering.'}:{destination:'cluster',needKey:`review:${card.groupId}`,label:card.label,need:card.need,kind:'Service',intent:'Informational',stage:'Discovery',priority:'Next',reason:'User-confirmed interpretation; retained unchanged.',subIntent:'Confirmed during first-value review'};
 }
 for (const assignment of Object.values(out)) if (assignment.destination === "cluster" && assignment.needKey.startsWith("review:")) {
  const card = review.cards.find(c => `review:${c.groupId}` === assignment.needKey && review.decisions[c.groupId] !== "excluded");
  if (!card) throw Error("Unknown confirmed group.");
  assignment.label = card.label; assignment.need = card.need;
 }
 return out;
}
export function materializeDemandMap(evidence:Evidence[],assignments:Record<string,Assignment>,destinations:Record<string,string>) {
 if(Object.keys(assignments).length!==evidence.length||evidence.some(e=>!assignments[e.id]))throw Error('Every observed query needs one destination.');
 const keys=new Set(Object.values(assignments).flatMap(a=>a.destination==='cluster'?[a.needKey]:[]));
 const buckets=new Map<string,{groupId:string;label:string;need:string;demand:'Insufficient evidence';queries:Evidence[]}>();
 const excluded:{evidence:Evidence;reason:string}[]=[],unresolved:{evidence:Evidence;reason:string;question:string}[]=[];
 for(const row of evidence){const a=assignments[row.id];
  if(a.destination==='excluded'){excluded.push({evidence:row,reason:a.reason});continue;}
  if(a.destination==='unresolved'){unresolved.push({evidence:row,reason:a.reason,question:a.question});continue;}
  const target=destinations[a.needKey]??a.needKey;
  if(!keys.has(target)||a.needKey.startsWith('review:')&&target!==a.needKey)throw Error('Consolidation cannot replace a confirmed group.');
  const targetValue=Object.values(assignments).find(v=>v.destination==='cluster'&&v.needKey===target) as Extract<Assignment,{destination:'cluster'}>;
  let group=buckets.get(target);if(!group){group={groupId:target,label:targetValue.label,need:targetValue.need,demand:'Insufficient evidence',queries:[]};buckets.set(target,group);}group.queries.push(row);
 }
 return {cards:[...buckets.values()],excluded,unresolved};
}
export const clarificationSchema=z.object({questions:z.array(z.object({id:z.string(),question:z.string().min(1).max(500),label:z.string().min(1).max(160),need:z.string().min(1).max(800),evidenceIds:z.array(z.string()).min(1),reason:z.string().min(1)}).strict()).max(3)}).strict();
export type Clarification=z.infer<typeof clarificationSchema>['questions'][number];
