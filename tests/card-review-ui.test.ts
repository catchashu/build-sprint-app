import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import type { ConvexClient } from "convex/browser";
import type { Id } from "../convex/_generated/dataModel";
import { mountReview } from "../src/cardReview.ts";

function setup(onContinue = () => {}) {
  const window = new Window();
  Object.assign(globalThis, { window, document: window.document, Option: function(text = "", value = "") { const option = window.document.createElement("option"); option.text = text; option.value = value; return option; } });
  const root = window.document.createElement("div"); window.document.body.append(root);
  const view = { revision: 0, accepted: false, notes: [], pending: null, last: null,
    decisions: { a: "pending", b: "pending", c: "pending" } as Record<string, string>,
    cards: ["a", "b", "c"].map(groupId => ({ groupId, label: `Card ${groupId}`, need: `Need ${groupId}`, queries: [{ id: `q-${groupId}`, query: `Search ${groupId}`, volume: null, sources: [{ provider: "Test", reference: "https://example.com/evidence", field: "related_searches.query", retrievedAt: "2026-10-12" }] }] })) };
  let emit: (value: typeof view) => void = () => {}, resolve: () => void = () => {}, reject: (error: Error) => void = () => {};
  const calls: { cardId: string; revision: number }[] = [];
  const client = {
    onUpdate: (_api: unknown, _identity: unknown, callback: typeof emit) => { emit = callback; callback(structuredClone(view)); return () => {}; },
    mutation: (_api: unknown, args: { cardId: string; revision: number }) => { calls.push(args); return new Promise<void>((yes, no) => { resolve = yes; reject = no; }); },
  };
  const stop = mountReview(client as unknown as ConvexClient, { id: "test-run" as Id<"firstValueRuns">, token: "test-only" }, root as unknown as HTMLElement, onContinue);
  return { window, root: root as unknown as HTMLElement, calls, view, emit: () => emit(structuredClone(view)), resolve: () => resolve(), reject: () => reject(new Error("Offline")), close: () => { stop(); window.happyDOM.abort(); } };
}
const settled = () => new Promise<void>(resolve => setImmediate(resolve));

test("marking a later card shows Saving immediately and preserves the list, position and open sources", async () => {
  const s = setup();
  try {
    const list = s.root.querySelector<HTMLElement>(".cards")!;
    const articles = [...list.querySelectorAll("article")];
    const source = articles[2].querySelector("details")!; source.open = true;
    list.scrollTop = 620;
    const correct = [...articles[2].querySelectorAll("button")].find(b => b.textContent === "Correct")!;
    correct.focus(); correct.click();
    assert.match(articles[2].textContent ?? "", /Saving/);
    assert.doesNotMatch(articles[2].textContent ?? "", /Marked correct/);
    assert.ok(s.root.querySelector(".cards") === list, "The scrolling list must stay mounted"); assert.equal(list.scrollTop, 620);
    assert.ok(list.querySelectorAll("article")[0] === articles[0], "Unchanged card must stay mounted"); assert.ok(list.querySelectorAll("article")[2] === articles[2], "Saved card must stay mounted");
    assert.equal(source.open, true); assert.equal(correct.disabled, true);
    correct.click(); assert.equal(s.calls.length, 1);
    s.view.decisions.c = "correct"; s.view.revision = 1; s.emit(); s.resolve(); await settled();
    assert.match(articles[2].textContent ?? "", /Marked correct/);
    assert.ok(s.root.querySelector(".cards") === list, "The scrolling list must stay mounted"); assert.equal(list.scrollTop, 620);
    assert.ok(articles[2].querySelector("details") === source, "Open source must stay mounted"); assert.equal(source.open, true);
    assert.equal(correct.disabled, true, "Already correct cards should not issue repeat saves");
    const nextCorrect = [...articles[1].querySelectorAll("button")].find(b => b.textContent === "Correct")!;
    nextCorrect.click(); assert.equal(s.calls[1].revision, 1); s.resolve(); await settled();
  } finally { s.close(); }
});

test("a failed Correct save keeps the same card visible and allows retry without claiming success", async () => {
  const s = setup();
  try {
    const list = s.root.querySelector<HTMLElement>(".cards")!; list.scrollTop = 500;
    const card = list.querySelectorAll("article")[1];
    const correct = [...card.querySelectorAll("button")].find(b => b.textContent === "Correct")!;
    correct.click(); s.reject(); await settled();
    assert.ok(s.root.querySelector(".cards") === list, "The scrolling list must stay mounted"); assert.equal(list.scrollTop, 500);
    assert.doesNotMatch(card.textContent ?? "", /Marked correct|Saving/);
    assert.equal(correct.disabled, false); assert.match(s.root.textContent ?? "", /couldn’t save/);
    correct.click(); assert.equal(s.calls.length, 2); s.resolve(); await settled();
  } finally { s.close(); }
});

test("correction form validation and Cancel still work with a persistent list", () => {
  const s = setup();
  try {
    const list = s.root.querySelector<HTMLElement>(".cards")!; list.scrollTop = 500;
    const first = list.querySelectorAll("article")[0];
    const fix = [...list.querySelectorAll("article")[1].querySelectorAll("button")].find(b => b.textContent === "Fix this")!; fix.click();
    const select = s.root.querySelector("select")!; select.value = "label"; select.dispatchEvent(new s.window.Event("change") as unknown as Event);
    const apply = [...s.root.querySelectorAll("button")].find(b => b.textContent === "Apply fix")!;
    assert.equal(apply.disabled, true);
    const note = s.root.querySelector("textarea")!; note.value = "Corrected meaning"; note.dispatchEvent(new s.window.Event("input") as unknown as Event);
    assert.equal(apply.disabled, false);
    const cancel = [...s.root.querySelectorAll("button")].find(b => b.textContent === "Cancel")!; cancel.click();
    assert.equal(s.root.querySelector("textarea"), null); assert.ok(s.root.querySelector(".cards") === list);
    assert.equal(list.scrollTop, 500); assert.ok(list.querySelectorAll("article")[0] === first); assert.equal(s.calls.length, 0);
  } finally { s.close(); }
});


test("one correct card can Continue and still offers Continue after reopening a saved review", async () => {
  let continued = 0;
  const s = setup(() => { continued++; });
  try {
    s.view.cards = s.view.cards.slice(0, 1);
    s.view.decisions = { a: "correct" }; s.view.revision = 1; s.emit();
    const next = [...s.root.querySelectorAll("button")].find(b => b.textContent === "Continue")!;
    assert.ok(next); assert.equal(next.disabled, false);
    next.click(); s.resolve(); await settled(); assert.equal(continued, 1);
    s.view.accepted = true; s.view.revision = 2; s.emit();
    const reopened = [...s.root.querySelectorAll("button")].find(b => b.textContent === "Continue")!;
    assert.ok(reopened); reopened.click(); assert.equal(continued, 2);
  } finally { s.close(); }
});
