import type { ConvexClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import type { Review, Card } from "../shared/cardReview";
type View = Review & { pending: { cardId: string; id: Id<"cardCorrections"> } | null; last: { id: Id<"cardCorrections">; cardId: string; kind: "label" | "other"; note: string; state: string; error: string | null } | null };
const element = <K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = "") => { const e = document.createElement(tag); e.textContent = text; e.className = cls; return e; };
const labels = { excluded: "This isn’t part of what I offer", label: "The label / meaning is wrong", other: "Something else" };
export function mountReview(client: ConvexClient, identity: { id: Id<"firstValueRuns">; token: string }, root: HTMLElement) {
  let current: View | null = null;
  let editing: { cardId: string; kind: keyof typeof labels | ""; note: string; requestId: string } | null = null;
  let busy = false, error = "", dismissedJob = "", alive = true;
  const button = (text: string, fn: () => void, primary = false) => { const b = element("button", text, primary ? "primary" : "secondary"); b.type = "button"; b.disabled = busy || !!current?.pending; b.onclick = fn; return b; };
  async function perform(fn: () => Promise<void>) {
    if (busy || current?.pending) return;
    busy = true; error = ""; draw();
    try { await fn(); }
    catch (cause) { const data = cause && typeof cause === "object" && "data" in cause ? cause.data : null; error = typeof data === "string" ? data : "I couldn’t save that change. Your original card is still here. Try again."; }
    finally { busy = false; if (alive) draw(); }
  }
  function sourceList(card: Card) {
    const list = element("ul");
    for (const query of card.queries) {
      const item = element("li", query.query), detail = element("details"); detail.append(element("summary", "Source"));
      for (const source of query.sources) {
        const a = element("a", `${source.field === "related_questions.question" ? "Google question" : "Google related search"} · ${source.retrievedAt}`);
        a.href = source.reference; a.target = "_blank"; a.rel = "noopener noreferrer"; detail.append(a);
      }
      item.append(detail); list.append(item);
    }
    return list;
  }
  function draw() {
    if (!current) return;
    root.replaceChildren();
    const cardList = element("div", "", "cards");
    root.append(cardList);
    for (const card of current.cards) {
      const decision = current.decisions[card.groupId], article = element("article");
      article.append(element("h3", card.label), element("p", card.need));
      if (decision === "excluded") {
        article.append(element("p", "Excluded from your offering", "muted"));
        cardList.append(article); continue;
      }
      article.append(sourceList(card), element("p", "Sourced from live Google search evidence · India", "small muted"));
      const actions = element("div", "", "review-actions");
      if (decision === "correct") article.append(element("p", "Marked correct", "small"));
      actions.append(button("Correct", () => void perform(async () => { await client.mutation(api.cardReview.decision, { ...identity, revision: current!.revision, cardId: card.groupId, decision: "correct" }); })));
      actions.append(button("Fix this", () => { editing = { cardId: card.groupId, kind: "", note: "", requestId: crypto.randomUUID() }; error = ""; draw(); root.querySelector<HTMLElement>(".correction-title")?.focus(); }));
      article.append(actions);
      if (current.pending?.cardId === card.groupId) { const p = element("p", "Updating this with your correction…"); p.setAttribute("role", "status"); article.append(p); }
      else if (current.last?.cardId === card.groupId && current.last.state === "complete" && decision === "pending") article.append(element("p", "Updated. Check this again."));
      if (editing?.cardId === card.groupId) {
        const form = element("form", "", "correction-form"), title = element("h4", "What should I fix about this?", "correction-title"); title.tabIndex = -1; form.append(title);
        const selectLabel = element("label", "Choose what needs fixing."), select = element("select");
        select.append(new Option("Choose a reason", ""));
        for (const [value, label] of Object.entries(labels)) select.append(new Option(label, value));
        select.value = editing.kind; select.disabled = busy || !!current.pending;
        select.onchange = () => { editing!.kind = select.value as keyof typeof labels; editing!.requestId = crypto.randomUUID(); error = ""; draw(); root.querySelector<HTMLTextAreaElement>(".correction-form textarea")?.focus(); };
        selectLabel.append(select); form.append(selectLabel);
        let input: HTMLTextAreaElement | undefined;
        if (editing.kind === "excluded") form.append(element("p", "I’ll exclude this from my understanding of your offering."));
        else if (editing.kind) {
          const label = element("label", editing.kind === "label" ? "Tell me what I should understand instead." : "Tell me what needs changing.");
          input = element("textarea"); input.value = editing.note; input.maxLength = 2000; input.disabled = busy || !!current.pending;
          label.append(input); form.append(label);
        }
        const apply = button("Apply fix", () => {}, true); apply.type = "submit";
        const valid = () => !!editing?.kind && (editing.kind === "excluded" || !!editing.note.trim());
        apply.disabled = busy || !!current.pending || !valid();
        if (input) input.oninput = () => { editing!.note = input!.value; editing!.requestId = crypto.randomUUID(); apply.disabled = !valid(); };
        form.onsubmit = event => { event.preventDefault(); if (!valid()) return; const draft = { ...editing! }; void perform(async () => {
          if (draft.kind === "excluded") { await client.mutation(api.cardReview.decision, { ...identity, revision: current!.revision, cardId: draft.cardId, decision: "excluded" }); editing = null; }
          else { await client.mutation(api.cardReview.apply, { ...identity, revision: current!.revision, cardId: draft.cardId, kind: draft.kind as "label" | "other", note: draft.note, requestId: draft.requestId }); }
        }); };
        const buttons = element("div", "", "review-actions"); buttons.append(button("Cancel", () => { dismissedJob = current?.last?.id ?? ""; editing = null; error = ""; draw(); }), apply); form.append(buttons); article.append(form);
      }
      cardList.append(article);
    }
    if (error) { const p = element("p", error, "error review-wide"); p.setAttribute("role", "alert"); root.append(p); }
    if (current.last?.state === "failed" && current.last.id !== dismissedJob && !current.pending) {
      const p = element("p", `I couldn’t apply that change. Your original card is still here. ${current.last.error ?? ""}`, "error review-wide"); p.setAttribute("role", "alert"); root.append(p);
      root.append(button("Try again", () => { const last = current!.last!; editing = { cardId: last.cardId, kind: last.kind, note: last.note, requestId: crypto.randomUUID() }; dismissedJob = last.id; draw(); }));
    }
    const active = current.cards.filter(c => current!.decisions[c.groupId] !== "excluded");
    const allCorrect = active.length > 0 && active.every(c => current!.decisions[c.groupId] === "correct");
    if (!active.length) root.append(element("p", "All cards are excluded. Edit your context to research the offering you want to cover.", "review-wide"));
    else if (current.accepted) {
      const saved = element("div", "", "review-footer"); saved.setAttribute("role", "status");
      saved.append(element("h3", "Your review is saved."), element("p", "You’ve finished the review. This is the end of the current version; full research and website planning aren’t available yet."));
      root.append(saved);
    }
    else {
      const next = button("Continue", () => void perform(async () => { await client.mutation(api.cardReview.accept, { ...identity, revision: current!.revision }); }), true);
      next.disabled = next.disabled || !allCorrect || !!editing;
      const footer = element("div", "", "review-footer"); footer.append(element("p", allCorrect ? "Your cards are ready to confirm." : "Mark each remaining card Correct before continuing.", "small muted"), next); root.append(footer);
    }
    root.append(element("p", "This first view uses Google suggestions and questions localized to India. It does not measure search volume.", "small muted review-wide"));
  }
  const stop = client.onUpdate(api.cardReview.get, identity, (view: View | null) => {
    if (!view) return;
    const previous = current; current = view;
    if (view.last?.state === "complete" && previous?.pending?.id === view.last.id) editing = null;
    if (!previous && view.pending && view.last) editing = { cardId: view.last.cardId, kind: view.last.kind, note: view.last.note, requestId: crypto.randomUUID() };
    draw();
  }, () => { error = "The review connection was interrupted. Your saved cards are still here. Reload to reconnect."; draw(); });
  return () => { alive = false; stop(); };
}
