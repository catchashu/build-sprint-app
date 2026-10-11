import test from "node:test";
import assert from "node:assert/strict";
import { fetchSerpSearch } from "../shared/serpSearch.ts";

test("a fresh search taking longer than 45 seconds succeeds without another request", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  let finish!: (response: Response) => void;
  let signal!: AbortSignal;
  const pending = fetchSerpSearch(new URLSearchParams({ no_cache: "true" }), (async (_url, options) => {
    calls++; signal = options!.signal!;
    return new Promise<Response>(resolve => { finish = resolve; });
  }) as typeof fetch);
  t.mock.timers.tick(46_000);
  assert.equal(signal.aborted, false);
  finish(Response.json({ search_metadata: { status: "Success" } }));
  assert.equal((await pending).search_metadata.status, "Success");
  assert.equal(calls, 1);
});
test("a search exceeding two minutes reports timeout without leaking credentials or retrying", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const pending = fetchSerpSearch(new URLSearchParams({ api_key: "TEST_SECRET" }), (async (_url, options) => {
    calls++;
    return new Promise<Response>((_resolve, reject) => options!.signal!.addEventListener("abort", () => reject(new Error("TEST_SECRET"))));
  }) as typeof fetch);
  const check = assert.rejects(pending, error => error instanceof Error && error.message.includes("two minutes") && !error.message.includes("TEST_SECRET"));
  t.mock.timers.tick(120_000); await check; assert.equal(calls, 1);
});
test("network and HTTP failures stay explicit and never return substitute evidence", async () => {
  await assert.rejects(fetchSerpSearch(new URLSearchParams(), (async () => { throw new Error("private provider details"); }) as typeof fetch), /connection to SerpAPI failed/);
  await assert.rejects(fetchSerpSearch(new URLSearchParams(), (async () => new Response("provider error", { status: 429 })) as typeof fetch), /HTTP 429/);
});
