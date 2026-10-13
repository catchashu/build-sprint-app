import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWebsitePlan, planEvidence, orderedNodes, type PlanInput, type WebsitePlan } from '../shared/websitePlan';
import { planWorkbook } from '../src/planExport';
import { planFixture } from './website-plan-fixture';

test('website architecture covers every accepted area using multiple treatments without changing evidence',()=>{
 const {input,plan}=planFixture(),before=JSON.stringify(input);validateWebsitePlan(plan,input);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(planEvidence(plan.nodes[0],input.review.cards).queries.map(q=>q.id),['e1','e2']);
 assert.deepEqual(orderedNodes(plan.nodes).map(x=>[x.node.id,x.depth]),[['p',0],['s',1]]);
});
test('website validation rejects missing areas, excluded references, invented fields, cycles and orphan sections',()=>{
 const {input,plan}=planFixture();
 const invalids = [ {...plan,nodes:[plan.nodes[0]]}, {...plan,nodes:[{...plan.nodes[0],clusterIds:['x']},plan.nodes[1]]}, {...plan,nodes:[{...plan.nodes[0],volume:100},plan.nodes[1]]}, {...plan,nodes:[{...plan.nodes[0],parentId:'s'},plan.nodes[1]]}, {...plan,nodes:[plan.nodes[0],{...plan.nodes[1],parentId:null}]} ];
 for(const invalid of invalids)assert.throws(()=>validateWebsitePlan(invalid,input));
 assert.throws(()=>validateWebsitePlan(plan,{...input,review:{...input.review,accepted:false}}));
});
test('targeted correction changes only the selected node and clarification never guesses a plan',()=>{
 const {input,plan}=planFixture();const updated={...plan,nodes:plan.nodes.map(n=>n.id==='s'?{...n,label:'Film editing services'}:n)};
 validateWebsitePlan(updated,input,plan,'s');assert.throws(()=>validateWebsitePlan(updated,input,plan,'p'));
 validateWebsitePlan({outcome:'needs_clarification',question:'Do you offer this separately?',summary:'',limitations:[],nodes:[]},input);
 assert.throws(()=>validateWebsitePlan({...plan,outcome:'needs_clarification',question:'A question'},input));
});
test('Excel round trip includes every node and exact evidence source, with untrusted text stored as text',async()=>{
 const {input,plan}=planFixture();plan.nodes[0].label='=HYPERLINK("https://example.com")';
 const workbook=await planWorkbook(plan,input.review.cards.filter(c=>c.groupId!=='x'),input.offering);
 const bytes=await workbook.xlsx.writeBuffer();const ExcelJS=(await import('exceljs')).default;const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes);
 assert.deepEqual(loaded.worksheets.map(s=>s.name),['Website pages','On-page content','Demand areas','Search evidence','Context and limits']);
 assert.equal(loaded.getWorksheet('Website pages')!.rowCount,2);assert.equal(loaded.getWorksheet('Website pages')!.getCell('D2').value,plan.nodes[0].label);
 assert.equal(loaded.getWorksheet('On-page content')!.rowCount,2);
 assert.equal(loaded.getWorksheet('On-page content')!.getCell('B2').value,'p');
 assert.equal(loaded.getWorksheet('On-page content')!.getCell('C2').value,plan.nodes[0].label);
 assert.equal(loaded.getWorksheet('Search evidence')!.rowCount,4);assert.equal(loaded.getWorksheet('Search evidence')!.getCell('F2').value,input.review.cards[0].queries[0].sources[0].reference);
 assert.equal(loaded.getWorksheet('Website pages')!.getCell('G2').value,'Insufficient evidence');
});

test('a subpage cannot be nested inside an on-page section',()=>{
 const {input,plan}=planFixture();
 plan.nodes.push({...plan.nodes[0],id:'child-page',parentId:'s'});
 assert.throws(()=>validateWebsitePlan(plan,input),/page parent/);
});
