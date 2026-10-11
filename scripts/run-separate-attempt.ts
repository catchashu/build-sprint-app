import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { validateDraft } from "../shared/planning";

const env = await readFile(".env.local", "utf8");
const url = env.match(/^(?:VITE_)?CONVEX_URL=(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, "");
if (!url) throw new Error("No Convex deployment URL.");
const client = new ConvexHttpClient(url);
const receipt = JSON.parse(await readFile("artifacts/mri-experiment-receipt.json", "utf8"));
assert.equal(receipt.deployment, url);
const original = await client.query(api.experimentRuns.get, { id: receipt.runId });
if (!original?.rawOutputJson) throw new Error("Original response not saved.");
await writeFile(`artifacts/mri-original-${original._id}.json`, JSON.stringify(original, null, 2));
const originalDraft = JSON.parse(original.rawOutputJson);
const owners = new Map<string, string[]>();
for (const kind of ["clusters", "excluded", "unresolved"]) for (const [index, group] of (originalDraft[kind] ?? []).entries()) {
  for (const id of group.evidenceIds) owners.set(id, [...(owners.get(id) ?? []), `${kind}[${index}]`]);
}
console.log("Original overlap:", JSON.stringify([...owners].filter(([, places]) => places.length > 1)));
const attemptReceipt = "artifacts/mri-luna-attempt-receipt.json";
let runId;
try {
  const saved = JSON.parse(await readFile(attemptReceipt, "utf8"));
  assert.equal(saved.deployment, url); assert.equal(saved.parentRunId, original._id);
  runId = saved.runId;
} catch (error) {
  if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) throw error;
  runId = await client.mutation(api.experimentRuns.create, { parentRunId: original._id });
  await writeFile(attemptReceipt, JSON.stringify({ runId, parentRunId: original._id, deployment: url }, null, 2));
}
console.log("Separate attempt:", runId);
try { await client.action(api.experiment.generate, { runId }); }
catch (error) { console.error(error instanceof Error ? error.message : "Generation failed"); }
const result = await client.query(api.experimentRuns.get, { id: runId });
await writeFile(`artifacts/mri-luna-attempt.json`, JSON.stringify(result, null, 2));
assert.deepEqual(await client.query(api.experimentRuns.get, { id: original._id }), original);
console.log("Original unchanged: true. New attempt state:", result?.state);
if (result?.rawOutputJson) {
  try {
    const draft = validateDraft(JSON.parse(result.rawOutputJson), JSON.parse(result.inputJson));
    const validation = { runId, result: "PASS", canonicalEvidence: JSON.parse(result.inputJson).evidence.length,
      clustered: draft.clusters.reduce((n, c) => n + c.evidenceIds.length, 0),
      excluded: draft.excluded.reduce((n, c) => n + c.evidenceIds.length, 0),
      unresolved: draft.unresolved.reduce((n, c) => n + c.evidenceIds.length, 0), originalUnchanged: true };
    await writeFile("artifacts/mri-luna-validation.json", JSON.stringify(validation, null, 2));
    await writeFile("artifacts/mri-luna-full-output.json", result.outputJson!);
    console.log(JSON.stringify(validation));
  } catch (error) {
    await writeFile("artifacts/mri-luna-validation.json", JSON.stringify({ runId, result: "FAIL", error: String(error), originalUnchanged: true }, null, 2));
    console.error(String(error)); process.exitCode = 1;
  }
} else process.exitCode = 1;
