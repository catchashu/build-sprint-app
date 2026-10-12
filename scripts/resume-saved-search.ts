import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { extractSerpEvidence } from "../shared/evidence";

// The ignored receipt is the exact failed run identified from the user's report.
// Never log its capability token or reset any saved research.
const before = JSON.parse(readFileSync("artifacts/search-recovery-target.json", "utf8"));
assert.equal(before.searchCount, 4); assert.equal(before.responses.length, 3);
assert.equal(before.state, "failed"); assert.ok(!before.cards);
const client = new ConvexHttpClient("https://ardent-fly-778.convex.cloud");
const identity = { id: before._id, token: before.token };
const log: string[] = [];
function report(message: string) { console.log(message); log.push(message); }
await client.mutation(api.firstValue.start, identity);
report("Resumed the reported run using its three saved responses. No new search requested.");
let lastState = "", complete = false;
for (let attempt = 0; attempt < 120; attempt++) {
  const run = await client.query(api.firstValue.get, identity); assert.ok(run);
  assert.equal(run.searchCount, before.searchCount); assert.deepEqual(run.searches, before.searches);
  if (run.state !== lastState) { report(`Run state: ${run.state}`); lastState = run.state; }
  if (run.state === "failed") throw new Error(run.error ?? "Recovery failed");
  if (run.state === "complete") {
    const cards = JSON.parse(run.cards!);
    const evidence = extractSerpEvidence(before.responses.map((r: string) => JSON.parse(r)));
    for (const card of cards) for (const query of card.queries) assert.deepEqual(query, evidence.find(e => e.id === query.id));
    report(`PASS: ${cards.length} cards generated from saved evidence; all displayed queries and sources match it exactly.`);
    complete = true; break;
  }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
assert.ok(complete, "Recovery is still processing after six minutes; do not restart it.");
const result = spawnSync(process.execPath, ["node_modules/convex/bin/main.js", "run", "firstValue:read", JSON.stringify({ id: before._id }), "--prod"], { encoding: "utf8", maxBuffer: 10000000 });
assert.equal(result.status, 0);
const saved = JSON.parse(result.stdout); assert.deepEqual(saved.responses, before.responses);
assert.equal(saved.searchCount, 4); assert.deepEqual(saved.searches, before.searches);
report("PASS: original three responses unchanged, failed 503 still visible, count remains 4/4, zero additional searches.");
report("NOT RUN: phone browser interaction (no connected browser).");
writeFileSync("artifacts/search-recovery-verification.txt", log.join("\n") + "\n");
