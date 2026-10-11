import test from "node:test";
import assert from "node:assert/strict";
import { mriInput } from "../convex/fixtures/mriInput.ts";
import { mriEvaluation } from "../convex/fixtures/mriEvaluation.ts";
import { generationPrompt, validateDraft, fullResult, type Draft } from "../shared/planning.ts";
import type { ExperimentInput } from "../shared/experiment.ts";

import { testInput, testDraft } from "./planning-fixture.ts";
test("an evidence ID cannot belong to a cluster and excluded or unresolved, or to both lists", () => {
  const id = testDraft.clusters[0].evidenceIds[0];
  for (const destination of ["excluded", "unresolved"] as const) {
    const draft = structuredClone(testDraft);
    if (destination === "excluded") draft.excluded.push({ evidenceIds: [id], reason: "Overlap regression" });
    else draft.unresolved.push({ evidenceIds: [id], reason: "Overlap regression", question: "Uncertain?" });
    assert.throws(() => validateDraft(draft, testInput), /repeated evidence ID/);
  }
  const draft = structuredClone(testDraft);
  draft.clusters[0].evidenceIds = draft.clusters[0].evidenceIds.filter(value => value !== id);
  draft.excluded.push({ evidenceIds: [id], reason: "Excluded" });
  draft.unresolved.push({ evidenceIds: [id], reason: "Uncertain", question: "Include?" });
  assert.throws(() => validateDraft(draft, testInput), /repeated evidence ID/);
});
test("generation prompt contains no answer key, retrieval decisions or demand-derived homepage target", () => {
  const prompt = generationPrompt(mriInput as ExperimentInput);
  assert.ok(!prompt.includes("GS03.10")); assert.ok(!prompt.includes("Expert Rationale"));
  assert.ok(!prompt.includes("Demand-derived homepage target")); assert.ok(!prompt.includes("8/13"));
  assert.equal(mriEvaluation.core.length, 14);
});
test("preserves synonym evidence, separate families, and price sub-intents without price pages", () => {
  const result = fullResult(validateDraft(testDraft, testInput), testInput);
  assert.equal(result.draftWebsitePlan.length, 2);
  assert.equal(result.demandMap[0].evidence.length, 4);
  assert.equal(result.demandMap[0].subIntents[0].stage, "Consideration");
  assert.ok(result.demandMap.every(row => row.demand === "Insufficient evidence"));
});
test("rejects missing, repeated, seed-only or invented evidence IDs", () => {
  for (const id of ["N999", "N083", "N112"]) {
    const bad = structuredClone(testDraft); bad.clusters[0].evidenceIds[0] = id;
    assert.throws(() => validateDraft(bad, testInput));
  }
  const bad = structuredClone(testDraft); bad.clusters[0].evidenceIds.pop(); assert.throws(() => validateDraft(bad, testInput));
});
test("rejects fabricated metrics and unconfirmed product claims", () => {
  assert.throws(() => validateDraft({ ...testDraft, volume: 100 }, testInput));
  const bad = structuredClone(testDraft); bad.websitePlan[0].role = "Product detail page";
  assert.throws(() => validateDraft(bad, testInput));
});
test("business-only coverage is allowed with an actual business fact and marked honestly", () => {
  const fact = testInput.businessFacts.find(f => f.value === "MRI Room Oxygen Monitor")!;
  const draft = structuredClone(testDraft);
  draft.websitePlan.push({ ...draft.websitePlan[0], id: "business-only", parentId: "p1", label: fact.value, role: "Product detail page", priority: "Later", clusterIds: [], businessFactIds: [fact.id] });
  const result = fullResult(validateDraft(draft, testInput), testInput);
  assert.equal(result.draftWebsitePlan.at(-1)?.evidenceBasis, "Business context only; demand not validated");
});
test("unresolved queries are retained and hierarchy cycles are rejected", () => {
  const draft = structuredClone(testDraft);
  draft.clusters[0].evidenceIds = draft.clusters[0].evidenceIds.filter(id => id !== "N143");
  draft.unresolved.push({ evidenceIds: ["N143"], reason: "Test ambiguity", question: "Confirm grouping?" });
  assert.equal(fullResult(validateDraft(draft, testInput), testInput).unresolvedEvidence[0].evidence[0].query, "mri safe monitor");
  draft.websitePlan[0].parentId = "p1"; assert.throws(() => validateDraft(draft, testInput));
});
