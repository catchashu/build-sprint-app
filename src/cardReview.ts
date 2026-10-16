import { randomId } from "./randomId";
import { trayGeometry, transitionTray } from "./trayTransition";
import type { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { Review, Card } from "../shared/cardReview";
import type {VolumeSnapshot} from '../shared/searchVolume';
const DEMAND_MAP_NOTE = 'Research based on Google search suggestions in India (English). Search volumes are not available in this version.';
type View = Review & { volumes?:VolumeSnapshot|null; volumeState?:string|null; clarificationPending?: boolean; unlocked?: boolean; pending: { cardId: string; id: string } | null; last: { id: string; cardId: string; kind: "label" | "other" | "split" | "merge"; queryIds?: string[]; targetCardId?: string; note: string; state: string; error: string | null } | null };
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const e = document.createElement(tag); e.textContent = text; e.className = cls; return e; };
const labels = { split: "These searches should not be grouped together", merge: "This should be grouped with another card", excluded: "This isn’t part of what I offer", label: "The label / meaning is wrong", other: "Something else" };
export function mountReview(client: ConvexClient, identity: { id: Id<"firstValueRuns">; token: string }, root: HTMLElement, continueToUnlock: () => void, options: { demandMap?: boolean; deck?: boolean; suggestionsUnavailable?: () => boolean; editContext?: () => void } = {}) {
  const reviews = options.demandMap ? api.mapReview : api.cardReview;
  const deck = !!options.deck;
  let selectedId = "", summary = false, lastVisible = "";
  let evidenceDialog: HTMLDialogElement | undefined;
  const navigation = element("div", "", "deck-navigation");
  navigation.hidden = !deck;
  let current: View | null = null;
  let editing: { cardId: string; kind: keyof typeof labels | ""; note: string; requestId: string; queryIds?: string[]; targetCardId?: string } | null = null;
  let busy = false, error = "", dismissedJob = "", alive = true, savingCardId = "", failedCardId = "";
  const cardList = element("div", "", "cards"), outsideCards = element("div");
  const cardNodes = new Map<string, { key: string; article: HTMLElement }>();
  root.classList.toggle("cluster-deck", deck);
  root.replaceChildren(navigation, cardList, outsideCards);
  const button = (text: string, fn: () => void, primary = false) => { const b = element("button", text, primary ? "primary" : "secondary"); b.type = "button"; b.disabled = busy || !!current?.pending; b.onclick = fn; return b; };
  async function perform(fn: () => Promise<void>, cardId = "") {
    if (busy || current?.pending) return;
    busy = true; error = ""; savingCardId = cardId; failedCardId = ""; draw();
    try { await fn(); }
    catch (cause) { const data = cause && typeof cause === "object" && "data" in cause ? cause.data : null; error = typeof data === "string" ? data : "I couldn’t save that change. Your original card is still here. Try again."; failedCardId = cardId; }
    finally { busy = false; savingCardId = ""; if (alive) draw(); }
  }
  function visit(id: string) { selectedId = id; summary = false; editing = null; error = ""; draw(); focusCard(); }
  function focusCard() { root.querySelector<HTMLElement>("article:not([hidden]) h3, .deck-summary h3")?.focus({ preventScroll: true }); }
  async function decideCard(cardId: string, decision: "correct" | "excluded") {
    await perform(async () => {
      const revision = current!.revision;
      await client.mutation(reviews.decision, { ...identity, revision, cardId, decision });
      if (current?.revision === revision) current = { ...current, revision: revision + 1, accepted: false, decisions: { ...current.decisions, [cardId]: decision } };
      if (!alive) return;
      const next = current!.cards.find(c => current!.decisions[c.groupId] === "pending");
      selectedId = next?.groupId ?? cardId; summary = !next;
    }, cardId);
    if (alive && !error) focusCard();
  }
  function showEvidence(card: Card) {
    evidenceDialog?.remove();
    const dialog = element("dialog", "", "cluster-evidence"); evidenceDialog = dialog;
    dialog.setAttribute("aria-label", `Search evidence: ${card.label}`);
    const header = element("div", "", "explainer-header");
    const close = element("button", "Close", "explainer-close"); close.type = "button"; close.onclick = () => dialog.close();
    header.append(element("h2", "Cluster details"), close);
    dialog.append(header, element("h3", card.label), element("p", card.need), element("p", options.demandMap ? DEMAND_MAP_NOTE : "Observed Google searches · India. These are search examples, not measured search volumes.", "small muted"), sourceList(card));
    if (options.suggestionsUnavailable?.()) {
      const note = element("p", "Some search suggestions were unavailable. These clusters use the results we could retrieve, so the evidence may not cover every relevant search.", "small muted coverage-note");
      dialog.insertBefore(note, dialog.lastElementChild);
    }
    root.append(dialog); dialog.addEventListener("close", () => { dialog.remove(); evidenceDialog = undefined; }); dialog.showModal();
  }
  function sourceList(card: Card) {
    const list = element("ul");
    for (const query of card.queries) {
      const item = element("li", query.query), detail = element("details"); detail.dataset.queryId = query.id; detail.append(element("summary", "Source"));
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
    const app = deck ? root.closest<HTMLElement>("#app") : null;
    const before = app ? trayGeometry(app) : null;
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
      article.append(element("h3", card.label), element("p", card.need, deck ? "cluster-need" : ""));
      if (decision === "excluded" && !deck) {
        article.append(element("p", "Excluded from your offering", "muted"));
        if (options.demandMap) article.append(button("Restore this area", () => void perform(async () => { await client.mutation(reviews.decision, { ...identity, revision: current!.revision, cardId: card.groupId, decision: "correct" }); }, card.groupId)));
        continue;
      }
      if (options.demandMap) article.append(element("p", "Search volumes are not available in this version.", "small muted"));
      if (deck) {
        const related = element("ul", "", "cluster-searches");
        for (const query of card.queries.slice(0, 3)) related.append(element("li", query.query));
        const details = button("View all searches", () => showEvidence(card)); details.dataset.action = "evidence";
        article.append(element("p", "Related searches", "small cluster-label"), related, details);
      } else if (options.demandMap && card.queries.length > 3) {
        article.append(sourceList({ ...card, queries: card.queries.slice(0, 3) }));
        const all = element("details"); all.dataset.queryId = `area:${card.groupId}`; all.append(element("summary", `View all ${card.queries.length} searches`), sourceList(card)); article.append(all);
      } else article.append(sourceList(card));
      if (!deck) article.append(element("p", "Sourced from live Google search evidence · India", "small muted"));
      const actions = element("div", "", "review-actions");
      const saveStatus = element("p", "", "small review-save-state"); saveStatus.setAttribute("role", "status"); article.append(saveStatus);
      const correct = button(deck ? "✓ Accept" : "Correct", () => deck ? void decideCard(card.groupId, "correct") : void perform(async () => {
        const revision = current!.revision;
        await client.mutation(reviews.decision, { ...identity, revision, cardId: card.groupId, decision: "correct" });
        // A successful write can be acknowledged without waiting for another notification.
        if (current?.revision === revision) current = { ...current, revision: revision + 1, accepted: false, decisions: { ...current.decisions, [card.groupId]: "correct" } };
      }, card.groupId)); correct.dataset.action = "correct"; actions.append(correct);
      if (deck) { const reject = button("✕ Reject", () => void decideCard(card.groupId, "excluded")); reject.dataset.action = "reject"; actions.prepend(reject); }
      const fix = button(options.demandMap ? "Something is off" : "Fix this", () => { editing = { cardId: card.groupId, kind: "", note: "", requestId: randomId() }; error = ""; draw(); root.querySelector<HTMLElement>(".correction-title")?.focus(); });
      if (deck) {
        fix.dataset.action = "fix";
        const tools = element("div", "", "cluster-tools"); tools.append(article.querySelector("button")!, fix); article.insertBefore(tools, saveStatus);
      } else actions.append(fix);
      if (!current.unlocked) article.append(actions);
      if (current.pending?.cardId === card.groupId) { const p = element("p", "Updating this with your correction…"); p.setAttribute("role", "status"); article.append(p); }
      else if (!deck && current.last?.cardId === card.groupId && current.last.state === "complete" && decision === "pending") article.append(element("p", "Updated. Check this again.", "review-correction-status"));
      if (editing?.cardId === card.groupId) {
        const form = element("form", "", "correction-form"), title = element("h4", "What should I fix about this?", "correction-title"); title.tabIndex = -1; form.append(title);
        const selectLabel = element("label", "Choose what needs fixing."), select = element("select");
        select.append(new Option("Choose a reason", ""));
        for (const [value, label] of Object.entries(labels)) if (!deck || value !== "excluded") select.append(new Option(label, value));
        select.value = editing.kind; select.disabled = busy || !!current.pending;
        select.onchange = () => { editing!.queryIds = []; editing!.targetCardId = ""; editing!.kind = select.value as keyof typeof labels; editing!.requestId = randomId(); error = ""; draw(); root.querySelector<HTMLTextAreaElement>(".correction-form textarea")?.focus(); };
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
            control.onchange = () => { if (splitting) editing!.queryIds = control.checked ? [...(editing!.queryIds ?? []), option.id] : editing!.queryIds?.filter(id => id !== option.id); else editing!.targetCardId = option.id; editing!.requestId = randomId(); apply.dataset.invalid = String(!valid()); apply.disabled = busy || !!current?.pending || !valid(); };
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
        if (input) input.oninput = () => { editing!.note = input!.value; editing!.requestId = randomId(); apply.dataset.invalid = String(!valid()); apply.disabled = busy || !!current?.pending || !valid(); };
        form.onsubmit = event => { event.preventDefault(); if (!valid()) return; const draft = { ...editing! }; void perform(async () => {
          if (draft.kind === "excluded") { await client.mutation(reviews.decision, { ...identity, revision: current!.revision, cardId: draft.cardId, decision: "excluded" }); editing = null; }
          else { await client.mutation(reviews.apply, { ...identity, revision: current!.revision, cardId: draft.cardId, kind: draft.kind as "label" | "other" | "split" | "merge", queryIds: draft.queryIds, targetCardId: draft.targetCardId, note: draft.note, requestId: draft.requestId }); }
        }); };
        const buttons = element("div", "", "review-actions"); buttons.append(button("Cancel", () => { dismissedJob = current?.last?.id ?? ""; editing = null; error = ""; draw(); }), apply); form.append(buttons); article.append(form);
      }
    }
    for (const [id, cached] of cardNodes) {
      if (!current.cards.some(card => card.groupId === id)) { cached.article.remove(); cardNodes.delete(id); continue; }
      const confirmed = current.decisions[id] === "correct", saving = savingCardId === id && (deck || !confirmed);
      cached.article.setAttribute("aria-busy", String(saving));
      const status = cached.article.querySelector<HTMLElement>(".review-save-state");
      if (status) { status.textContent = failedCardId === id ? error : saving ? "Saving…" : confirmed ? (deck ? "Accepted · relevant to your offering" : "Marked correct") : deck && current.decisions[id] === "excluded" ? "Rejected · outside your offering" : ""; status.classList.toggle("error", failedCardId === id && !!error); }
      if (deck && status && !status.textContent && current.last?.cardId === id && current.last.state === "complete") status.textContent = "Updated. Check this again.";
      const correctionStatus = cached.article.querySelector<HTMLElement>(".review-correction-status"); if (correctionStatus) correctionStatus.hidden = confirmed;
      for (const control of cached.article.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("button, input, select, textarea")) {
        control.disabled = busy || !!current.pending || control.dataset.invalid === "true" || (control.dataset.action === "correct" && confirmed);
        if (control.dataset.action === "correct") control.textContent = deck ? "✓ Accept" : saving ? "Saving…" : "Correct";
        if (deck && control.dataset.action === "reject" && current.decisions[id] === "excluded") control.disabled = true;
        if (deck && control.dataset.action === "fix" && current.decisions[id] === "excluded") { control.disabled = true; control.title = "Accept this cluster before correcting it."; }
      }
      if (deck) { cached.article.classList.toggle("is-editing", editing?.cardId === id); cached.article.querySelector("h3")!.tabIndex = -1; }
    }
    for (const detail of cardList.querySelectorAll<HTMLDetailsElement>("details")) if (openSources.has(detail.dataset.queryId)) detail.open = true;
    cardList.scrollTop = scrollTop; cardList.scrollLeft = scrollLeft;
    if (error && !failedCardId) { const p = element("p", error, "error review-wide"); p.setAttribute("role", "alert"); nextOutside.append(p); }
    if (current.last?.state === "failed" && current.last.id !== dismissedJob && !current.pending) {
      const p = element("p", `I couldn’t apply that change. Your original card is still here. ${current.last.error ?? ""}`, "error review-wide"); p.setAttribute("role", "alert"); nextOutside.append(p);
      nextOutside.append(button("Try again", () => { const last = current!.last!; editing = { cardId: last.cardId, kind: last.kind, queryIds: last.queryIds, targetCardId: last.targetCardId, note: last.note, requestId: randomId() }; dismissedJob = last.id; draw(); }));
    }
    const active = current.cards.filter(c => current!.decisions[c.groupId] !== "excluded");
    const allCorrect = active.length > 0 && active.every(c => current!.decisions[c.groupId] === "correct");
    if (!active.length) { nextOutside.append(element("p", deck ? "All clusters are rejected. Review your decisions or edit your context to try again." : "All cards are excluded. Edit your context to research the offering you want to cover.", "review-wide")); if (options.editContext) nextOutside.append(button("Edit context", options.editContext)); }
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
      const footer = element("div", "", "review-footer"); footer.append(element("p", current.clarificationPending ? "Answer the question above before confirming the map." : allCorrect ? (deck ? "Your decisions are ready to confirm." : "Your cards are ready to confirm.") : deck ? "Accept or reject every cluster before continuing." : "Mark each remaining card Correct before continuing.", "small muted"), next); nextOutside.append(footer);
    }
    nextOutside.append(element("p", options.demandMap ? DEMAND_MAP_NOTE : "This first view uses Google suggestions and questions localized to India. It does not measure search volume.", "small muted review-wide"));
    outsideCards.replaceChildren(nextOutside);
    if (deck) {
      if (!current.cards.some(c => c.groupId === selectedId)) selectedId = current.cards.find(c => current!.decisions[c.groupId] === "pending")?.groupId ?? current.cards[0]?.groupId ?? "";
      const index = current.cards.findIndex(c => c.groupId === selectedId);
      root.dataset.reviewView = summary ? "summary" : editing ? "correction" : "card";
      if (app && !root.hidden) app.dataset.reviewView = root.dataset.reviewView;
      navigation.replaceChildren();
      const previous = button("Previous", () => visit(current!.cards[Math.max(0, index - 1)].groupId)); previous.disabled ||= index <= 0 || !!editing;
      const next = button("Next", () => visit(current!.cards[Math.min(current!.cards.length - 1, index + 1)].groupId)); next.disabled ||= index >= current.cards.length - 1 || !!editing;
      const progress = element("p", `Cluster ${index + 1} of ${current.cards.length}`, "count"); progress.setAttribute("role", "status");
      if (!summary) navigation.append(previous, progress, next);
      for (const [id, { article }] of cardNodes) article.hidden = summary || id !== selectedId;
      cardList.hidden = summary;
      if (!summary) {
        // Keep technical errors visible, but show confirmation only in the decision summary.
        outsideCards.querySelectorAll<HTMLElement>(".review-footer, .small.muted.review-wide").forEach(n => n.hidden = true);
        const review = button("Review decisions", () => { summary = true; draw(); focusCard(); }); review.disabled ||= !!editing;
        outsideCards.append(review);
      } else {
        const overview = element("section", "", "deck-summary");
        const heading = element("h3", "Your cluster decisions"); heading.tabIndex = -1;
        const kept = current.cards.filter(c => current!.decisions[c.groupId] === "correct").length;
        const rejected = current.cards.filter(c => current!.decisions[c.groupId] === "excluded").length;
        overview.append(heading, element("p", `${kept} accepted · ${rejected} rejected · ${current.cards.length - kept - rejected} to review`, "small"));
        for (const card of current.cards) {
          const row = element("div", "", "decision-row");
          row.append(element("span", card.label), element("span", current.decisions[card.groupId] === "correct" ? "Accepted" : current.decisions[card.groupId] === "excluded" ? "Rejected" : "To review", "small"), button("Review", () => visit(card.groupId)));
          overview.append(row);
        }
        outsideCards.prepend(overview);
        if (active.length && options.editContext) outsideCards.append(button("Edit context", options.editContext));
      }
      const visible = `${summary ? "summary" : selectedId}:${editing ? "fix" : "card"}`;
      if (visible !== lastVisible) {
        const card = root.querySelector<HTMLElement>("article:not([hidden]), .deck-summary");
        if (lastVisible && card?.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) card.animate([{ opacity: .35 }, { opacity: 1 }], { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)' });
        lastVisible = visible;
      }
      if (!summary && !editing) fitCard();
      if (app && before && (summary || editing)) { const after = trayGeometry(app); if (Math.abs(after.panel - before.panel) > 1) transitionTray(app, before, after); }
    }
  }
  const stop = client.onUpdate(reviews.get, identity, (view: View | null) => {
    if (!view || (current && view.revision < current.revision)) return;
    const previous = current; current = view;
    if (deck && !previous) summary = view.accepted || view.cards.every(c => view.decisions[c.groupId] !== "pending");
    if (deck && previous && view.cards.some(c => view.decisions[c.groupId] === "pending" && previous.decisions[c.groupId] !== "pending")) { summary = false; selectedId = view.cards.find(c => view.decisions[c.groupId] === "pending")!.groupId; }
    if (view.last?.state === "complete" && previous?.pending?.id === view.last.id) editing = null;
    if (!previous && view.pending && view.last) editing = { cardId: view.last.cardId, kind: view.last.kind, queryIds: view.last.queryIds, targetCardId: view.last.targetCardId, note: view.last.note, requestId: randomId() };
    draw();
  }, () => { error = "The review connection was interrupted. Your saved cards are still here. Reload to reconnect."; draw(); });
  // Refit presentation only. The saved labels, needs, queries and sources stay intact.
  function fitCard() {
    if (!deck || summary || editing || !current) return;
    const article = cardNodes.get(selectedId)?.article;
    const card = current.cards.find(c => c.groupId === selectedId);
    if (!article || !card || !article.clientHeight) return;
    const title = article.querySelector<HTMLElement>('h3')!, need = article.querySelector<HTMLElement>('.cluster-need')!;
    const searches = article.querySelector<HTMLElement>('.cluster-searches')!;
    const label = article.querySelector<HTMLElement>('.cluster-label')!;
    const evidence = article.querySelector<HTMLButtonElement>('[data-action=evidence]')!;
    title.textContent = card.label; need.textContent = card.need;
    const rows = [...searches.children] as HTMLElement[];
    rows.forEach(row => row.hidden = false); searches.hidden = false; label.hidden = false;
    // Reserve room for decisions and two readable lines of both title and need.
    const short = article.clientHeight < 460;
    const titleLimit = short ? 52 : 78, needLimit = short ? 48 : 72;
    function excerpt(node: HTMLElement, full: string, height: number) {
      node.textContent = full;
      if (node.getBoundingClientRect().height <= height + 1) return false;
      let low = 0, high = full.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2); node.textContent = full.slice(0, mid).trimEnd() + '…';
        if (node.getBoundingClientRect().height <= height + 1) low = mid; else high = mid - 1;
      }
      const prefix = full.slice(0, low); const boundary = prefix.lastIndexOf(' ');
      node.textContent = prefix.slice(0, boundary > low * .65 ? boundary : low).trimEnd() + '…';
      return true;
    }
    excerpt(title, card.label, titleLimit);
    excerpt(need, card.need, needLimit);
    if (short && rows[2]) rows[2].hidden = true;
    // Supporting searches yield before readable text or decision controls do.
    const overflowing = () => {
      const actions = article.querySelector<HTMLElement>(':scope > .review-actions');
      const padding = parseFloat(window.getComputedStyle(article).paddingBottom) + 1;
      return article.scrollHeight > article.clientHeight + 1 || !!actions && actions.getBoundingClientRect().bottom > article.getBoundingClientRect().bottom - padding + .5;
    };
    if (overflowing() && rows[2]) rows[2].hidden = true;
    if (overflowing()) { searches.hidden = true; label.hidden = true; }
    const spare = () => Math.max(0, article.querySelector<HTMLElement>('.cluster-tools')!.getBoundingClientRect().top - (searches.hidden ? need : searches).getBoundingClientRect().bottom - 8);
    // Use remaining room for the full title first, then more of the customer need.
    const abbreviated = excerpt(title, card.label, title.getBoundingClientRect().height + spare());
    const needAbbreviated = excerpt(need, card.need, need.getBoundingClientRect().height + spare());
    evidence.textContent = abbreviated || needAbbreviated ? 'Full cluster & all searches' : 'View all searches';
    evidence.setAttribute('aria-label', abbreviated || needAbbreviated ? 'Read full cluster and view all searches' : 'View all searches');
  }
  const resize = () => fitCard();
  if (deck) { window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize); }
  return () => { alive = false; if (deck) { window.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('resize', resize); } evidenceDialog?.remove(); stop(); };
}
