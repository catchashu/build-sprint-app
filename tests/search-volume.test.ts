import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVolumes,demandSummary,volumeKeywords} from '../shared/searchVolume';
import {planWorkbook} from '../src/planExport';
import {planFixture} from './website-plan-fixture';
const result=(rows:unknown[])=>({status_code:20000,tasks:[{id:'test',status_code:20000,cost:0.09,result:rows}]});
const row=(keyword:string,volume:number|null)=>({keyword,search_volume:volume,location_code:2356,language_code:'en',search_partners:false,monthly_searches:[]});
test('volume is grounded in exact requested searches, targeting and successful task status',()=>{
 assert.throws(()=>parseVolumes(result([{...row('film',100),location_code:2840}]),['film'],'2026-10-13'));
 assert.throws(()=>parseVolumes({...result([]),status_code:40000},['film'],'2026-10-13'));
 const data=parseVolumes(result([row('film',100),row('invented',9000)]),['film','missing'],'2026-10-13');
 assert.deepEqual(data.rows.map(r=>r.volume),[100,null]);
 assert.equal(parseVolumes(result([{...row('flim',100),spell:'film'}]),['flim'],'2026-10-13').rows[0].volume,null);
});
test('demand never sums similar terms, counts duplicate wording once, and distinguishes zero from missing',()=>{
 const data=parseVolumes(result([row('film',100),row('films',100),row('zero',0)]),['film','films','zero','missing'],'2026-10-13');
 assert.deepEqual(demandSummary([{query:'Film'},{query:'film'},{query:'films'},{query:'missing'}],data),{band:'Medium',peak:100,measured:2,total:3,text:'Medium · strongest measured search: ~100/month · 2/3 searches measured'});
 assert.equal(demandSummary([{query:'zero'}],data).band,'Low');
 assert.equal(demandSummary([{query:'missing'}],data).band,'Insufficient evidence');
});
test('unsupported query wording remains unmodified and is omitted from the provider request',()=>{
 assert.deepEqual(volumeKeywords([{query:' Film '},{query:'film'},{query:'What is film?'},{query:'x'.repeat(81)}]),['film']);
 assert.equal(volumeKeywords(Array.from({length:1100},(_,i)=>({query:`film ${i}`}))).length,1000);
});
test('Excel carries numeric estimates, missing values and provenance without changing saved searches',async()=>{
 const {plan,input}=planFixture(),before=JSON.stringify(input.review.cards);
 const snapshot=parseVolumes(result([row('observed e1',100),row('observed e2',0)]),['observed e1','observed e2','observed e3'],'2026-10-13');
 const book=await planWorkbook(plan,input.review.cards,input.offering,snapshot);
 const bytes=await book.xlsx.writeBuffer(),ExcelJS=(await import('exceljs')).default,read=new ExcelJS.Workbook();await read.xlsx.load(bytes);
 assert.equal(read.getWorksheet('Search volumes')!.getCell('B2').value,100);
 assert.equal(read.getWorksheet('Search volumes')!.getCell('B3').value,0);
 assert.equal(read.getWorksheet('Search volumes')!.getCell('B4').value,'Unavailable');
 assert.equal(read.getWorksheet('Search volumes')!.getCell('G2').value,'test');
 assert.match(String(read.getWorksheet('Website pages')!.getCell('G2').value),/^Medium/);
 assert.equal(JSON.stringify(input.review.cards),before);
});
