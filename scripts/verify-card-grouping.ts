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
writeFileSync("artifacts/m3-part2-live-receipt.json", JSON.stringify({ id, token }));
console.log("LIVE SERVER TEST: https://ardent-fly-778.convex.site/");
console.log("Evidence: replay of saved real production search results in a separate test run; no new searches.");
const identity = { id, token };

let review = (await client.query(api.cardReview.get, identity))!;
const first = review.cards.find(c => c.queries.length > 1)!;
const originalEvidence = review.cards.flatMap(c => c.queries).sort((a,b) => a.id.localeCompare(b.id));
const unaffected = review.cards.find(c => c.groupId !== first.groupId)!;
await client.mutation(api.cardReview.decision, { ...identity, revision: review.revision, cardId: unaffected.groupId, decision: "correct" });
async function correction(kind: "split" | "merge", selection: { queryIds?: string[]; targetCardId?: string }) {
  review = (await client.query(api.cardReview.get, identity))!;
  const args = { ...identity, revision: review.revision, cardId: first.groupId, kind, ...selection, note: "", requestId: crypto.randomUUID() };
  const jobId = await client.mutation(api.cardReview.apply, args);
  assert.equal(await client.mutation(api.cardReview.apply, args), jobId);
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await client.query(api.cardReview.result, { ...identity, jobId });
    if (result?.state === "complete") { review = (await client.query(api.cardReview.get, identity))!; return; }
    if (result?.state === "failed") throw new Error(result.error ?? "Correction failed");
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw new Error("Correction timed out");
}
await correction("split", { queryIds: [first.queries[0].id] });
assert.ok(review.cards.length > JSON.parse(original.cards).length);
assert.equal(review.decisions[unaffected.groupId], "correct");
assert.deepEqual(review.cards.flatMap(c => c.queries).sort((a,b) => a.id.localeCompare(b.id)), originalEvidence);
console.log("PASS: real AI split persisted, every source preserved, unaffected approval retained.");
const splitCard = review.cards.find(c => c.groupId.startsWith(first.groupId + "-r"))!;
await correction("merge", { targetCardId: splitCard.groupId });
assert.equal(review.decisions[first.groupId], "pending");
assert.equal(review.decisions[unaffected.groupId], "correct");
assert.deepEqual(review.cards.flatMap(c => c.queries).sort((a,b) => a.id.localeCompare(b.id)), originalEvidence);
console.log("PASS: real AI merge persisted and requires review again; every source preserved.");
for (const card of review.cards) {
  await client.mutation(api.cardReview.decision, { ...identity, revision: review.revision, cardId: card.groupId, decision: "correct" });
  review = (await client.query(api.cardReview.get, identity))!;
}
await client.mutation(api.cardReview.accept, { ...identity, revision: review.revision });
const saved = admin("firstValue:read", { id });
assert.equal(saved.cards, original.cards); assert.equal(saved.searchCount, 0);
const understanding = JSON.parse(saved.understandingJson);
assert.ok(understanding.corrections.some((n: {kind:string}) => n.kind === "split"));
assert.ok(understanding.corrections.some((n: {kind:string}) => n.kind === "merge"));
console.log("PASS: Continue saves both corrections; original evidence unchanged; no new searches.");
console.log("NOT RUN: browser interactions; no connected browser.");
