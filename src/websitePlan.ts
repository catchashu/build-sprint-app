import type { ConvexClient } from 'convex/browser';
import type { Id } from '../convex/_generated/dataModel';
import { api } from '../convex/_generated/api';
import type { Card } from '../shared/cardReview';
import { planEvidence, isStandalone, type WebsitePlan, type WebsiteNode } from '../shared/websitePlan';

type View = { id?: Id<'websitePlans'>; state: string; plan?: WebsitePlan | null; cards?: Card[]; offering?: string; question?: string | null; error?: string | null };
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const node = document.createElement(tag); node.textContent = text; node.className = cls; return node; };
export function mountWebsitePlan(client: ConvexClient, identity: {id: Id<'firstValueRuns'>; token: string}, root: HTMLElement, back: () => void, reset: () => void) {
  let alive = true, started = false, busy = false, exporting = false, current: View | null = null, lastDraw = '';
  const heading = el('h2', 'Loading your website plan…'); heading.tabIndex = -1;
  const status = el('p'); status.setAttribute('role', 'status');
  const error = el('p', '', 'error'); error.setAttribute('role', 'alert');
  const controls = el('div', '', 'plan-actions'), question = el('section'), output = el('div', '', 'website-plan');
  root.append(heading, status, error, controls, question, output);
  const button = (label: string, action: () => void, primary = false) => { const b = el('button', label, primary ? 'primary' : 'secondary'); b.type = 'button'; b.onclick = action; return b; };
  async function submit(extra: {expectedId?: Id<'websitePlans'>; selectedNodeId?: string; correction?: string; answer?: string} = {}) {
    if (busy || !alive) return; busy = true; error.textContent = ''; updateDisabled();
    try { await client.mutation(api.websitePlan.start, {...identity, ...extra}); }
    catch (cause) { if (alive) { const data = cause && typeof cause === 'object' && 'data' in cause ? cause.data : null; error.textContent = typeof data === 'string' ? data : 'I couldn’t finish your website plan. Your demand map is safe. Try again.';
      if (!extra.correction && !extra.answer && current?.state === 'ready') { controls.replaceChildren(button('Try again', () => void submit(), true), button('Back to demand map', back)); }
    } }
    finally { busy = false; if (alive) updateDisabled(); }
  }
  function updateDisabled() {
    for (const control of root.querySelectorAll<HTMLButtonElement | HTMLTextAreaElement>('button, textarea')) control.disabled = busy || (control.dataset.requiresText === 'true') || (exporting && control.dataset.export === 'true');
  }
  async function download() {
    if (!current?.plan || exporting) return; exporting = true; status.textContent = 'Preparing your Excel file…'; error.textContent = ''; updateDisabled();
    try { const {downloadPlan} = await import('./planExport'); await downloadPlan(current.plan, current.cards ?? [], current.offering ?? ''); if (alive) status.textContent = 'Your Excel file is ready.'; }
    catch { if (alive) error.textContent = 'I couldn’t prepare the Excel file. Your website plan is safe. Try download again.'; }
    finally { exporting = false; if (alive) updateDisabled(); }
  }
  function textForm(labelText: string, buttonText: string, action: (text: string) => void) {
    const form = el('form', '', 'plan-correction'), label = el('label', labelText), input = el('textarea'); input.maxLength = 2000; label.append(input);
    const apply = button(buttonText, () => {}, true); apply.type = 'submit'; apply.dataset.requiresText = 'true'; apply.disabled = true;
    input.oninput = () => { apply.dataset.requiresText = String(!input.value.trim()); updateDisabled(); };
    form.onsubmit = event => { event.preventDefault(); if (input.value.trim() && !busy) action(input.value.trim()); };
    form.append(label, apply); return form;
  }
  function confirmEnd(exit: boolean) {
    const dialog = el('dialog'); dialog.setAttribute('aria-label', exit ? 'Exit Topic Gibbon?' : 'Start a new run?');
    dialog.append(el('h2', exit ? 'Exit Topic Gibbon?' : 'Start a new run?'), el('p', exit ? 'Your saved plan will remain available in this browser.' : 'This will end your current run and start again with a new offering.'), el('p', 'Download your Excel first if you want to keep a copy of this plan.'));
    dialog.append(button('Cancel', () => dialog.close()), button('Download Excel', () => void download()), button(exit ? 'Exit' : 'Start new run', () => { dialog.close(); reset(); }, true));
    dialog.onclose = () => dialog.remove(); root.append(dialog); dialog.showModal();
  }
  function renderPlan(view: View) {
    const plan = view.plan!;
    output.append(el('p', 'This is how I’d turn the demand into website coverage.'), el('p', plan.summary));
    output.append(el('p', 'Priority reflects business fit and customer intent. Demand is “Insufficient evidence” because search volumes are unavailable.', 'small muted'));
    const pages = plan.nodes.filter(n => n.treatment === 'Page').length, resources = plan.nodes.filter(n => n.treatment === 'Supporting Content').length;
    output.append(el('p', `${pages} website ${pages === 1 ? 'page' : 'pages'}${resources ? ` · ${resources} supporting ${resources === 1 ? 'resource' : 'resources'}` : ''} · ${plan.nodes.filter(n => !isStandalone(n)).length} on-page sections or FAQ groups. On-page content does not need a separate URL.`, 'small muted'));
    const ranks = { First: 0, Next: 1, Later: 2 };
    function tree(parentId: string | null, standalone?: boolean): HTMLOListElement {
      const list = el('ol', '', 'plan-tree');
      for (const node of plan.nodes.filter(n => n.parentId === parentId && (standalone === undefined || isStandalone(n) === standalone)).sort((a, b) => ranks[a.priority] - ranks[b.priority])) {
        const item = el('li'), row = el('article', '', 'plan-node'), decision = el('div', '', 'plan-decision'); row.dataset.nodeId = node.id;
        decision.append(el('h3', node.label), el('p', `${node.treatment} · ${node.priority} priority`, 'plan-meta'), el('p', 'Demand: Insufficient evidence', 'small muted'));
        decision.append(el('p', isStandalone(node) ? (node.treatment === 'Page' ? 'Separate website page' : 'Separate supporting resource') : 'Content on this page · no separate URL', 'small muted'));
        const why = el('details', '', 'plan-evidence'); why.append(el('summary', 'Why this?')); fillEvidence(why, node, view.cards ?? []);
        if (view.state === 'complete') {
          const correction = el('details', '', 'plan-fix'); correction.append(el('summary', 'Something’s off'));
          correction.append(textForm('What should change about this recommendation?', 'Apply correction', text => void submit({expectedId: view.id, selectedNodeId: node.id, correction: text})));
          why.append(correction);
        }
        row.append(decision, why); item.append(row);
        const children = plan.nodes.filter(n => n.parentId === node.id);
        for (const separate of [false, true]) {
          const count = children.filter(n => isStandalone(n) === separate).length;
          if (count) { const branch = el('details', '', 'plan-branch'); branch.open = true;
            branch.append(el('summary', separate ? `Subpages and resources (${count})` : `Content within ${node.label} (${count}) · no separate URL`), tree(node.id, separate)); item.append(branch); }
        }
        list.append(item);
      }
      return list;
    }
    output.append(tree(null));
    if (plan.limitations.length) { const limits = el('details', '', 'plan-limits'); limits.append(el('summary', 'Research limits')); const list = el('ul'); plan.limitations.forEach(t => list.append(el('li', t))); limits.append(list); output.append(limits); }
    const footer = el('div', '', 'plan-actions'); const exportButton = button('Download Excel', () => void download(), true); exportButton.dataset.export = 'true'; footer.append(exportButton);
    if (view.state === 'complete') footer.append(button('Start a new run', () => confirmEnd(false)), button('Exit', () => confirmEnd(true)));
    output.append(footer);
  }
  function fillEvidence(root: HTMLElement, node: WebsiteNode, cards: Card[]) {
    const detail = el('div', '', 'plan-detail'); detail.append(el('h4', 'Why this treatment and priority'), el('p', node.rationale), el('h4', 'What to cover'));
    const coverage = el('ul'); node.coverage.forEach(text => coverage.append(el('li', text))); detail.append(coverage);
    const {areas, queries} = planEvidence(node, cards); detail.append(el('h4', 'Mapped demand areas'), el('p', areas.map(a => a.label).join(' · ')));
    const sourceList = (rows: typeof queries) => { const list = el('ul', '', 'plan-sources'); for (const query of rows) { const li = el('li', query.query); for (const source of query.sources) { const link = el('a', `${source.provider} · ${source.field === 'related_questions.question' ? 'Google question' : 'Google related search'} · ${source.retrievedAt}`); if (/^https?:\/\//i.test(source.reference)) link.href = source.reference; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link); } list.append(li); } return list; };
    detail.append(el('h4', 'Searches from the mapped demand areas'), el('p', 'These searches describe the wider demand area. Not every search supports this particular recommendation.', 'small muted'), sourceList(queries.slice(0, 3)));
    const all = el('details'); all.append(el('summary', `View all search evidence (${queries.length})`), sourceList(queries)); detail.append(all);
    if (node.riskNote) detail.append(el('h4', 'Overlap or thin-page note'), el('p', node.riskNote));
    root.append(detail);
  }
  const stop = client.onUpdate(api.websitePlan.get, identity, (view: View) => {
    if (!alive) return; current = view;
    const key = JSON.stringify(view); if (key === lastDraw) return; lastDraw = key;
    controls.replaceChildren(); question.replaceChildren(); output.replaceChildren(); error.textContent = view.error ?? '';
    const phases: Record<string, string> = {ready:'Turning demand into website decisions…', generating:'Turning demand into website decisions…', checking:'Checking the website hierarchy and evidence…', complete:'Your website plan', failed:'Your website plan needs another step', clarification:'One decision before your website plan', review_required:'Your demand map needs confirmation'};
    heading.textContent = phases[view.state] ?? 'Loading your website plan…'; status.textContent = ['generating', 'checking'].includes(view.state) ? 'Your confirmed map is saved. You can return to this tab while the plan is being prepared.' : '';
    if (view.state === 'ready' && !started) { started = true; void submit(); }
    if (view.state === 'failed') controls.append(button('Try again', () => void submit(), true));
    controls.append(button('Back to demand map', back));
    if (view.state === 'clarification') { question.append(el('p', view.question ?? ''), textForm('Your answer', 'Continue with this answer', text => void submit({expectedId: view.id, answer: text}))); }
    if (view.plan) { if (view.state !== 'complete') output.append(el('p', 'Your previous saved plan remains below while this change is resolved.', 'muted')); renderPlan(view); }
    updateDisabled();
  }, () => { if (alive) { error.textContent = 'I couldn’t load your website plan. Your research is safe.'; controls.replaceChildren(button('Try again', () => window.location.reload(), true), button('Back to demand map', back)); } });
  return () => { alive = false; stop(); };
}
