import { processingDots } from './processingIndicator';
import { canvasMode, setCanvasMode } from "./canvasLayout";
import { trayGeometry, transitionTray } from './trayTransition';
import type { ConvexClient } from 'convex/browser';
import type { Id } from '../convex/_generated/dataModel';
import { api } from '../convex/_generated/api';
import type { Card } from '../shared/cardReview';
import { planEvidence, isStandalone, type WebsitePlan, type WebsiteNode } from '../shared/websitePlan';
import {queryVolumeText,volumeFor,type VolumeSnapshot} from '../shared/searchVolume';
const V1_EVIDENCE_NOTE='Research based on Google search suggestions in India (English). Search volumes are not available in this version.';

type View = { id?: Id<'websitePlans'>; state: string; plan?: WebsitePlan | null; cards?: Card[]; offering?: string; question?: string | null; error?: string | null; volumes?:VolumeSnapshot|null; volumeState?:string|null };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
export function mountWebsitePlan(client: ConvexClient, identity: {id: Id<'firstValueRuns'>; token: string}, root: HTMLElement, back: () => void, reset: () => void) {
  let volumesRequested=false;
  let alive = true, started = false, busy = false, exporting = false, current: View | null = null, lastDraw = '';
  const heading = el('h2', 'Loading your website plan…'); heading.tabIndex = -1;
  const processing=processingDots('plan-processing','Preparing your website plan');processing.hidden=true;
  const status = el('p'); status.setAttribute('role', 'status');
  const error = el('p', '', 'error'); error.setAttribute('role', 'alert');
  const controls = el('div', '', 'plan-actions'), question = el('section'), output = el('div', '', 'website-plan');
  const app=root.closest<HTMLElement>('#app'),reading=el('div','','plan-reading'),actions=el('div','','plan-persistent-actions'),actionButtons=el('div','','plan-actions');
  reading.tabIndex=0;reading.setAttribute('role','region');reading.setAttribute('aria-label','Website plan and supporting research');
  reading.append(processing,controls,question,output);actions.append(status,error,actionButtons);root.append(heading,reading,actions);
  const detailState=new Map<string,boolean>(),drafts=new Map<string,string>();
  let savedScroll=0,dialog:HTMLDialogElement|undefined,dialogStatus:HTMLParagraphElement|undefined;
  const viewport=root.ownerDocument.defaultView?.visualViewport;
  let focusFrame=0;
  const revealForm=()=>{if(!app)return;cancelAnimationFrame(focusFrame);focusFrame=requestAnimationFrame(()=>{const field=document.activeElement;if(app.dataset.keyboard==='true'&&field instanceof HTMLElement&&reading.contains(field))field.closest('form')?.scrollIntoView({block:'nearest'});});};
  viewport?.addEventListener('resize',revealForm);reading.addEventListener('focusin',revealForm);
  const button = (label: string, action: () => void, primary = false) => { const b = el('button', label, primary ? 'primary' : 'secondary'); b.type = 'button'; b.onclick = action; return b; };
  async function submit(extra: {expectedId?: Id<'websitePlans'>; selectedNodeId?: string; correction?: string; answer?: string} = {}) {
    if (busy || !alive) return; busy = true; error.textContent = ''; updateDisabled();
    try { await client.mutation(api.websitePlan.start, {...identity, ...extra}); }
    catch (cause) { if (alive) { const data = cause && typeof cause === 'object' && 'data' in cause ? cause.data : null; error.textContent = typeof data === 'string' ? data : 'I couldn’t finish your website plan. Your demand map is safe. Try again.';
      if (!extra.correction && !extra.answer && current?.state === 'ready') { controls.replaceChildren(button('Try again', () => void submit(), true), button('Review demand map', back)); }
    } }
    finally { busy = false; if (alive) updateDisabled(); }
  }
  function updateDisabled() {
    for (const control of root.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button, textarea')) control.disabled = busy || (control.dataset.requiresText === 'true') || (exporting && control.dataset.export === 'true');
  }
  async function download() {
    if (!current?.plan || exporting) return; exporting = true; status.textContent = 'Preparing your Excel file…';if(dialogStatus)dialogStatus.textContent=status.textContent; error.textContent = ''; updateDisabled();
    try { const {downloadPlan} = await import('./planExport'); await downloadPlan(current.plan, current.cards ?? [], current.offering ?? '',current.volumes); if (alive) status.textContent = 'Your Excel file is ready.'; }
    catch { if (alive) error.textContent = 'I couldn’t prepare the Excel file. Your website plan is safe. Try download again.'; }
    finally { exporting = false; if (alive) {if(dialogStatus)dialogStatus.textContent=error.textContent||status.textContent;updateDisabled();} }
  }
  function textForm(labelText: string, buttonText: string, action: (text: string) => void) {
    const form = el('form', '', 'plan-correction'), label = el('label', labelText), input = el('textarea'); input.maxLength = 2000; label.append(input);
    const apply = button(buttonText, () => {}, true); apply.type = 'submit'; apply.dataset.requiresText = 'true'; apply.disabled = true;
    input.oninput = () => { apply.dataset.requiresText = String(!input.value.trim()); updateDisabled(); };
    form.onsubmit = event => { event.preventDefault(); if (input.value.trim() && !busy) action(input.value.trim()); };
    form.append(label, apply); return form;
  }
  function confirmEnd(exit: boolean) {
    dialog?.remove();dialog = el('dialog','','plan-end-dialog');const confirmation=dialog;dialog.setAttribute('aria-label', exit ? 'Exit Topic Gibbon?' : 'Start a new run?');
    dialog.append(el('h2', exit ? 'Exit Topic Gibbon?' : 'Start a new run?'), el('p', exit ? 'Your saved plan will remain available in this browser.' : 'This will end your current run and start again with a new offering.'), el('p', 'Download your Excel first if you want to keep a copy of this plan.'));
    const buttons=el('div','','plan-actions'),exportButton=button('Download Excel', () => void download());exportButton.dataset.export='true';
    buttons.append(button('Cancel', () => confirmation.close()), exportButton, button(exit ? 'Exit' : 'Start new run', () => { confirmation.close(); reset(); }, true));
    dialogStatus=el('p','','small');dialogStatus.setAttribute('role','status');dialog.append(dialogStatus,buttons);
    dialog.onclose = () => {confirmation.remove();dialog=undefined;dialogStatus=undefined;}; root.append(dialog); dialog.showModal();updateDisabled();
  }
  function renderPlan(view: View) {
    const plan = view.plan!;
    output.append(el('p', 'This is how I’d turn the demand into website coverage.'), el('p', plan.summary));
    output.append(el('p', 'Priority reflects business fit and customer intent, not search volume.', 'small muted'));
    const method=el('details');method.dataset.planDetail='method';method.append(el('summary','About this research'),el('p',V1_EVIDENCE_NOTE,'small muted'));output.append(method);
    const pages = plan.nodes.filter(n => n.treatment === 'Page').length, resources = plan.nodes.filter(n => n.treatment === 'Supporting Content').length;
    output.append(el('p', `${pages} website ${pages === 1 ? 'page' : 'pages'}${resources ? ` · ${resources} supporting ${resources === 1 ? 'resource' : 'resources'}` : ''} · ${plan.nodes.filter(n => !isStandalone(n)).length} on-page sections or FAQ groups. On-page content does not need a separate URL.`, 'small muted'));
    const ranks = { First: 0, Next: 1, Later: 2 };
    function tree(parentId: string | null, standalone?: boolean): HTMLOListElement {
      const list = el('ol', '', 'plan-tree');
      for (const node of plan.nodes.filter(n => n.parentId === parentId && (standalone === undefined || isStandalone(n) === standalone)).sort((a, b) => ranks[a.priority] - ranks[b.priority])) {
        const item = el('li'), row = el('article', '', 'plan-node'), decision = el('div', '', 'plan-decision'); row.dataset.nodeId = node.id;
        decision.append(el('h3', node.label), el('p', `${node.treatment} · ${node.priority} priority`, 'plan-meta'));
        if(node.coverage[0])decision.append(el('p',node.coverage[0]));
        decision.append(el('p', isStandalone(node) ? (node.treatment === 'Page' ? 'Separate website page' : 'Separate supporting resource') : 'Content on this page · no separate URL', 'small muted'));
        const why = el('details', '', 'plan-evidence');why.dataset.planDetail=`why:${node.id}`; why.append(el('summary', 'Why this?')); fillEvidence(why, node, view.cards ?? []);
        if (view.state === 'complete') {
          const correction = el('details', '', 'plan-fix');correction.dataset.planDetail=`fix:${node.id}`; correction.append(el('summary', 'Something’s off'));
          correction.append(textForm('What should change about this recommendation?', 'Apply correction', text => void submit({expectedId: view.id, selectedNodeId: node.id, correction: text})));
          why.append(correction);
        }
        row.append(decision, why); item.append(row);
        const children = plan.nodes.filter(n => n.parentId === node.id);
        for (const separate of [false, true]) {
          const count = children.filter(n => isStandalone(n) === separate).length;
          if (count) { const branch = el('details', '', 'plan-branch');branch.dataset.planDetail=`branch:${node.id}:${separate}`; branch.open = true;
            branch.append(el('summary', separate ? `Subpages and resources (${count})` : `Content within ${node.label} (${count}) · no separate URL`), tree(node.id, separate)); item.append(branch); }
        }
        list.append(item);
      }
      return list;
    }
    output.append(tree(null));
    if (plan.limitations.length) { const limits = el('details', '', 'plan-limits'); limits.append(el('summary', 'Research limits')); if(view.volumes)limits.append(el('p','These planning notes were saved with the plan. Any saved source data remains available in the export; it does not rewrite your saved recommendations.','small muted')); const list = el('ul'); plan.limitations.forEach(t => list.append(el('li', t))); limits.append(list); output.append(limits); }
    const exportButton = button('Download Excel', () => void download(), true); exportButton.dataset.export = 'true'; actionButtons.append(exportButton);
    if (view.state === 'complete') actionButtons.append(button('Start a new run', () => confirmEnd(false)), button('Exit', () => confirmEnd(true)));
  }
  function fillEvidence(root: HTMLElement, node: WebsiteNode, cards: Card[]) {
    const detail = el('div', '', 'plan-detail'); detail.append(el('h4', 'Why this treatment and priority'), el('p', node.rationale), el('h4', 'What to cover'));
    const coverage = el('ul'); node.coverage.forEach(text => coverage.append(el('li', text))); detail.append(coverage);
    const {areas, queries} = planEvidence(node, cards); detail.append(el('h4', 'Mapped demand areas'), el('p', areas.map(a => a.label).join(' · ')));
    const sourceList = (rows: typeof queries, key:string) => {
      const group=el('div','','plan-sources'),list=el('ul');
      const sources=new Map<string,{source:(typeof queries)[number]['sources'][number];queries:Set<string>}>();
      for(const query of rows){const li=el('li',query.query);if(volumeFor(query.query,current?.volumes)!==null)li.append(el('p',queryVolumeText(query.query,current?.volumes),'small muted'));list.append(li);
        for(const source of query.sources){const id=JSON.stringify([source.provider,source.field,source.reference,source.retrievedAt]);if(!sources.has(id))sources.set(id,{source,queries:new Set()});sources.get(id)!.queries.add(query.query);}
      }
      const fields=new Set([...sources.values()].map(s=>s.source.field));
      const description=fields.has('related_questions.question')?(fields.has('related_searches.query')?'Based on Google search questions and related searches in India.':'Based on Google search questions in India.'):'Based on Google related searches in India.';
      group.append(list);if(sources.size)group.append(el('p',description,'small muted'));
      const metadata=el('details','','plan-source-details');metadata.dataset.planDetail=`sources:${node.id}:${key}`;metadata.append(el('summary','View source details'));
      const records=el('ul');for(const {source,queries:terms}of sources.values()){const row=el('li'),link=el('a',`${source.provider} · ${source.field} · ${source.retrievedAt}`);if(/^https?:\/\//i.test(source.reference))link.href=source.reference;link.target='_blank';link.rel='noopener noreferrer';row.append(link,el('p',`Searches: ${[...terms].join(' · ')}`,'small'));records.append(row);}metadata.append(records);if(sources.size)group.append(metadata);return group;
    };
    detail.append(el('h4', 'Searches from the mapped demand areas'), el('p', 'These searches describe the wider demand area. Not every search supports this particular recommendation.', 'small muted'), sourceList(queries.slice(0, 3),'preview'));
    const all = el('details');all.dataset.planDetail=`searches:${node.id}`; all.append(el('summary', `View all search evidence (${queries.length})`), sourceList(queries,'all')); detail.append(all);
    if (node.riskNote) detail.append(el('h4', 'Overlap or thin-page note'), el('p', node.riskNote));
    root.append(detail);
  }
  const stop = client.onUpdate(api.websitePlan.get, identity, (view: View) => {
    if (!alive) return; current = view;
    const before=app?trayGeometry(app):null;
    setCanvasMode(root,canvasMode('plan',view.state));
    if(app){app.dataset.planState=view.state;app.dataset.planHasResults=String(!!view.plan);}
    if(view.state==='complete'&&!volumesRequested){volumesRequested=true;void client.mutation(api.searchVolume.start,identity).catch(()=>{});}
    const key = JSON.stringify(view); if (key === lastDraw) return; lastDraw = key;
    savedScroll=reading.scrollTop;
    for(const detail of output.querySelectorAll<HTMLDetailsElement>('details[data-plan-detail]'))detailState.set(detail.dataset.planDetail!,detail.open);
    for(const input of output.querySelectorAll<HTMLTextAreaElement>('textarea')){const key=input.closest<HTMLElement>('[data-plan-detail]')?.dataset.planDetail;if(key)drafts.set(key,input.value);}
    const focused=document.activeElement as HTMLTextAreaElement|null,focusKey=focused?.matches('textarea')?focused.closest<HTMLElement>('[data-plan-detail]')?.dataset.planDetail:undefined;
    const selection=focusKey?[focused!.selectionStart,focused!.selectionEnd]:null;
    controls.replaceChildren(); question.replaceChildren(); output.replaceChildren();actionButtons.replaceChildren(); error.textContent = view.error ?? '';
    const phases: Record<string, string> = {ready:'Turning demand into website decisions…', generating:'Turning demand into website decisions…', checking:'Checking the website hierarchy and evidence…', complete:'Your website plan', failed:'Your website plan needs another step', clarification:'One decision before your website plan', review_required:'Your demand map needs confirmation'};
    heading.textContent = phases[view.state] ?? 'Loading your website plan…'; status.textContent = ['generating', 'checking'].includes(view.state) ? 'Your confirmed map is saved. You can return to this tab while the plan is being prepared.' : '';
    processing.hidden=!['generating','checking'].includes(view.state);
    if (view.state === 'ready' && !started) { started = true; void submit(); }
    if (view.state === 'failed') controls.append(button('Try again', () => void submit(), true));
    if(view.state==='review_required'||view.state==='failed')controls.append(button('Review demand map',back));
    if (view.state === 'clarification') { question.append(el('p', view.question ?? ''), textForm('Your answer', 'Continue with this answer', text => void submit({expectedId: view.id, answer: text}))); }
    if (view.plan) { if (view.state !== 'complete') output.append(el('p', 'Your previous saved plan remains below while this change is resolved.', 'muted')); renderPlan(view); }
    for(const detail of output.querySelectorAll<HTMLDetailsElement>('details[data-plan-detail]'))if(detailState.has(detail.dataset.planDetail!))detail.open=detailState.get(detail.dataset.planDetail!)!;
    for(const input of output.querySelectorAll<HTMLTextAreaElement>('textarea')){const key=input.closest<HTMLElement>('[data-plan-detail]')?.dataset.planDetail;if(key&&drafts.has(key)){input.value=drafts.get(key)!;const apply=input.form?.querySelector<HTMLButtonElement>('button');if(apply)apply.dataset.requiresText=String(!input.value.trim());}if(key===focusKey&&selection){input.focus({preventScroll:true});input.setSelectionRange(selection[0],selection[1]);}}
    reading.scrollTop=savedScroll;
    updateDisabled();
    if(app&&before){const after=trayGeometry(app);if(Math.abs(before.panel-after.panel)>1)transitionTray(app,before,after);}
  }, () => { if (alive) {processing.hidden=true; error.textContent = 'I couldn’t load your website plan. Your research is safe.'; controls.replaceChildren(button('Try again', () => window.location.reload(), true), button('Review demand map', back)); } });
  return () => { alive = false; stop();dialog?.remove();viewport?.removeEventListener('resize',revealForm);reading.removeEventListener('focusin',revealForm);if(app)cancelAnimationFrame(focusFrame);delete app?.dataset.planState;delete app?.dataset.planHasResults; };
}
