import {v,ConvexError} from 'convex/values';
import {mutation,internalMutation,internalAction} from './_generated/server';
import {internal} from './_generated/api';
import {extractSerpEvidence} from '../shared/evidence';
import {VOLUME_ENDPOINT,volumeKeywords,parseVolumes,volumeSnapshotSchema} from '../shared/searchVolume';

// V1 defaults to no enrichment, even when credentials have been configured.
function enabled() {
 return process.env.USE_DATAFORSEO==='true' && !!process.env.DATAFORSEO_LOGIN?.trim() && !!process.env.DATAFORSEO_PASSWORD?.trim();
}

// Existing unlocked runs can acquire their one saved snapshot when reopened.
export const start=mutation({args:{id:v.id('firstValueRuns'),token:v.string()},returns:v.null(),handler:async(ctx,{id,token})=>{
 const source=await ctx.db.get(id);
 if(!source||source.token!==token||!source.unlock)throw new ConvexError('Open your unlocked run first.');
 if(!enabled())return null;
 const run=await ctx.db.query('fullResearchRuns').withIndex('by_run',q=>q.eq('runId',id)).unique();
 if(!run||run.state!=='complete'||run.volumeState)return null;
 await ctx.db.patch(run._id,{volumeState:'queued'});
 await ctx.scheduler.runAfter(0,internal.searchVolume.lookup,{researchId:run._id});
 return null;
}});
export const reserve=internalMutation({args:{researchId:v.id('fullResearchRuns')},returns:v.any(),handler:async(ctx,{researchId})=>{
 const run=await ctx.db.get(researchId);if(!run)return null;
 if(!enabled()){
  // A job queued before the switch changed must not leave a loading message.
  if(run.volumeState==='queued')await ctx.db.patch(researchId,{volumeState:undefined});
  return null;
 }
 if(run.volumeState&&run.volumeState!=='queued')return null;
 const source=await ctx.db.get(run.runId);if(!source?.unlock)return null;
 const review=run.reviewJson?JSON.parse(run.reviewJson):null;
 const queries=review?.cards?review.cards.filter((c:{groupId:string})=>review.decisions[c.groupId]!=='excluded').flatMap((c:{queries:{query:string}[]})=>c.queries):extractSerpEvidence(run.responses.map(r=>JSON.parse(r)));
 const keywords=volumeKeywords(queries);
 await ctx.db.patch(researchId,{volumeState:'running',volumeStartedAt:Date.now()});
 // A crashed action must not leave the screen waiting forever or rebill.
 await ctx.scheduler.runAfter(60000,internal.searchVolume.expire,{researchId});
 return keywords;
}});
export const finish=internalMutation({args:{researchId:v.id('fullResearchRuns'),json:v.optional(v.string()),failure:v.optional(v.string()),errorBody:v.optional(v.string())},returns:v.null(),handler:async(ctx,{researchId,json,failure,errorBody})=>{
 const run=await ctx.db.get(researchId);if(!run||run.volumeState!=='running')return null;
 if(json)volumeSnapshotSchema.parse(JSON.parse(json));
 await ctx.db.patch(researchId,{volumeState:json?'complete':'unavailable',volumeFailure:failure,volumeErrorBody:errorBody,...(json?{volumeJson:json}:{})});return null;
}});
export const expire=internalMutation({args:{researchId:v.id('fullResearchRuns')},returns:v.null(),handler:async(ctx,{researchId})=>{
 const run=await ctx.db.get(researchId);
 if(run?.volumeState==='running')await ctx.db.patch(researchId,{volumeState:'unavailable'});
 return null;
}});
export const lookup=internalAction({args:{researchId:v.id('fullResearchRuns')},returns:v.null(),handler:async(ctx,{researchId}):Promise<null>=>{
 const keywords:string[]|null=await ctx.runMutation(internal.searchVolume.reserve,{researchId});
 if(keywords===null)return null;
 let json:string|undefined,failure:string|undefined,errorBody:string|undefined,stage='request_setup';
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),25000);
 try{
  const login=process.env.DATAFORSEO_LOGIN,password=process.env.DATAFORSEO_PASSWORD;
  if(!enabled()||!login||!password||!keywords.length){stage='configuration_or_no_supported_keywords';throw Error('Volume lookup unavailable.');}
  const authorization=`Basic ${btoa(`${login}:${password}`)}`;
  stage='transport';
  const response=await fetch(VOLUME_ENDPOINT,{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},
    body:JSON.stringify([{keywords,location_code:2356,language_code:'en',search_partners:false}]),signal:controller.signal});
  stage=`http_${response.status}`;
  if(!response.ok){errorBody=(await response.text()).replaceAll(login,'[redacted]').replaceAll(password,'[redacted]').slice(0,2000);throw Error('Volume lookup unavailable.');}
  const body=await response.json();
  stage=`provider_${Number(body.status_code)||0}_${Number(body.tasks?.[0]?.status_code)||0}`;
  json=JSON.stringify(parseVolumes(body,keywords,new Date().toISOString()));
 }catch{failure=stage;/* Record only safe status codes, never credentials or provider error bodies. */}
 finally{clearTimeout(timer);}
 await ctx.runMutation(internal.searchVolume.finish,{researchId,...(json?{json}:{}),...(failure?{failure}:{}),...(errorBody?{errorBody}:{})});return null;
}});

// Operator-only recovery. Inspect the failed request and possible charges before
// explicitly using this; the public flow never retries a possibly billed call.
export const retryUnavailable=internalMutation({args:{researchId:v.id('fullResearchRuns')},returns:v.null(),handler:async(ctx,{researchId})=>{
 if(!enabled())return null;
 const run=await ctx.db.get(researchId);
 if(run?.volumeState!=='unavailable'||run.volumeJson)return null;
 await ctx.db.patch(researchId,{volumeState:'queued',volumeFailure:undefined});
 await ctx.scheduler.runAfter(0,internal.searchVolume.lookup,{researchId});return null;
}});
export const connection=internalAction({args:{},returns:v.any(),handler:async()=>{
 const login=process.env.DATAFORSEO_LOGIN,password=process.env.DATAFORSEO_PASSWORD;
 if(!enabled()||!login||!password)return {enabled:false,configured:!!login?.trim()&&!!password?.trim()};
 const response=await fetch('https://api.dataforseo.com/v3/appendix/user_data',{headers:{Authorization:`Basic ${btoa(`${login}:${password}`)}`}});
 const data=await response.json();
 return {configured:true,http:response.status,status:Number(data.status_code),balance:data.tasks?.[0]?.result?.[0]?.money?.balance??null};
}});
