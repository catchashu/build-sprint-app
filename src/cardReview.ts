import type { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { Review, Card } from "../shared/cardReview";
import {demandSummary,queryVolumeText,VOLUME_NOTE,type VolumeSnapshot} from '../shared/searchVolume';
type View = Review & { volumes?:VolumeSnapshot|null; volumeState?:string|null; clarificationPending?: boolean; unlocked?: boolean; pending: { cardId: string; id: string } | null; last: { id: string; cardId: string; kind: "label" | "other" | "split" | "merge"; queryIds?: string[]; targetCardId?: string; note: string; state: string; error: string | null } | null };
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const e = document.createElement(tag); e.textContent = text; e.className = cls; return e; };
const labels = { split: "These searches should not be grouped together", merge: "This should be grouped with another card", excluded: "This isn’t part of what I offer", label: "The label / meaning is wrong", other: "Something else" };
export function mountReview(client: ConvexClient, identity: { id: Id<"firstValueRuns">; token: string }, root: HTMLElement, continueToUnlock: () => void, options: { demandMap?: boolean } = {}) {
  const reviews = options.demandMap ? api.mapReview : api.cardReview;
  let current: View | null = null;
  let editing: { cardId: string; kind: keyof typeof labels | ""; note: string; requestId: string; queryIds?: string[]; targetCardId?: string } | null = null;
  let busy = false, error = "", dismissedJob = "", alive = true, savingCardId = "", failedCardId = "";
  const cardList = element("div", "", "cards"), outsideCards = element("div");
  const cardNodes = new Map<string, { key: string; article: HTMLElement }>();
  root.replaceChildren(cardList, outsideCards);
  const button = (text: string, fn: () => void, primary = false) => { const b = element("button", text, primary ? "primary" : "secondary"); b.type = "button"; b.disabled = busy || !!current?.pending; b.onclick = fn; return b; };
  async function perform(fn: () => Promise<void>, cardId = "") {
    if (busy || current?.pending) return;
    busy = true; error = ""; savingCardId = cardId; failedCardId = ""; draw();
    try { await fn(); }
    catch (cause) { const data = cause && typeof cause === "object" && "data" in cause ? cause.data : null; error = typeof data === "string" ? data : "I couldn’t save that change. Your original card is still here. Try again."; failedCardId = cardId; }
    finally { busy = false; savingCardId = ""; if (alive) draw(); }
  }
  function sourceList(card: Card) {
    const list = element("ul");
    for (const query of card.queries) {
      const item = element("li", query.query), detail = element("details"); detail.dataset.queryId = query.id; detail.append(element("summary", "Source"));
      if(options.demandMap)detail.append(element('p',queryVolumeText(query.query,current?.volumes),'small muted'));
      for (const source of query.sources) {
        const a = element("a", `${source.field === "related_questions.question" ? "Google question" : "Google related search"} · ${source.retrievedAt}`);
        a.href = source.reference; a.target = "_blank"; a.rel = "noopener noreferrer"; detail.append(a);
      }
      item.append(detail); list.append(item);
    }
    return list;
  }
  function draw() {
    if (!current || !alive) return;
    const scrollTop = cardList.scrollTop, scrollLeft = cardList.scrollLeft;
    const openSources = new Set([...cardList.querySelectorAll<HTMLDetailsElement>("details[open]")].map(detail => detail.dataset.queryId));
    const nextOutside = document.createDocumentFragment();
    for (const [index, card] of current.cards.entries()) {
      const key = JSON.stringify({ card, volumes:current.volumes, volumeState:current.volumeState, excluded: current.decisions[card.groupId] === "excluded", editing: editing?.cardId === card.groupId ? editing : null, unlocked: current.unlocked,
        pending: current.pending?.cardId === card.groupId ? current.pending : null, last: current.last?.cardId === card.groupId ? current.last : null });
      const cached = cardNodes.get(card.groupId);
      if (cached?.key === key) {
        if (cardList.children[index] !== cached.article) cardList.insertBefore(cached.article, cardList.children[index] ?? null);
        continue;
      }
      const decision = current.decisions[card.groupId], article = element("article");
      article.dataset.cardId = card.groupId;
      cardNodes.set(card.groupId, { key, article });
      if (cached) cached.article.replaceWith(article);
      else cardList.insertBefore(article, cardList.children[index] ?? null);
      article.append(element("h3", card.label), element("p", card.need));
      if (decision === "excluded") {
        article.append(element("p", "Excluded from your offering", "muted"));
        if (options.demandMap) article.append(button("Restore this area", () => void perform(async () => { await client.mutation(reviews.decision, { ...identity, revision: current!.revision, cardId: card.groupId, decision: "correct" }); }, card.groupId)));
        continue;
      }
      if (options.demandMap) article.append(element("p", ['queued','running'].includes(current.volumeState??'')?'Checking India search volumes…':`Demand: ${demandSummary(card.queries,current.volumes).text}`, "small muted"));
      if (options.demandMap && card.queries.length > 3) {
        article.append(sourceList({ ...card, queries: card.queries.slice(0, 3) }));
        const all = element("details"); all.dataset.queryId = `area:${card.groupId}`; all.append(element("summary", `View all ${card.queries.length} searches`), sourceList(card)); article.append(all);
      } else article.append(sourceList(card));
      article.append(element("p", "Sourced from live Google search evidence · India", "small muted"));
      const actions = element("div", "", "review-actions");
      const saveStatus = element("p", "", "small review-save-state"); saveStatus.setAttribute("role", "status"); article.append(saveStatus);
      const correct = button("Correct", () => void perform(async () => {
        const revision = current!.revision;
        await client.mutation(reviews.decision, { ...identity, revision, cardId: card.groupId, decision: "correct" });
        // A successful write can be acknowledged without waiting for another notification.
        if (current?.revision === revision) current = { ...current, revision: revision + 1, accepted: false, decisions: { ...current.decisions, [card.groupId]: "correct" } };
      }, card.groupId)); correct.dataset.action = "correct"; actions.append(correct);
      actions.append(button(options.demandMap ? "Something is off" : "Fix this", () => { editing = { cardId: card.groupId, kind: "", note: "", requestId: crypto.randomUUID() }; error = ""; draw(); root.querySelector<HTMLElement>(".correction-title")?.focus(); }));
      if (!current.unlocked) article.append(actions);
      if (current.pending?.cardId === card.groupId) { const p = element("p", "Updating this with your correction…"); p.setAttribute("role", "status"); article.append(p); }
      else if (current.last?.cardId === card.groupId && current.last.state === "complete" && decision === "pending") article.append(element("p", "Updated. Check this again.", "review-correction-status"));
      if (editing?.cardId === card.groupId) {
        const form = element("form", "", "correction-form"), title = element("h4", "What should I fix about this?", "correction-title"); title.tabIndex = -1; form.append(title);
        const selectLabel = element("label", "Choose what needs fixing."), select = element("select");
        select.append(new Option("Choose a reason", ""));
        for (const [value, label] of Object.entries(labels)) select.append(new Option(label, value));
        select.value = editing.kind; select.disabled = busy || !!current.pending;
        select.onchange = () => { editing!.queryIds = []; editing!.targetCardId = ""; editing!.kind = select.value as keyof typeof labels; editing!.requestId = crypto.randomUUID(); error = ""; draw(); root.querySelector<HTMLTextAreaElement>(".correction-form textarea")?.focus(); };
        selectLabel.append(select); form.append(selectLabel);
        let input: HTMLTextAreaElement | undefined;
        if (editing.kind === "excluded") form.append(element("p", "I’ll exclude this from my understanding of your offering."));
        else if (editing.kind === "split" || editing.kind === "merge") {
          const splitting = editing.kind === "split";
          const choices = element("fieldset"); choices.append(element("legend", splitting ? "Which of these does not belong here?" : "Which area should this be grouped with?"));
          const options = splitting ? card.queries.map(q => ({ id: q.id, text: q.query })) : current.cards.filter(c => c.groupId !== card.groupId && current!.decisions[c.groupId] !== "excluded").map(c => ({ id: c.groupId, text: `${c.label} - ${c.queries[0]?.query ?? ""}` }));
          if (!options.length) choices.append(element("p", "There is no other remaining card to merge with."));
          for (const option of options) {
            const label = element("label", "", "review-choice"), control = element("input"); control.type = splitting ? "checkbox" : "radio"; control.name = "grouping-choice";
            control.checked = splitting ? !!editing.queryIds?.includes(option.id) : editing.targetCardId === option.id; control.disabled = busy || !!current.pending;
            control.onchange = () => { if (splitting) editing!.queryIds = control.checked ? [...(editing!.queryIds ?? []), option.id] : editing!.queryIds?.filter(id => id !== option.id); else editing!.targetCardId = option.id; editing!.requestId = crypto.randomUUID(); apply.dataset.invalid = String(!valid()); apply.disabled = busy || !!current?.pending || !valid(); };
            label.append(control, element("span", option.text)); choices.append(label);
          }
          if (splitting) choices.append(element("p", "Leave at least one search unselected so Gibbon can separate the needs.", "small muted"));
          form.append(choices);
        }
        else if (editing.kind) {
          const label = element("label", editing.kind === "label" ? "Tell me what I should understand instead." : "Tell me what needs changing.");
          input = element("textarea"); input.value = editing.note; input.maxLength = 2000; input.disabled = busy || !!current.pending;
          label.append(input); form.append(label);
        }
        const apply = button("Apply fix", () => {}, true); apply.type = "submit";
        const valid = () => !!editing?.kind && (editing.kind === "excluded" || (editing.kind === "split" ? !!editing.queryIds?.length && editing.queryIds.length < card.queries.length : editing.kind === "merge" ? !!editing.targetCardId : !!editing.note.trim()));
        apply.disabled = busy || !!current.pending || !valid();
        apply.dataset.invalid = String(!valid());
        if (input) input.oninput = () => { editing!.note = input!.value; editing!.requestId = crypto.randomUUID(); apply.dataset.invalid = String(!valid()); apply.disabled = busy || !!current?.pending || !valid(); };
        form.onsubmit = event => { event.preventDefault(); if (!valid()) return; const draft = { ...editing! }; void perform(async () => {
          if (draft.kind === "excluded") { await client.mutation(reviews.decision, { ...identity, revision: current!.revision, cardId: draft.cardId, decision: "excluded" }); editing = null; }
          else { await client.mutation(reviews.apply, { ...identity, revision: current!.revision, cardId: draft.cardId, kind: draft.kind as "label" | "other" | "split" | "merge", queryIds: draft.queryIds, targetCardId: draft.targetCardId, note: draft.note, requestId: draft.requestId }); }
        }); };
        const buttons = element("div", "", "review-actions"); buttons.append(button("Cancel", () => { dismissedJob = current?.last?.id ?? ""; editing = null; error = ""; draw(); }), apply); form.append(buttons); article.append(form);
      }
    }
    for (const [id, cached] of cardNodes) {
      if (!current.cards.some(card => card.groupId === id)) { cached.article.remove(); cardNodes.delete(id); continue; }
      const confirmed = current.decisions[id] === "correct", saving = savingCardId === id && !confirmed;
      cached.article.setAttribute("aria-busy", String(saving));
      const status = cached.article.querySelector<HTMLElement>(".review-save-state");
      if (status) { status.textContent = failedCardId === id ? error : confirmed ? "Marked correct" : saving ? "Saving…" : ""; status.classList.toggle("error", failedCardId === id && !!error); }
      const correctionStatus = cached.article.querySelector<HTMLElement>(".review-correction-status"); if (correctionStatus) correctionStatus.hidden = confirmed;
      for (const control of cached.article.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("button, input, select, textarea")) {
        control.disabled = busy || !!current.pending || control.dataset.invalid === "true" || (control.dataset.action === "correct" && confirmed);
        if (control.dataset.action === "correct") control.textContent = saving ? "Saving…" : "Correct";
      }
    }
    for (const detail of cardList.querySelectorAll<HTMLDetailsElement>("details")) if (openSources.has(detail.dataset.queryId)) detail.open = true;
    cardList.scrollTop = scrollTop; cardList.scrollLeft = scrollLeft;
    if (error && !failedCardId) { const p = element("p", error, "error review-wide"); p.setAttribute("role", "alert"); nextOutside.append(p); }
    if (current.last?.state === "failed" && current.last.id !== dismissedJob && !current.pending) {
      const p = element("p", `I couldn’t apply that change. Your original card is still here. ${current.last.error ?? ""}`, "error review-wide"); p.setAttribute("role", "alert"); nextOutside.append(p);
      nextOutside.append(button("Try again", () => { const last = current!.last!; editing = { cardId: last.cardId, kind: last.kind, queryIds: last.queryIds, targetCardId: last.targetCardId, note: last.note, requestId: crypto.randomUUID() }; dismissedJob = last.id; draw(); }));
    }
    const active = current.cards.filter(c => current!.decisions[c.groupId] !== "excluded");
    const allCorrect = active.length > 0 && active.every(c => current!.decisions[c.groupId] === "correct");
    if (!active.length) nextOutside.append(element("p", "All cards are excluded. Edit your context to research the offering you want to cover.", "review-wide"));
    else if (current.accepted) {
      const saved = element("div", "", "review-footer"); saved.setAttribute("role", "status");
      saved.append(element("p", options.demandMap ? "Your demand map is saved. It’s ready to become your website plan." : "Your confirmed understanding is saved."));
      const continueSaved = button(options.demandMap ? "Build my website plan" : "Continue", continueToUnlock, true);
      continueSaved.disabled = continueSaved.disabled || !!editing;
      saved.append(continueSaved);
      nextOutside.append(saved);
    }
    else {
      const next = button(options.demandMap ? "Confirm demand map" : "Continue", () => void perform(async () => { await client.mutation(reviews.accept, { ...identity, revision: current!.revision }); continueToUnlock(); }), true);
      next.disabled = next.disabled || !allCorrect || !!editing || !!current.clarificationPending;
      const footer = element("div", "", "review-footer"); footer.append(element("p", current.clarificationPending ? "Answer the question above before confirming the map." : allCorrect ? "Your cards are ready to confirm." : "Mark each remaining card Correct before continuing.", "small muted"), next); nextOutside.append(footer);
    }
    nextOutside.append(element("p", options.demandMap ? VOLUME_NOTE : "This first view uses Google suggestions and questions localized to India. It does not measure search volume.", "small muted review-wide"));
    outsideCards.replaceChildren(nextOutside);
  }
  const stop = client.onUpdate(reviews.get, identity, (view: View | null) => {
    if (!view || (current && view.revision < current.revision)) return;
    const previous = current; current = view;
    if (view.last?.state === "complete" && previous?.pending?.id === view.last.id) editing = null;
    if (!previous && view.pending && view.last) editing = { cardId: view.last.cardId, kind: view.last.kind, queryIds: view.last.queryIds, targetCardId: view.last.targetCardId, note: view.last.note, requestId: crypto.randomUUID() };
    draw();
  }, () => { error = "The review connection was interrupted. Your saved cards are still here. Reload to reconnect."; draw(); });
  return () => { alive = false; stop(); };
}
