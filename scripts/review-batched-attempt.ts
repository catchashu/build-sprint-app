import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { validateDraft } from "../shared/planning";
import { scoreRecord } from "../shared/scoring";
import { mriEvaluation } from "../convex/fixtures/mriEvaluation";

const prefix = "artifacts/mri-batched-medium";
const run = JSON.parse(await readFile(`${prefix}-attempt.json`, "utf8"));
const input = JSON.parse(run.inputJson);
const draft = validateDraft(JSON.parse(run.rawOutputJson), input);
const reasons: Record<string, [string, string]> = {
  P001: ["GS03; GS00", "Keep the category page and its explicit India sourcing/enquiry coverage. It serves category browsing and the broad supplier need together, though it does not create the expected separate dealer homepage."],
  P002: ["GS02", "Dedicated healthcare-worker safety-training service matches the confirmed offer and explicitly excludes certification."],
  P003: ["GS03.01", "Dedicated patient-monitoring family page preserves this complete equipment family; brands/models remain subject to confirmation."],
  P004: ["GS03.04", "Dedicated infusion-pump family page keeps syringe/IV variants and purchase details within the family."],
  P005: ["GS03.08", "Dedicated MRI fire-extinguisher family page retains the confirmed offer, purchase details and verified classification information."],
  P006: ["GS03.05", "Dedicated laryngoscope family page keeps set/model/price details within the product family without claiming stocked brands."],
  P007: ["GS03.06", "Dedicated wheelchair family page preserves the confirmed product and relevant specifications/purchase information."],
  P008: ["GS03.11 (Supporting)", "Furniture is a valid supporting family in the answer key; chairs are appropriately treated as a subtype."],
  P009: ["GS04", "The combined manufacture-and-installation page matches the confirmed Faraday cage/RF shielding offer. Placement under Equipment is a review point, not a reason to discard the page concept."],
  P010: ["GS01; GS01.1; GS01.2; GS01.3", "The standalone safety article/resource covers the expected umbrella safety purpose, zones, protocols and resource needs. Keep it as a starting point despite the Supporting Content label rather than Page."],
};
const decisions = Object.entries(reasons).map(([pageId, [, reason]]) => ({ pageId, decision: "keep", reason }));
const mapping: Record<string, [string[], string]> = {
  GS00: [["P001"], "Broad India sourcing and enquiry purpose is explicit in the category page. Count as equivalent merged coverage, not as a separate dealer homepage."],
  GS01: [["P010"], "Standalone safety content explicitly covers fundamentals, zones, precautions, protocols and terminology."],
  GS02: [["P002"], "Dedicated training service page."],
  GS03: [["P001"], "Dedicated equipment category."],
  "GS03.01": [["P003"], "Dedicated patient-monitoring family page."],
  "GS03.02": [["S011"], "Pulse oximeters are explicitly named and linked to their distinct cluster, but only as a conditional section; standalone family page missing."],
  "GS03.03": [["S011"], "Ventilators are explicitly named and linked to their distinct cluster, but only as a conditional section; standalone family page missing."],
  "GS03.04": [["P004"], "Dedicated infusion-pump family page."],
  "GS03.05": [["P006"], "Dedicated laryngoscope family page."],
  "GS03.06": [["P007"], "Dedicated wheelchair family page."],
  "GS03.08": [["P005"], "Dedicated fire-extinguisher family page."],
  "GS03.09": [["S011"], "Anesthesia machines are explicitly named and linked to their distinct cluster, but only as a conditional section; standalone family page missing."],
  "GS03.10": [["S011", "S015"], "Suction machines are explicitly named as conditional sections. The second section repeats coverage; a standalone family page is missing."],
  GS04: [["P009"], "Dedicated Faraday cage manufacture/installation page with shielding information."],
};
const coverage = mriEvaluation.core.map(core => ({ coreId: core.id, decision: "covered", pageIds: mapping[core.id][0], reason: mapping[core.id][1] }));
const score = {
  ...scoreRecord(draft.websitePlan, mriEvaluation.core, decisions, coverage),
  reviewer: "Codex provisional assessment; NOT practitioner-approved", runId: run._id,
  answerKeyHash: mriEvaluation.answerKeyHash, sourceHash: run.sourceHash,
  criterion: "Keep page/content concepts worth using as a starting point; equivalent purpose counts. Core coverage means not completely missed, not exact page-treatment match.",
  conditionalCoreNeeds: ["GS03.02", "GS03.03", "GS03.09", "GS03.10"],
  expectedMatches: reasons,
  sourceDiscrepancies: mriEvaluation.discrepancies,
};
const validation = JSON.parse(await readFile(`${prefix}-validation.json`, "utf8"));
const steps = JSON.parse(await readFile(`${prefix}-steps.json`, "utf8"));
assert.equal(steps.length, 10);
assert.ok(steps.every((s: { state: string }) => s.state === "complete"));
const batchLengths = steps.slice(0, 8).map((s: { rawJson: string }) => Object.keys(JSON.parse(s.rawJson).assignments).length);
assert.deepEqual(batchLengths, [50, 50, 50, 50, 50, 50, 50, 22]);
const env = await readFile(".env.local", "utf8");
const url = env.match(/^(?:VITE_)?CONVEX_URL=(.+)$/m)![1].trim().replace(/^['"]|['"]$/g, "");
const client = new ConvexHttpClient(url);
for (const file of ["artifacts/mri-original-j971va29ts7jcx9fnahegwtc3h8g0f8r.json", "artifacts/mri-luna-attempt.json", "artifacts/mri-batched-attempt.json"]) {
  const previous = JSON.parse(await readFile(file, "utf8"));
  assert.deepEqual(await client.query(api.experimentRuns.get, { id: previous._id }), previous);
}
validation.allThreeEarlierRunsUnchanged = true;
validation.completedModelSteps = steps.length;
validation.batchLengths = batchLengths;
await writeFile(`${prefix}-validation.json`, JSON.stringify(validation, null, 2));
await writeFile(`${prefix}-provisional-review.json`, JSON.stringify(score, null, 2));
const report = `# Structured batch attempt\n\nRun: ${run._id}\n\n## Validation: PASS\n\nAll 372 canonical IDs have exactly one destination: 237 clustered, 111 excluded, 24 unresolved. Zero repeated, missing or invented IDs. All 406 original observations remain preserved, including 27 duplicate occurrences and seven search-only seeds.\n\nModel: gpt-6-luna; reasoning: medium; max_output_tokens: 64000 per call; retries: zero. Eight query batches (50/50/50/50/50/50/50/22), one consolidation call and one architecture call completed once. Code created the final evidence-ID lists.\n\nAll three earlier saved runs are unchanged. The first batched setup request was rejected by the API before model generation because its schema used oneOf. That rejected setup and its error remain saved separately. The corrected request uses supported anyOf with mutually exclusive destination values.\n\n## Provisional quality comparison\n\n**Pages kept: 10 of 10 (100.0%) — 25 percentage points above the 75% line.** Minimum required: eight of ten. This is Codex's assessment, not a saved practitioner judgment.\n\nNine Pages and one standalone Supporting Content article count. About, Contact and enquiries, and five on-page sections do not count. The baseline Contact title exposed an exact-name filtering bug; the filter now excludes this baseline alias under the already-agreed rule. The generated output itself was not changed.\n\n**Completely missed Core needs: 0 of 14.** All 14 are mentioned in the recommended coverage; that is not the same as fourteen standalone pages. Four Core families—pulse oximeters, ventilators, anesthesia machines and suction machines—are only conditional sections. Supplier/dealer intent is merged into the equipment category rather than given a homepage. Safety is a standalone supporting article rather than the expected umbrella Page.\n\n| Proposed scored area | Keep/reject | Expected match and reason |\n|---|---|---|\n${score.pageDecisions.map(p => `| ${p.label} | ${p.decision} | ${reasons[p.id][0]}: ${p.reason} |`).join("\n")}\n\n| Core need | Coverage | Evidence in plan |\n|---|---|---|\n${score.coreDecisions.map(c => `| ${c.label} | ${c.decision} | ${c.pageIds.join(", ")}: ${c.reason} |`).join("\n")}\n\n## Remaining review points\n\n- Confirm whether the four conditional Core product families should receive standalone pages.\n- Decide whether broad India dealer intent should be moved from the category page to the homepage.\n- Remove duplicate suction coverage in S011/S015; S014 and S015 also share a generic label.\n- S013 calls itself business-context-only but links the general category cluster; its displayed source label can overstate demand support for the individual products.\n- Keep the Faraday product-service placement and safety Page-versus-Article treatment under practitioner review.\n\nThe unchanged answer key has known source-link discrepancies; see the JSON review for the full list. No answer key was sent to generation.\n\n## Reproduce and inspect\n\nRun \`npx tsx scripts/run-batched-attempt.ts\` to export the same saved attempt without new model calls. Run \`npm run dev\`, then open the Network address on your phone on the same Wi-Fi with \`/?firstRun=${run._id}\`. Browser/phone rendering has not been checked for this attempt.\n\nFull output: mri-batched-medium-full-output.json. Every request, schema and response: mri-batched-medium-steps.json. Provisional review: mri-batched-medium-provisional-review.json.\n`;
await writeFile(`${prefix}-review.md`, report);
console.log(JSON.stringify({ validation, pagesKept: score.pagesKept, proposed: score.pagesProposed, percentage: score.keepPercentage,
  missedCoreNeeds: score.coreNeedsMissed, conditionalCoreNeeds: score.conditionalCoreNeeds, provisionalOverall: score.overall }, null, 2));
