import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { validateDraft } from "../shared/planning";

const env = await readFile(".env.local", "utf8");
const url = env.match(/^(?:VITE_)?CONVEX_URL=(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, "");
if (!url) throw new Error("No Convex deployment URL.");
const client = new ConvexHttpClient(url);
const earlier = [];
for (const name of ["mri-experiment-receipt.json", "mri-luna-attempt-receipt.json"]) {
  const receipt = JSON.parse(await readFile(`artifacts/${name}`, "utf8"));
  assert.equal(receipt.deployment, url);
  const run = await client.query(api.experimentRuns.get, { id: receipt.runId });
  if (!run?.rawOutputJson) throw new Error("Earlier response not saved.");
  earlier.push(run);
}
// The earlier mri-batched-* receipt records an API schema rejection before generation.
// Preserve it; this corrected request format has its own receipt and artifacts.
const prefix = "artifacts/mri-batched-medium";
const path = `${prefix}-attempt-receipt.json`;
let runId;
try {
  const receipt = JSON.parse(await readFile(path, "utf8"));
  assert.equal(receipt.deployment, url); runId = receipt.runId;
} catch (cause) {
  if (!(cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT")) throw cause;
  runId = await client.mutation(api.experimentRuns.create, { parentRunId: earlier.at(-1)!._id, pipeline: "batched-v1" });
  await writeFile(path, JSON.stringify({ runId, deployment: url, earlierRunIds: earlier.map(r => r._id) }, null, 2));
}
let current = await client.query(api.experimentRuns.get, { id: runId });
if (current?.state === "ready") await client.mutation(api.batchedExperiment.start, { runId });
console.log(`Batched run: ${runId}. One attempt; model-call retries disabled.`);
console.log(`Review URL: http://localhost:5173/?firstRun=${runId}`);
let seen = 0;
while (true) {
  current = await client.query(api.experimentRuns.get, { id: runId });
  if (!current) throw new Error("Run missing.");
  for (const item of current.history.slice(seen)) console.log(item.message);
  seen = current.history.length;
  if (current.state !== "running") break;
  await new Promise(resolve => setTimeout(resolve, 5000));
}
await writeFile(`${prefix}-attempt.json`, JSON.stringify(current, null, 2));
await writeFile(`${prefix}-steps.json`, await client.query(api.batchedExperiment.exportSteps, { runId }));
for (const original of earlier) assert.deepEqual(await client.query(api.experimentRuns.get, { id: original._id }), original);
console.log("Both earlier runs unchanged.");
if (current.outputJson && current.rawOutputJson) {
  const input = JSON.parse(current.inputJson), draft = validateDraft(JSON.parse(current.rawOutputJson), input);
  const assignments = [...draft.clusters, ...draft.excluded, ...draft.unresolved].flatMap(g => g.evidenceIds);
  assert.equal(assignments.length, input.evidence.length);
  assert.equal(new Set(assignments).size, input.evidence.length);
  const validation = { runId, result: "PASS", canonicalEvidence: input.evidence.length,
    clustered: draft.clusters.reduce((n, c) => n + c.evidenceIds.length, 0), excluded: draft.excluded.reduce((n, c) => n + c.evidenceIds.length, 0),
    unresolved: draft.unresolved.reduce((n, c) => n + c.evidenceIds.length, 0), repeated: 0, missing: 0, invented: 0,
    originalRows: input.rawNodes.length, duplicateOccurrencesPreserved: input.importReport.duplicateOccurrences,
    seedOnlyPreserved: input.seedOnly.length, earlierRunsUnchanged: true, settings: JSON.parse(current.settingsJson!) };
  await writeFile(`${prefix}-validation.json`, JSON.stringify(validation, null, 2));
  await writeFile(`${prefix}-full-output.json`, current.outputJson);
  await writeFile(`${prefix}-raw-output.json`, current.rawOutputJson);
  console.log(JSON.stringify(validation, null, 2));
} else {
  await writeFile(`${prefix}-validation.json`, JSON.stringify({ runId, result: "FAIL", error: current.error, earlierRunsUnchanged: true }, null, 2));
  console.error(current.error); process.exitCode = 1;
}
