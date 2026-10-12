import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

// Explicit production verification. Replays real, saved search evidence into a
// separate test run, never modifies a user's run and never substitutes evidence.
const client = new ConvexHttpClient("https://ardent-fly-778.convex.cloud");
function admin(name: string, args: object) {
  const result = spawnSync(process.execPath, ["node_modules/convex/bin/main.js", "run", name, JSON.stringify(args), "--prod"], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Admin verification setup failed: ${name}`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
const original = admin("firstValue:read", { id: "jd74aezpsqhj5acp02bacpn3b98g2k8x" });
const token = crypto.randomUUID();
const id = await client.mutation(api.firstValue.create, { offering: original.offering, context: original.context, token });
admin("firstValue:save", { id, state: "complete", cards: original.cards });
writeFileSync("artifacts/m3-part1-live-receipt.json", JSON.stringify({ id, token }));
console.log("LIVE SERVER TEST: https://ardent-fly-778.convex.site/");
console.log("Evidence: replay of saved real production search results in a separate test run; no new searches.");
const identity = { id, token };
let review = (await client.query(api.cardReview.get, identity))!;
const [beds, tables, trolleys] = review.cards;
await assert.rejects(client.mutation(api.cardReview.accept, { ...identity, revision: review.revision }));
console.log("PASS: Continue rejects unreviewed cards.");
await client.mutation(api.cardReview.decision, { ...identity, revision: review.revision, cardId: beds.groupId, decision: "correct" });
review = (await client.query(api.cardReview.get, identity))!;
assert.equal(review.decisions[beds.groupId], "correct");
console.log("PASS: Correct is saved and returned on a fresh read.");
await client.mutation(api.cardReview.decision, { ...identity, revision: review.revision, cardId: trolleys.groupId, decision: "excluded" });
review = (await client.query(api.cardReview.get, identity))!;
assert.equal(review.decisions[trolleys.groupId], "excluded");
console.log("PASS: Exclude is saved without deleting original evidence.");
async function correction(cardId: string, kind: "label" | "other", note: string) {
  review = (await client.query(api.cardReview.get, identity))!;
  const args = { ...identity, revision: review.revision, cardId, kind, note, requestId: crypto.randomUUID() };
  const jobId: Id<"cardCorrections"> = await client.mutation(api.cardReview.apply, args);
  assert.equal(await client.mutation(api.cardReview.apply, args), jobId);
  for (let attempt = 0; attempt < 60; attempt++) {
    const result = await client.query(api.cardReview.result, { ...identity, jobId });
    if (result?.state === "complete") { review = (await client.query(api.cardReview.get, identity))!; return; }
    if (result?.state === "failed") throw new Error(result.error ?? "Correction failed");
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error("Correction did not finish within three minutes.");
}
await correction(tables.groupId, "label", "Use the label Clinical examination tables. This means examination tables used by clinics and hospitals, not imaging scanner tables.");
assert.notEqual(review.cards.find(c => c.groupId === tables.groupId)!.label, tables.label);
assert.deepEqual(review.cards.find(c => c.groupId === tables.groupId)!.queries, tables.queries);
assert.equal(review.decisions[beds.groupId], "correct");
assert.equal(review.decisions[tables.groupId], "pending");
console.log("PASS: Wrong-label correction changes the card, preserves queries and other approvals, and requires review again.");
await correction(beds.groupId, "other", "Clarify that this need is procurement by hospital purchasing teams; we do not provide home-care rental services.");
assert.notEqual(review.cards.find(c => c.groupId === beds.groupId)!.need, beds.need);
assert.deepEqual(review.cards.find(c => c.groupId === beds.groupId)!.queries, beds.queries);
assert.equal(review.decisions[beds.groupId], "pending");
console.log("PASS: Another written correction changes the meaning and preserves real source queries.");
for (const card of review.cards.filter(c => review.decisions[c.groupId] !== "excluded")) {
  await client.mutation(api.cardReview.decision, { ...identity, revision: review.revision, cardId: card.groupId, decision: "correct" });
  review = (await client.query(api.cardReview.get, identity))!;
}
await client.mutation(api.cardReview.accept, { ...identity, revision: review.revision });
const saved = admin("firstValue:read", { id });
assert.equal(saved.searchCount, 0); assert.equal(saved.cards, original.cards);
const understanding = JSON.parse(saved.understandingJson);
assert.equal(understanding.cards.length, 2); assert.deepEqual(understanding.excludedGroupIds, [trolleys.groupId]);
assert.ok(understanding.corrections.some((c: { kind: string }) => c.kind === "label"));
assert.ok(understanding.corrections.some((c: { kind: string }) => c.kind === "other"));
assert.equal((await client.query(api.cardReview.get, identity))!.accepted, true);
console.log("PASS: Continue saves corrected understanding, exclusions and notes for this run.");
console.log("PASS: Original cards unchanged; additional searches used: 0.");
writeFileSync("artifacts/m3-part1-live-understanding.json", JSON.stringify(understanding, null, 2));
const page = await fetch("https://ardent-fly-778.convex.site/"); assert.equal(page.status, 200);
console.log("PASS: Live page returns HTTP 200.");
console.log("NOT RUN: phone browser interactions - no browser connected.");
console.log("NOT RUN: desktop browser interactions - no browser connected.");
