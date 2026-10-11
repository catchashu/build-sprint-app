import test from "node:test";
import assert from "node:assert/strict";
import { extractSerpEvidence, parseEvidenceFile, validateReasoning, materialize } from "../shared/evidence.ts";

// Deliberately artificial parser tokens: never passed off as research or sent to AI.
const response = {
  search_metadata: { id: "parser-test", status: "Success" },
  search_parameters: { q: "INPUT_ONLY", gl: "in" },
  related_searches: [{ query: "SOURCE_TOKEN_A" }, { query: "SOURCE_TOKEN_A" }],
  related_questions: [{ question: "SOURCE_TOKEN_B" }],
  organic_results: [{ title: "NOT_A_QUERY" }],
};
const reasoning = {
  limitations: ["Test only"],
  clusters: [{ id: "c1", label: "Test", need: "Test", intent: "Consideration", priority: "First", rationale: "Test", evidenceIds: ["e1", "e2"] }],
  excluded: [],
  websitePlan: [{ id: "p1", parentId: null, label: "Test", treatment: "Page", priority: "First", rationale: "Test", coverage: ["Test"], clusterIds: ["c1"] }],
};

test("retains only actual provider query fields, deduplicates, and never creates volume", () => {
  const rows = extractSerpEvidence([response]);
  assert.deepEqual(rows.map(r => r.query), ["SOURCE_TOKEN_A", "SOURCE_TOKEN_B"]);
  assert.ok(rows.every(r => r.volume === null));
  assert.equal(rows[0].sources.length, 1);
});
test("rejects non-India or failed provider responses", () => {
  assert.throws(() => extractSerpEvidence([{ ...response, search_parameters: { gl: "us" } }]));
  assert.throws(() => extractSerpEvidence([{ ...response, error: "failure" }]));
});
test("rejects invented evidence IDs and silently dropped queries", () => {
  const rows = extractSerpEvidence([response]);
  assert.throws(() => validateReasoning({ ...reasoning, clusters: [{ ...reasoning.clusters[0], evidenceIds: ["e999"] }] }, rows));
  assert.throws(() => validateReasoning({ ...reasoning, clusters: [{ ...reasoning.clusters[0], evidenceIds: ["e1"] }] }, rows));
});
test("rejects invented query/volume fields and invalid website hierarchy", () => {
  const rows = extractSerpEvidence([response]);
  assert.throws(() => validateReasoning({ ...reasoning, queries: ["INVENTED"] }, rows));
  assert.throws(() => validateReasoning({ ...reasoning, clusters: [{ ...reasoning.clusters[0], volume: 100 }] }, rows));
  assert.throws(() => validateReasoning({ ...reasoning, websitePlan: [{ ...reasoning.websitePlan[0], parentId: "p1" }] }, rows));
});
test("output copies all query text from evidence and marks unmeasured demand honestly", () => {
  const rows = extractSerpEvidence([response]);
  const result = materialize(validateReasoning(reasoning, rows), rows);
  assert.equal(result.demandMap[0].demand, "Insufficient evidence");
  assert.deepEqual(result.demandMap[0].evidence.map(r => r.query), rows.map(r => r.query));
});
test("user files require India and source metadata, and reject volume fields", () => {
  const file = { market: "India", queries: [{ query: "FILE_TEST_TOKEN", source: "test-file", retrievedAt: "test-only" }] };
  assert.equal(parseEvidenceFile(JSON.stringify(file))[0].query, "FILE_TEST_TOKEN");
  assert.throws(() => parseEvidenceFile(JSON.stringify({ ...file, market: "USA" })));
  assert.throws(() => parseEvidenceFile(JSON.stringify({ ...file, queries: [{ ...file.queries[0], volume: 100 }] })));
  assert.throws(() => parseEvidenceFile(JSON.stringify({ ...file, queries: [{ query: "FILE_TEST_TOKEN" }] })));
});
