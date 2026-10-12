import { collectBatches } from "../shared/batchedPlanning";
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
test("three saved searches and a permanent fourth failure proceed without another request", async () => {
  const t = convexTest(schema, modules), token = "test-capability-token-with-at-least-32-characters";
  const responses = [0, 1, 2].map(i => JSON.stringify({ search_metadata: { id: `saved-${i}`, status: "Success", created_at: "2026-10-12" }, search_parameters: { gl: "in" }, related_searches: [{ query: `Observed need ${i} one` }, { query: `Observed need ${i} two` }] }));
  const seeds = ["beds", "tables", "trolleys", "failed search"];
  const searches = seeds.map((query, i) => ({ query, status: i === 3 ? "failed" : "complete", ...(i === 3 ? { error: "SerpAPI returned HTTP 401. No substitute results were used." } : {}) }));
  const id = await t.run(ctx => ctx.db.insert("firstValueRuns", { token, offering: "Hospital equipment", context: "", state: "working", searchCount: 4, seeds, searches, responses, batches: [] }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { assert.fail("Recovery must not request another search"); };
  try { await t.action(internal.firstValue.search, { id }); }
  finally { globalThis.fetch = originalFetch; }
  const saved = await t.run(ctx => ctx.db.get(id));
  assert.equal(saved?.searchCount, 4); assert.deepEqual(saved?.responses, responses); assert.deepEqual(saved?.searches, searches);
});
test("saved search failures remain visible and a retry cannot reset the server budget", async () => {
  const t = convexTest(schema, modules), token = "test-capability-token-with-at-least-32-characters";
  const id = await t.mutation(api.firstValue.create, { offering: "Hospital equipment for India", context: "", token });
  await t.mutation(internal.firstValue.save, { id, state: "searching", seeds: ["hospital beds", "test search 1", "test search 2", "test search 3"] });
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

test("a new 503 after successful searches retains results and proceeds to grouping", async () => {
  const t = convexTest(schema, modules), token = "test-capability-token-with-at-least-32-characters";
  const response = JSON.stringify({ search_metadata: { id: "saved", status: "Success" }, search_parameters: { gl: "in" }, related_searches: [{ query: "hospital beds" }] });
  const id = await t.run(ctx => ctx.db.insert("firstValueRuns", { token, offering: "Hospital equipment", context: "", state: "working", searchCount: 1, seeds: ["beds", "tables"], searches: [{ query: "beds", status: "complete" }], responses: [response], batches: [] }));
  const originalFetch = globalThis.fetch, originalKey = process.env.SERPAPI_API_KEY; let requests = 0;
  process.env.SERPAPI_API_KEY = "unit-test-only"; globalThis.fetch = async () => { requests++; return new Response("Unavailable", { status: 503 }); };
  try { await t.action(internal.firstValue.search, { id }); }
  finally { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.SERPAPI_API_KEY; else process.env.SERPAPI_API_KEY = originalKey; }
  const saved = await t.run(ctx => ctx.db.get(id));
  assert.equal(requests, 2); assert.equal(saved?.searchCount, 3); assert.deepEqual(saved?.responses, [response]);
  assert.equal(saved?.searches[1].status, "failed"); assert.match(saved?.searches[1].error ?? "", /503/);
  await assert.rejects(() => t.action(internal.firstValue.group, { id }), /INSUFFICIENT/);
});

test("exhausted or insufficient evidence gives an edit-context route rather than a futile retry", async () => {
  const t = convexTest(schema, modules), token = "test-capability-token-with-at-least-32-characters";
  const id = await t.run(ctx => ctx.db.insert("firstValueRuns", { token, offering: "Hospital equipment", context: "", state: "failed", searchCount: 4, searches: [], responses: [], batches: [] }));
  assert.equal((await t.query(api.firstValue.get, { id, token }))?.canRetry, false);
  await assert.rejects(() => t.mutation(api.firstValue.start, { id, token }), /isn’t enough saved/);
  await t.run(ctx => ctx.db.patch(id, { searchCount: 2, responses: ["{}"], failureKind: "insufficient" }));
  assert.equal((await t.query(api.firstValue.get, { id, token }))?.canRetry, false);
  await assert.rejects(() => t.mutation(api.firstValue.start, { id, token }), /isn’t enough saved/);
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

test("reported run recovers two missing searches and discards only stale grouping", async () => {
 const t = convexTest(schema, modules), token = "test-capability-token-with-at-least-32-characters";
 const response = JSON.stringify({search_metadata:{id:"saved",status:"Success"},search_parameters:{gl:"in"},related_searches:[{query:"observed one"},{query:"observed two"}]});
 const fail = (query: string) => ({query,status:"failed",error:"SerpAPI returned HTTP 503. No substitute results were used."});
 const id = await t.run(ctx => ctx.db.insert("firstValueRuns", {token,offering:"Family office services",context:"",state:"failed",failureKind:"insufficient",searchCount:4,seeds:["a","b","c","d"],searches:[fail("a"),{query:"a",status:"complete"},{query:"b",status:"complete"},fail("c")],responses:[response,response],batches:["stale"],merge:"stale"}));
 assert.equal((await t.query(api.firstValue.get,{id,token}))?.canRetry,true);
 const originalFetch = globalThis.fetch, originalKey = process.env.SERPAPI_API_KEY; const requested: string[] = [];
 process.env.SERPAPI_API_KEY="test-only";
 globalThis.fetch=async input => { requested.push(new URL(String(input)).searchParams.get("q")!); return new Response(response,{status:200}); };
 try { await t.action(internal.firstValue.search,{id}); }
 finally {globalThis.fetch=originalFetch; if(originalKey===undefined) delete process.env.SERPAPI_API_KEY; else process.env.SERPAPI_API_KEY=originalKey;}
 const saved=await t.run(ctx=>ctx.db.get(id));
 assert.deepEqual(requested,["c","d"]); assert.equal(saved?.searchCount,6);
 assert.deepEqual(saved?.responses.slice(0,2),[response,response]); assert.equal(saved?.responses.length,4);
 assert.deepEqual(saved?.batches,[]); assert.equal(saved?.merge,undefined);
 assert.equal(saved?.searches[0].status,"failed");
 await assert.rejects(()=>t.mutation(internal.firstValue.reserveSearch,{id,query:"d"}),/limit/);
});


test("one supported card is enough, but zero cards and single-example cards are rejected", () => {
  const sources = [{ provider: "SerpAPI", reference: "https://serpapi.com/searches/saved.json", field: "related_searches.query", retrievedAt: "2026-10-12" }];
  const evidence = ["Family office services", "Family office fees"].map((query, i) => ({ id: `e${i}`, query, volume: null, sources }));
  const input = liveInput("Family office services", "", evidence);
  const assignment = { destination: "cluster", needKey: "family-office", label: "Family office services", need: "Find a provider", kind: "Service", intent: "Commercial", stage: "Consideration", priority: "Next", reason: "Relevant service", subIntent: "Comparing" };
  const groups = collectBatches(input, [{ assignments: Object.fromEntries(evidence.map(e => [e.id, assignment])) }]).groups;
  const raw = { cards: [{ groupId: groups[0].id, label: assignment.label, need: assignment.need }] };
  assert.deepEqual(materializeCards(raw, groups, evidence)[0].queries, evidence);
  assert.throws(() => materializeCards({ cards: [] }, groups, evidence));
  assert.throws(() => materializeCards(raw, [{ ...groups[0], assignments: groups[0].assignments.slice(0, 1) }], evidence), /Not enough sourced/);
  assert.throws(() => materializeCards(raw, groups, evidence.slice(0, 1)), /Missing source/);
});
