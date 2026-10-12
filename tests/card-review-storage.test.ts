import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema.ts";
import { api, internal } from "../convex/_generated/api.js";
const modules = { "../convex/_generated/server.js": () => import("../convex/_generated/server.js"), "../convex/cardReview.ts": () => import("../convex/cardReview.ts") };
async function setup() {
  const t = convexTest(schema, modules), token = "test-review-capability-more-than-32-characters";
  const cards = JSON.stringify(["a", "b"].map(groupId => ({ groupId, label: groupId, need: "Original", queries: [{ id: groupId, query: "Original observed query", volume: null, sources: [] }] })));
  const id = await t.run(ctx => ctx.db.insert("firstValueRuns", { token, offering: "Test offering", context: "", state: "complete", searchCount: 3, searches: [], responses: [], batches: [], cards }));
  return { t, id, token, cards };
}
test("server approvals and exclusions persist; Continue enforces review and preserves original cards/search count", async () => {
  const { t, id, token, cards } = await setup();
  await assert.rejects(() => t.mutation(api.cardReview.accept, { id, token, revision: 0 }));
  await assert.rejects(() => t.mutation(api.cardReview.decision, { id, token: "wrong", revision: 0, cardId: "a", decision: "correct" }));
  await t.mutation(api.cardReview.decision, { id, token, revision: 0, cardId: "a", decision: "correct" });
  await assert.rejects(() => t.mutation(api.cardReview.decision, { id, token, revision: 0, cardId: "b", decision: "excluded" }));
  await t.mutation(api.cardReview.decision, { id, token, revision: 1, cardId: "b", decision: "excluded" });
  await t.mutation(api.cardReview.accept, { id, token, revision: 2 });
  const saved = await t.query(api.cardReview.get, { id, token }); assert.equal(saved?.accepted, true);
  const run = await t.run(ctx => ctx.db.get(id)); assert.equal(run?.cards, cards); assert.equal(run?.searchCount, 3);
  assert.deepEqual(JSON.parse(run!.understandingJson!).excludedGroupIds, ["b"]);
});
test("failed AI correction preserves original meaning, clears pending state and permits a later successful correction", async () => {
  const { t, id, token, cards } = await setup();
  const jobId = await t.run(async ctx => {
    const jobId = await ctx.db.insert("cardCorrections", { runId: id, cardId: "a", kind: "label", note: "Use new meaning", revision: 0, requestId: "test-request-id-1234", state: "running" });
    await ctx.db.patch(id, { reviewPending: jobId, reviewLast: jobId }); return jobId;
  });
  await assert.rejects(() => t.mutation(api.cardReview.decision, { id, token, revision: 0, cardId: "b", decision: "correct" }));
  await t.mutation(internal.cardReview.finish, { jobId, error: "Test failure" });
  const failed = await t.query(api.cardReview.get, { id, token });
  assert.equal(failed?.revision, 0); assert.equal(failed?.pending, null); assert.equal(failed?.last?.error, "Test failure");
  assert.equal((await t.run(ctx => ctx.db.get(id)))?.cards, cards);
  const nextJob = await t.run(async ctx => {
    const next = await ctx.db.insert("cardCorrections", { runId: id, cardId: "a", kind: "other", note: "Corrected scope", revision: 0, requestId: "test-request-id-5678", state: "running" });
    await ctx.db.patch(id, { reviewPending: next, reviewLast: next }); return next;
  });
  await t.mutation(internal.cardReview.finish, { jobId: nextJob, resultJson: JSON.stringify({ outcome: "updated", label: "New meaning", need: "Corrected scope", explanation: "Updated" }) });
  const updated = await t.query(api.cardReview.get, { id, token }); assert.equal(updated?.cards[0].label, "New meaning"); assert.equal(updated?.decisions.a, "pending");
  await t.mutation(internal.cardReview.finish, { jobId: nextJob, error: "Late duplicate failure" });
  assert.equal((await t.query(api.cardReview.get, { id, token }))?.cards[0].label, "New meaning");
});

test("merge finish saves evidence and retry selections; invalid output preserves cards and clears the job", async () => {
  const { t, id, token, cards } = await setup();
  async function job(requestId: string) { return t.run(async ctx => {
    const jobId = await ctx.db.insert("cardCorrections", { runId: id, cardId: "a", kind: "merge", targetCardId: "b", note: "", revision: 0, requestId, state: "running" });
    await ctx.db.patch(id, { reviewPending: jobId, reviewLast: jobId }); return jobId;
  }); }
  const bad = await job("bad-merge-request-123");
  await t.mutation(internal.cardReview.finish, { jobId: bad, resultJson: JSON.stringify({ outcome: "updated", explanation: "Invalid", groups: [{ label: "Merged", need: "Need", queryIds: ["invented"] }] }) });
  const failed = await t.query(api.cardReview.get, { id, token });
  assert.ok(failed?.last);
  assert.equal(failed.last.state, "failed"); assert.equal(failed.last.targetCardId, "b"); assert.equal(failed.pending, null); assert.equal(failed.revision, 0);
  const good = await job("good-merge-request-123");
  await t.mutation(internal.cardReview.finish, { jobId: good, resultJson: JSON.stringify({ outcome: "updated", explanation: "Same need", groups: [{ label: "Merged", need: "Need", queryIds: ["a", "b"] }] }) });
  const saved = await t.query(api.cardReview.get, { id, token });
  assert.ok(saved);
  assert.equal(saved.cards.length, 1); assert.equal(saved.cards[0].queries.length, 2); assert.equal(saved.decisions.a, "pending");
  assert.equal((await t.run(ctx => ctx.db.get(id)))?.cards, cards);
});
