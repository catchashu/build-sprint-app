import test from "node:test";
import assert from "node:assert/strict";
import { readReview, decide, correctMeaning, acceptedUnderstanding, groupingInput, correctGrouping } from "../shared/cardReview.ts";
const cards = JSON.stringify(["beds", "tables"].map(groupId => ({ groupId, label: groupId, need: "Original meaning", queries: [{ id: groupId, query: `Observed ${groupId} query`, volume: null, sources: [{ reference: "https://serpapi.com/searches/real.json", retrievedAt: "2026-10-11", field: "related_searches.query", provider: "SerpAPI" }] }] })));
test("approval and exclusion carry into saved understanding without changing original evidence", () => {
  const original = readReview(cards);
  assert.throws(() => acceptedUnderstanding(original, "Offering", ""));
  const reviewed = decide(decide(original, "beds", "correct"), "tables", "excluded");
  const result = acceptedUnderstanding(reviewed, "Offering", "");
  assert.deepEqual(result.cards.map(c => c.groupId), ["beds"]);
  assert.deepEqual(result.excludedGroupIds, ["tables"]);
  assert.equal(original.decisions.tables, "pending");
  assert.equal(result.corrections[0].kind, "exclude");
  assert.throws(() => acceptedUnderstanding(decide(reviewed, "beds", "excluded"), "Offering", ""));
});
test("written correction changes meaning, preserves sources and unaffected approvals, and requires review again", () => {
  const original = decide(decide(readReview(cards), "beds", "correct"), "tables", "correct");
  const updated = correctMeaning(original, "beds", "label", "Use hospital beds", { outcome: "updated", label: "Hospital beds", need: "Beds for hospital procurement", explanation: "Meaning corrected" });
  assert.equal(updated.cards[0].label, "Hospital beds");
  assert.deepEqual(updated.cards[0].queries, original.cards[0].queries);
  assert.equal(updated.decisions.beds, "pending"); assert.equal(updated.decisions.tables, "correct");
  assert.equal(original.cards[0].label, "beds");
  assert.throws(() => acceptedUnderstanding(updated, "Offering", ""));
  assert.equal(acceptedUnderstanding(decide(updated, "beds", "correct"), "Offering", "").corrections[0].text, "Use hospital beds");
});
test("unsupported correction and invented card or query edits leave original cards intact", () => {
  const original = readReview(cards), frozen = JSON.stringify(original);
  assert.throws(() => decide(original, "invented", "correct"));
  assert.throws(() => correctMeaning(original, "beds", "other", "Merge", { outcome: "needs_clarification", label: "beds", need: "Original", explanation: "Choose a meaning correction; merging comes later." }));
  assert.throws(() => correctMeaning(original, "beds", "other", "Change", { outcome: "updated", label: "New", need: "New", explanation: "New", queries: ["invented"] }));
  assert.equal(JSON.stringify(original), frozen);
});

const splitReview = () => { const r = decide(readReview(cards), "tables", "correct"); r.cards[0].queries.push({ ...r.cards[0].queries[0], id: "extra", query: "Different observed need" }); return r; };
const group = (queryIds: string[]) => ({ label: "Revised", need: "Revised need", queryIds });
test("split preserves every source and unaffected approval, resets changed cards and rejects invalid selections", () => {
  const r = splitReview(), selection = { queryIds: ["extra"] };
  const updated = correctGrouping(r, "beds", "split", selection, { outcome: "updated", explanation: "Different needs", groups: [group(["beds"]), group(["extra"])] });
  assert.equal(updated.cards.length, 3); assert.equal(updated.decisions.tables, "correct");
  assert.equal(updated.decisions.beds, "pending"); assert.equal(updated.decisions[updated.cards[1].groupId], "pending");
  assert.deepEqual(updated.cards.slice(0, 2).flatMap(c => c.queries), r.cards[0].queries);
  for (const queryIds of [[], ["fake"], ["extra", "extra"], ["beds", "extra"]]) assert.throws(() => groupingInput(r, "beds", "split", { queryIds }));
  for (const groups of [[group(["beds", "extra"])], [group(["beds"]), group(["fake"])], [group(["beds"]), group(["beds"])], [group(["beds"])]]) assert.throws(() => correctGrouping(r, "beds", "split", selection, { outcome: "updated", explanation: "Bad", groups }));
});
test("merge preserves both evidence sets, records target and requires approval again", () => {
  const r = decide(decide(readReview(cards), "beds", "correct"), "tables", "correct"); r.accepted = true;
  const updated = correctGrouping(r, "beds", "merge", { targetCardId: "tables" }, { outcome: "updated", explanation: "Same need", groups: [group(["beds", "tables"])] });
  assert.equal(updated.cards.length, 1); assert.equal(updated.accepted, false); assert.equal(updated.decisions.beds, "pending"); assert.equal(updated.decisions.tables, undefined);
  assert.deepEqual(updated.cards[0].queries, r.cards.flatMap(c => c.queries)); assert.match(updated.notes[0].text, /tables/);
  for (const targetCardId of ["beds", "fake", ""]) assert.throws(() => groupingInput(r, "beds", "merge", { targetCardId }));
  assert.throws(() => groupingInput(decide(r, "tables", "excluded"), "beds", "merge", { targetCardId: "tables" }));
  assert.throws(() => acceptedUnderstanding(updated, "Offering", ""));
});
