import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { assignmentSchema, evidenceBatches, collectBatches, consolidationSchema, consolidate, architectureSchema, assembleDraft, batchPrompt } from "../shared/batchedPlanning";
import { testInput, testDraft } from "./planning-fixture";
import { mriInput } from "../convex/fixtures/mriInput";
import type { ExperimentInput } from "../shared/experiment";

const assignment = { destination: "cluster", needKey: "test-need", label: "Test need", need: "Test only", kind: "Product family", intent: "Commercial", stage: "Purchase", priority: "Next", reason: "Test only", subIntent: "Buying" };
const response = { assignments: Object.fromEntries(testInput.evidence.map(row => [row.id, { ...assignment }])) };
test("strict schema requires every batch ID once and prohibits extra keys or two destinations", () => {
  const schema = assignmentSchema(testInput.evidence);
  assert.ok(schema.safeParse(response).success);
  for (const row of testInput.evidence) {
    const missing = structuredClone(response); delete missing.assignments[row.id];
    assert.equal(schema.safeParse(missing).success, false);
  }
  assert.equal(schema.safeParse({ assignments: { ...response.assignments, N999: assignment } }).success, false);
  const repeated = structuredClone(response) as any;
  repeated.assignments[testInput.evidence[0].id] = [assignment, { destination: "excluded", reason: "Test" }];
  assert.equal(schema.safeParse(repeated).success, false);
  const jsonSchema = z.toJSONSchema(schema) as any;
  assert.equal(jsonSchema.properties.assignments.additionalProperties, false);
  assert.ok(!JSON.stringify(jsonSchema).includes('"oneOf"'), "OpenAI accepts anyOf, not oneOf");
  assert.deepEqual(jsonSchema.properties.assignments.required, testInput.evidence.map(row => row.id));
});
test("all 372 canonical queries are partitioned into seven batches of 50 and one of 22", () => {
  const batches = evidenceBatches(mriInput as ExperimentInput);
  assert.deepEqual(batches.map(b => b.length), [50, 50, 50, 50, 50, 50, 50, 22]);
  assert.equal(new Set(batches.flat().map(r => r.id)).size, 372);
  assert.throws(() => evidenceBatches({ ...testInput, evidence: [...testInput.evidence, testInput.evidence[0]] }));
  assert.throws(() => collectBatches(testInput, []));
  assert.throws(() => collectBatches(testInput, [response, response]));
  const prompt = batchPrompt(testInput, testInput.evidence, 0);
  assert.ok(!prompt.includes("observations\":[{\"id\""));
  assert.ok(!prompt.includes("GS03"));
});
test("code merge and architecture cannot drop, duplicate or invent evidence IDs", () => {
  const changed = structuredClone(response) as any;
  changed.assignments[testInput.evidence[0].id] = { destination: "excluded", reason: "Test exclusion" };
  changed.assignments[testInput.evidence[1].id] = { destination: "unresolved", reason: "Test uncertainty", question: "Confirm?" };
  const groups = collectBatches(testInput, [changed]).groups;
  const mapping = { destinations: { G001: { groupId: "G001", reason: "Same test need" } } };
  assert.equal(consolidationSchema(groups).safeParse({ destinations: {} }).success, false);
  assert.equal(consolidationSchema(groups).safeParse({ destinations: { G001: { groupId: "invented", reason: "Test" } } }).success, false);
  const merged = consolidate(testInput, [changed], mapping);
  const { id, evidenceIds, subIntents, ...metadata } = testDraft.clusters[0];
  const architecture = { limitations: ["Test only"], clusters: { G001: metadata }, websitePlan: [{ ...testDraft.websitePlan[0], clusterIds: ["G001"] }] };
  const result = assembleDraft(testInput, [changed], mapping, architecture);
  const all = [...result.clusters, ...result.excluded, ...result.unresolved].flatMap(group => group.evidenceIds);
  assert.equal(all.length, testInput.evidence.length);
  assert.deepEqual([...all].sort(), testInput.evidence.map(row => row.id).sort());
  const bad = structuredClone(architecture) as any; bad.clusters.G001.evidenceIds = ["N999"];
  assert.equal(architectureSchema(merged.groups, testInput).safeParse(bad).success, false);
  const badPriority = structuredClone(architecture); badPriority.websitePlan[0].needsConfirmation = true;
  assert.equal(architectureSchema(merged.groups, testInput).safeParse(badPriority).success, false);
});
test("synonym groups across batch boundaries merge without losing source occurrences", () => {
  const input = mriInput as ExperimentInput;
  const responses = evidenceBatches(input).map((batch, i) => ({ assignments: Object.fromEntries(batch.map(row => [row.id, { ...assignment, needKey: `synonym-${i}` }])) }));
  const local = collectBatches(input, responses);
  assert.equal(local.groups.length, 8);
  const merge = { destinations: Object.fromEntries(local.groups.map(g => [g.id, { groupId: "G001", reason: "Test synonym merge" }])) };
  const result = consolidate(input, responses, merge);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].assignments.length, 372);
  assert.equal(new Set(result.groups[0].assignments.map(a => a.id)).size, 372);
  assert.equal(input.rawNodes.length, 406);
});
