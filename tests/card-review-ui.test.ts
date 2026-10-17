import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import type { ConvexClient } from "convex/browser";
import type { Id } from "../convex/_generated/dataModel";
import { mountReview } from "../src/cardReview.ts";

function setup(onContinue = () => {}, deck = false) {
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
  const stop = mountReview(client as unknown as ConvexClient, { id: "test-run" as Id<"firstValueRuns">, token: "test-only" }, root as unknown as HTMLElement, onContinue, { deck });
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

test("deck saves before advancing, retries failures, revisits decisions and summarizes before Continue", async () => {
  let continued = 0;
  const s = setup(() => continued++, true);
  const visible = () => s.root.querySelector<HTMLElement>('article:not([hidden])')!;
  const click = (text: string, within: ParentNode = s.root) => [...within.querySelectorAll('button')].find(b => b.textContent?.endsWith(text))!.click();
  try {
    assert.equal(s.root.querySelectorAll('article:not([hidden])').length, 1);
    assert.match(s.root.querySelector('.deck-navigation')!.textContent!, /Cluster 1 of 3/);
    click('Accept', visible());
    assert.equal(visible().dataset.cardId, 'a'); assert.match(visible().textContent!, /Saving/);
    s.reject(); await settled();
    assert.equal(visible().dataset.cardId, 'a'); assert.match(visible().textContent!, /save that change/);
    click('Accept', visible()); s.resolve(); await settled();
    assert.equal(visible().dataset.cardId, 'b');
    click('Reject', visible()); s.resolve(); await settled();
    assert.equal(visible().dataset.cardId, 'c');
    click('Previous'); assert.equal(visible().dataset.cardId, 'b'); assert.match(visible().textContent!, /Rejected/);
    click('Accept', visible()); s.resolve(); await settled();
    assert.equal(visible().dataset.cardId, 'c');
    click('Reject', visible()); s.resolve(); await settled();
    assert.equal(s.root.dataset.reviewView, 'summary');
    assert.match(s.root.querySelector('.deck-summary')!.textContent!, /2 accepted .* 1 rejected .* 0 to review/);
    assert.equal(continued, 0);
    click('Continue'); s.resolve(); await settled(); assert.equal(continued, 1);
  } finally { s.close(); }
});

test("deck correction keeps selections, split requires a remaining query, merge has one target, Cancel preserves decisions", () => {
  const s = setup(() => {}, true);
  const click = (text: string) => [...s.root.querySelectorAll<HTMLButtonElement>('article:not([hidden]) button')].find(b => b.textContent?.endsWith(text))!.click();
  try {
    s.view.cards[0].queries.push({ ...s.view.cards[0].queries[0], id: 'second', query: 'Another search' }); s.emit();
    click('Fix this');
    const choose = (kind: string) => { const select = s.root.querySelector('select')!; select.value = kind; select.dispatchEvent(new s.window.Event('change') as unknown as Event); };
    choose('split');
    const inputs = [...s.root.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    inputs[0].click();
    let apply = [...s.root.querySelectorAll('button')].find(b => b.textContent === 'Apply fix')!;
    assert.equal(apply.disabled, false); inputs[1].click(); assert.equal(apply.disabled, true);
    choose('merge');
    assert.equal(s.root.querySelectorAll('input[type=radio]').length, 2);
    (s.root.querySelector('input[type=radio]') as HTMLInputElement).click();
    apply = [...s.root.querySelectorAll('button')].find(b => b.textContent === 'Apply fix')!; assert.equal(apply.disabled, false);
    click('Cancel'); assert.equal(s.root.querySelector('select'), null); assert.equal(s.calls.length, 0);
  } finally { s.close(); }
});

test("deck returns corrected and newly split clusters to review and cannot continue after rejecting all", async () => {
  const s = setup(() => {}, true);
  try {
    s.view.decisions = { a: 'excluded', b: 'excluded', c: 'excluded' }; s.view.revision++; s.emit();
    [...s.root.querySelectorAll('button')].find(b => b.textContent === 'Review decisions')!.click();
    assert.equal([...s.root.querySelectorAll('button')].some(b => b.textContent === 'Continue'), false);
    s.view.decisions.a = 'pending'; s.view.revision++; s.emit();
    assert.equal(s.root.dataset.reviewView, 'card'); assert.equal(s.root.querySelector<HTMLElement>('article:not([hidden])')!.dataset.cardId, 'a');
  } finally { s.close(); }
});

test('initial results callback waits for nonempty mounted cards and cannot break review',()=>{
 const window=new Window();Object.assign(globalThis,{window,document:window.document});
 const root=window.document.createElement('div');window.document.body.append(root);
 let emit:(view:any)=>void=()=>{};let displayed=0;
 const client={onUpdate:(_api:unknown,_id:unknown,cb:typeof emit)=>{emit=cb;return()=>{};}};
 const stop=mountReview(client as unknown as ConvexClient,{id:'test' as Id<'firstValueRuns'>,token:'private'},root as unknown as HTMLElement,()=>{}, {displayed(){assert.ok(root.querySelector('article'));displayed++;throw Error('analytics failure');}});
 try{
  emit(null);assert.equal(displayed,0);
  const view={revision:0,accepted:false,notes:[],pending:null,last:null,decisions:{a:'pending'},cards:[{groupId:'a',label:'Safe test',need:'Test',queries:[]}]};
  emit(view);assert.equal(displayed,1);assert.match(root.textContent,/Safe test/);
 }finally{stop();window.happyDOM.abort();}
});
