import type { PlanInput, WebsitePlan } from '../shared/websitePlan';
export function planFixture() {
  const query = (id: string) => ({id, query: `Observed ${id}`, volume: null, sources: [{provider:'SerpAPI' as const, field:'related_searches.query' as const, reference:'https://serpapi.com/searches/test.json', retrievedAt:'2026-10-13'}]});
  const input: PlanInput = {offering:'Video production',context:'Confirmed offering', review:{revision:2, accepted:true, cards:[{groupId:'a',label:'Corporate films',need:'Commission films',queries:[query('e1'),query('e2')]},{groupId:'b',label:'Editing',need:'Edit footage',queries:[query('e3')]},{groupId:'x',label:'Excluded',need:'Not offered',queries:[query('e4')]}], decisions:{a:'correct',b:'correct',x:'excluded'},notes:[{cardId:'a',kind:'label',text:'User corrected meaning'}]}, questions:[],answers:[],unresolved:[],clarifications:[]};
  const node = {id:'p',parentId:null,label:'Film production',treatment:'Page' as const,priority:'First' as const,rationale:'Commercial fit',coverage:['Commission a corporate film'],clusterIds:['a'],riskNote:''};
  const plan: WebsitePlan = {outcome:'ready',question:'',summary:'One page with editing coverage',limitations:['No search-volume measurements'],nodes:[node,{...node,id:'s',parentId:'p',label:'Editing',treatment:'Section',priority:'Next',clusterIds:['b']}]};
  return {input,plan};
}
