import test from "node:test";
import assert from "node:assert/strict";
import { readReview, decide, correctMeaning, acceptedUnderstanding } from "../shared/cardReview.ts";
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
