import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema.ts";
import { api, internal } from "../convex/_generated/api.js";
import { testDraft } from "./planning-fixture.ts";

// In-memory server tests. No model calls, credentials or research scores are fabricated.
const modules = {
  "../convex/_generated/server.js": () => import("../convex/_generated/server.js"),
  "../convex/experimentRuns.ts": () => import("../convex/experimentRuns.ts"),
  "../convex/evaluation.ts": () => import("../convex/evaluation.ts"),
  "../convex/batchedExperiment.ts": () => import("../convex/batchedExperiment.ts"),
};
test("batched attempts freeze medium settings and cannot overwrite or repeat a saved model step", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(api.experimentRuns.create, { pipeline: "batched-v1" });
  const run = await t.query(api.experimentRuns.get, { id });
  const settings = JSON.parse(run!.settingsJson!);
  assert.equal(settings.reasoningEffort, "medium"); assert.equal(settings.batchSize, 50);
  await t.mutation(internal.experimentRuns.begin, { id, model: "OpenAI/gpt-6-luna" });
  const stepId = await t.mutation(internal.batchedExperiment.reserve, { runId: id, index: 0, requestJson: "TEST" });
  await assert.rejects(() => t.mutation(internal.batchedExperiment.reserve, { runId: id, index: 0, requestJson: "REPEAT" }));
  await t.mutation(internal.batchedExperiment.saveStep, { id: stepId, rawJson: "TEST RESPONSE" });
  await assert.rejects(() => t.mutation(internal.batchedExperiment.saveStep, { id: stepId, rawJson: "OVERWRITE" }));
  const saved = JSON.parse(await t.query(api.batchedExperiment.exportSteps, { runId: id }));
  assert.equal(saved.length, 1); assert.equal(saved[0].rawJson, "TEST RESPONSE");
});
test("a separate attempt preserves the failed original and reuses only its input", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(api.experimentRuns.create, {});
  const started = await t.mutation(internal.experimentRuns.begin, { id, model: "OpenAI/gpt-4.1" });
  await t.mutation(internal.experimentRuns.finish, { id, attempt: started.attempt, rawOutputJson: "{}", error: "Repeated evidence ID" });
  const before = await t.query(api.experimentRuns.get, { id });
  const nextId = await t.mutation(api.experimentRuns.create, { parentRunId: id });
  const next = await t.query(api.experimentRuns.get, { id: nextId });
  assert.deepEqual(await t.query(api.experimentRuns.get, { id }), before);
  assert.equal(next?.parentRunId, id);
  assert.equal(next?.inputJson, before?.inputJson);
  assert.equal(next?.rawOutputJson, undefined);
  assert.equal(JSON.parse(next!.settingsJson!).model, "gpt-6-luna");
  assert.ok(!next?.prompt.includes("priorDraft"));
});
test("first output is immutable, duplicate starts blocked, and key setup can recover a failed connection", async () => {
  const t = convexTest(schema, modules);
  const id = await t.mutation(api.experimentRuns.create, {});
  await assert.rejects(() => t.query(api.evaluation.get, { runId: id }));
  const first = await t.mutation(internal.experimentRuns.begin, { id, model: "Convex AI Gateway/gpt-4.1" });
  await assert.rejects(() => t.mutation(internal.experimentRuns.begin, { id, model: "Convex AI Gateway/gpt-4.1" }));
  await t.mutation(internal.experimentRuns.finish, { id, attempt: first.attempt, error: "Test connection failure" });
  const retry = await t.mutation(internal.experimentRuns.begin, { id, model: "OpenAI/gpt-4.1" });
  await t.mutation(internal.experimentRuns.finish, { id, attempt: retry.attempt, rawOutputJson: JSON.stringify(testDraft), outputJson: "TEST_ONLY_OUTPUT" });
  const again = await t.mutation(internal.experimentRuns.begin, { id, model: "OpenAI/gpt-4.1" });
  assert.equal(again.outputJson, "TEST_ONLY_OUTPUT"); assert.equal(again.attempt, retry.attempt);
  await assert.rejects(() => t.mutation(internal.experimentRuns.finish, { id, attempt: first.attempt, outputJson: "OVERWRITE" }));
});
test("completed but invalid model output stays frozen instead of being silently retried", async () => {
  const t = convexTest(schema, modules); const id = await t.mutation(api.experimentRuns.create, {});
  const run = await t.mutation(internal.experimentRuns.begin, { id, model: "OpenAI/gpt-4.1" });
  await t.mutation(internal.experimentRuns.finish, { id, attempt: run.attempt, rawOutputJson: "{}", error: "Test invalid output" });
  await assert.rejects(() => t.mutation(internal.experimentRuns.begin, { id, model: "OpenAI/gpt-4.1" }));
});
test("scoring persists count, percentage and threshold; revisions preserve the original score", async () => {
  const t = convexTest(schema, modules); const id = await t.mutation(api.experimentRuns.create, {});
  const run = await t.mutation(internal.experimentRuns.begin, { id, model: "OpenAI/gpt-4.1" });
  await t.mutation(internal.experimentRuns.finish, { id, attempt: run.attempt, rawOutputJson: JSON.stringify(testDraft), outputJson: "TEST_ONLY_OUTPUT" });
  const evaluation = JSON.parse(await t.query(api.evaluation.get, { runId: id }));
  await assert.rejects(() => t.mutation(api.evaluation.revise, { runId: id, correction: "Test correction" }));
  const scoreJson = await t.mutation(api.evaluation.save, { runId: id,
    decisionsJson: JSON.stringify(testDraft.websitePlan.map(p => ({ pageId: p.id, decision: "keep", reason: "Test-only judgement" }))),
    coverageJson: JSON.stringify(evaluation.core.map((c: { id: string }) => ({ coreId: c.id, decision: "missed", pageIds: [], reason: "Test only" }))),
  });
  const score = JSON.parse(scoreJson); assert.equal(score.pagesKept, 2); assert.equal(score.keepPercentage, 100); assert.equal(score.passLinePercentage, 75); assert.equal(score.overall, "FAIL");
  const revisedId = await t.mutation(api.evaluation.revise, { runId: id, correction: "Split the specified test grouping" });
  const revised = await t.query(api.experimentRuns.get, { id: revisedId });
  assert.equal(revised?.kind, "revised"); assert.equal(revised?.parentRunId, id); assert.equal(revised?.scoreJson, undefined);
  assert.equal((await t.query(api.experimentRuns.get, { id }))?.scoreJson, scoreJson);
});
