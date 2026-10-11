import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { importExperiment, neutralBusinessContext } from "../shared/experiment.ts";
import { scoreRecord, scoredPages } from "../shared/scoring.ts";

test("Contact and enquiries is baseline hygiene, not an extra scored recommendation", () => {
  const pages = [
    { id: "contact", label: "Contact and enquiries", treatment: "Page", role: "General page" },
    { id: "equipment", label: "Equipment enquiries", treatment: "Page", role: "Category page" },
  ];
  assert.deepEqual(scoredPages(pages).map(p => p.id), ["equipment"]);
});

const folder = "clustering logic";
const file = (suffix: string) => readFileSync(`${folder}/${readdirSync(folder).find(name => name.endsWith(suffix))}`, "utf8");
test("imports all 406 original nodes without losing duplicates, source types or paths", () => {
  const input = importExperiment(file("1 Raw Search Tree.csv"));
  assert.equal(input.rawNodes.length, 406);
  assert.equal(new Set(input.rawNodes.map(row => row.id)).size, 406);
  assert.equal(input.rawNodes.find(row => row.id === "N291")?.query, "MRI Compatible Stretcher Price");
  assert.ok(input.evidence.length < 406);
  assert.equal(input.evidence.flatMap(row => row.occurrences).length + input.seedOnly.length, 406);
  assert.equal(input.seedOnly.length, 7);
  assert.ok(input.evidence.every(row => row.volume === null));
});
test("generation business context omits the expected homepage target and seed decisions", () => {
  const context = neutralBusinessContext(file("6 Business Context.csv"), file("7 Seed Backlog.csv"));
  assert.ok(context.some(row => row.value.includes("training")));
  assert.ok(context.every(row => !/homepage target|gold.standard|frozen|branch|saturated/i.test(row.value)));
});

const pages = Array.from({ length: 13 }, (_, i) => ({ id: `p${i}`, label: `TEST_PAGE_${i}`, treatment: "Page", role: "Product family page" }));
const core = [{ id: "GS_TEST", label: "TEST_CORE" }];
const decisions = (kept: number) => pages.map((page, i) => ({ pageId: page.id, decision: i < kept ? "keep" : "reject", reason: "Test judgement" }));
const coverage = [{ coreId: "GS_TEST", decision: "covered", pageIds: ["p0"], reason: "Test evidence" }];
test("8 of 13 is 61.5%, below 75%, even when Core coverage passes", () => {
  const score = scoreRecord(pages, core, decisions(8), coverage);
  assert.equal(score.pagesKept, 8); assert.equal(score.pagesProposed, 13);
  assert.equal(score.keepPercentage, 61.5); assert.equal(score.keepRatePass, false);
  assert.equal(score.coreCoveragePass, true); assert.equal(score.overall, "FAIL");
  assert.match(score.display, /8 of 13 \(61.5%\)/);
});
test("75% exactly passes only with completed Core coverage", () => {
  const subset = pages.slice(0, 4);
  assert.equal(scoreRecord(subset, core, decisions(3).slice(0, 4), coverage).overall, "PASS");
  assert.equal(scoreRecord(subset, core, decisions(3).slice(0, 4), []).overall, "PENDING");
  assert.equal(scoreRecord(subset, core, decisions(3).slice(0, 4), [{ ...coverage[0], decision: "missed", pageIds: [] }]).overall, "FAIL");
});
test("pending decisions and an empty plan can never pass or become zero-percent final scores", () => {
  const score = scoreRecord(pages, core, [], []);
  assert.equal(score.overall, "PENDING"); assert.equal(score.keepPercentage, null);
  assert.equal(scoreRecord([], core, [], []).overall, "PENDING");
});
test("sections and FAQs cannot pad the page score; baseline About/Contact are excluded", () => {
  const extras = [
    { id: "section", label: "Test", treatment: "Section", role: "Section" },
    { id: "about", label: "About us", treatment: "Page", role: "General page" },
    { id: "contact", label: "Contact", treatment: "Page", role: "General page" },
  ];
  assert.equal(scoreRecord([...pages, ...extras], core, decisions(8), coverage).pagesProposed, 13);
});
test("scoring rejects duplicate judgements and invented Core/page references", () => {
  assert.throws(() => scoreRecord(pages, core, [...decisions(8), decisions(8)[0]], coverage));
  assert.throws(() => scoreRecord(pages, core, decisions(8), [{ ...coverage[0], pageIds: ["missing"] }]));
});
