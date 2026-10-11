import test from "node:test";
import assert from "node:assert/strict";
import { nextSearchCount, publicWebsite, liveInput, materializeCards } from "../shared/firstValue.ts";
import { convexTest } from "convex-test";
import schema from "../convex/schema.ts";
import { api, internal } from "../convex/_generated/api.js";
const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server.js"),
  "../convex/firstValue.ts": () => import("../convex/firstValue.ts"),
};
test("saved search failures remain visible and a retry cannot reset the server budget", async () => {
  const t = convexTest(schema, modules), token = "test-capability-token-with-at-least-32-characters";
  const id = await t.mutation(api.firstValue.create, { offering: "Hospital equipment for India", context: "", token });
  await t.mutation(internal.firstValue.save, { id, state: "searching" });
  const index = await t.mutation(internal.firstValue.reserveSearch, { id, query: "hospital beds" });
  await t.mutation(internal.firstValue.finishSearch, { id, index, error: "Test provider failure" });
  await t.mutation(internal.firstValue.save, { id, state: "failed", error: "Search failed" });
  let run = await t.query(api.firstValue.get, { id, token });
  assert.ok(run);
  assert.equal(run.searchCount, 1); assert.equal(run.searches[0].status, "failed"); assert.equal(run.cards, null);
  await t.mutation(internal.firstValue.save, { id, state: "searching" });
  for (let i = 1; i < 4; i++) await t.mutation(internal.firstValue.reserveSearch, { id, query: `test search ${i}` });
  await assert.rejects(() => t.mutation(internal.firstValue.reserveSearch, { id, query: "forbidden fifth" }), /limit/);
  run = await t.query(api.firstValue.get, { id, token });
  assert.ok(run);
  assert.equal(run.searchCount, 4); assert.equal(run.searches[0].error, "Test provider failure");
  assert.equal(await t.query(api.firstValue.get, { id, token: "wrong" }), null);
  assert.equal("token" in run, false); assert.equal("responses" in run, false);
});
test("search budget includes failed attempts and refuses a fifth attempt", () => {
  let used = 0;
  for (let i = 0; i < 4; i++) used = nextSearchCount(used);
  assert.equal(used, 4); assert.throws(() => nextSearchCount(used), /limit/);
  assert.throws(() => nextSearchCount(-1));
});
test("website context accepts only public HTTPS names", () => {
  assert.equal(publicWebsite("https://example.com"), "https://example.com/");
  for (const url of ["http://example.com", "https://127.0.0.1", "https://[::1]", "https://example.local", "https://user:pass@example.com"]) assert.throws(() => publicWebsite(url));
});
test("live adapter preserves exact observed queries and all source occurrences", () => {
  const sources = [{ provider: "SerpAPI", reference: "https://serpapi.com/searches/a.json", field: "related_questions.question", retrievedAt: "2026-10-11" }];
  const input = liveInput("Hospital equipment", "", [{ id: "e1", query: "Hospital bed cost?", volume: null, sources }]);
  assert.equal(input.evidence[0].query, "Hospital bed cost?"); assert.equal(input.rawNodes.length, 1); assert.equal(input.evidence[0].volume, null);
  assert.throws(() => materializeCards({ cards: [{ groupId: "invented", label: "Fake", need: "Fake" }] }, [], []));
});
