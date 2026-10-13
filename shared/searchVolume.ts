import { z } from 'zod';

export const VOLUME_ENDPOINT = 'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live';
export const VOLUME_NOTE = 'India · English · Google monthly estimates via DataForSEO. Demand uses the strongest measured search: Low <100, Medium 100–999, High 1,000+. These are app-defined bands, not total market size. Similar phrases may share estimates; figures are not added together. Missing estimates do not mean zero demand.';
export const volumeSnapshotSchema = z.object({
  retrievedAt: z.string(), taskId: z.string(), cost: z.number().nonnegative(),
  rows: z.array(z.object({ keyword: z.string(), volume: z.number().int().nonnegative().nullable(),
    monthly: z.array(z.object({year:z.number().int(),month:z.number().int().min(1).max(12),volume:z.number().int().nonnegative()})) })),
});
export type VolumeSnapshot = z.infer<typeof volumeSnapshotSchema>;
export const volumeKey = (s:string) => s.trim().toLowerCase().replace(/\s+/g,' ');
// Preserve observed wording. Unsupported phrases stay in the research, without
// a volume, rather than sending a rewritten keyword and pretending it matches.
export function volumeKeywords(queries:{query:string}[]) {
  return [...new Set(queries.map(q=>volumeKey(q.query)))].filter(q=>q.length>0 && q.length<=80 && q.split(' ').length<=10 && /^[a-z0-9 &'’-]+$/.test(q)).slice(0,1000);
}
export function parseVolumes(raw:unknown, requested:string[], retrievedAt:string):VolumeSnapshot {
  const payload=z.object({status_code:z.literal(20000),tasks:z.array(z.object({
    id:z.string(),status_code:z.literal(20000),cost:z.number().nonnegative(),
    result:z.array(z.object({keyword:z.string(),spell:z.string().nullable().optional(),location_code:z.number().nullable(),language_code:z.string().nullable(),search_partners:z.boolean().optional(),search_volume:z.number().int().nonnegative().nullable(),
      monthly_searches:z.array(z.object({year:z.number().int(),month:z.number().int().min(1).max(12),search_volume:z.number().int().nonnegative()})).nullable().optional()})).nullable()
  })).length(1)}).parse(raw);
  const task=payload.tasks[0], wanted=new Set(requested), byKey=new Map<string,VolumeSnapshot['rows'][number]>();
  for(const row of task.result??[]) {
    const keyword=volumeKey(row.keyword);
    if(!wanted.has(keyword))continue;
    if(row.search_volume!==null && (row.location_code!==2356||row.language_code!=='en'||row.search_partners!==false))throw Error('Volume targeting did not match India / English / Google.');
    // Do not attribute corrected spelling to the original observed phrase.
    const volume=row.spell && volumeKey(row.spell)!==keyword ? null : row.search_volume;
    if(byKey.has(keyword))throw Error('Repeated volume keyword.');
    byKey.set(keyword,{keyword,volume,monthly:volume===null?[]:(row.monthly_searches??[]).map(m=>({year:m.year,month:m.month,volume:m.search_volume}))});
  }
  return {retrievedAt,taskId:task.id,cost:task.cost,rows:requested.map(keyword=>byKey.get(keyword)??{keyword,volume:null,monthly:[]})};
}
export function readVolumes(json?:string):VolumeSnapshot|null {
  if(!json)return null;
  return volumeSnapshotSchema.parse(JSON.parse(json));
}
export function volumeFor(query:string,snapshot?:VolumeSnapshot|null) {
  return snapshot?.rows.find(r=>r.keyword===volumeKey(query))?.volume??null;
}
export function demandSummary(queries:{query:string}[],snapshot?:VolumeSnapshot|null) {
  const unique=[...new Set(queries.map(q=>volumeKey(q.query)))];
  const values=unique.map(q=>volumeFor(q,snapshot)).filter((v):v is number=>v!==null);
  const peak=values.length?Math.max(...values):null;
  const band=peak===null?'Insufficient evidence':peak>=1000?'High':peak>=100?'Medium':'Low';
  return {band,peak,measured:values.length,total:unique.length,
    text:peak===null?'Insufficient evidence — no measured search volumes':`${band} · strongest measured search: ~${peak.toLocaleString('en-IN')}/month · ${values.length}/${unique.length} searches measured`};
}
export function queryVolumeText(query:string,snapshot?:VolumeSnapshot|null) {
  const value=volumeFor(query,snapshot);
  return value===null?'Monthly searches: unavailable':`~${value.toLocaleString('en-IN')} searches/month · India · Google · DataForSEO · retrieved ${snapshot!.retrievedAt.slice(0,10)}`;
}
