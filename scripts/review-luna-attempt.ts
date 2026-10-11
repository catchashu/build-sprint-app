import { readFile, writeFile } from "node:fs/promises";
import { draftSchema } from "../shared/planning";
import { scoreRecord } from "../shared/scoring";
import { mriEvaluation } from "../convex/fixtures/mriEvaluation";
import type { ExperimentInput } from "../shared/experiment";

const run = JSON.parse(await readFile("artifacts/mri-luna-attempt.json", "utf8"));
const draft = draftSchema.parse(JSON.parse(run.rawOutputJson));
const input: ExperimentInput = JSON.parse(run.inputJson);
const valid = new Set(input.evidence.map(e => e.id));
const owners = new Map<string, string[]>();
for (const kind of ["clusters", "excluded", "unresolved"] as const) draft[kind].forEach((group, index) => {
  group.evidenceIds.forEach(id => owners.set(id, [...(owners.get(id) ?? []), `${kind}[${index}]`]));
});
const validation = {
  runId: run._id, result: "FAIL", originalUnchanged: true, settings: JSON.parse(run.settingsJson),
  canonicalEvidence: valid.size,
  assignedExactlyOnce: [...valid].filter(id => owners.get(id)?.length === 1).length,
  repeated: [...owners].filter(([, destinations]) => destinations.length > 1).map(([id, destinations]) => ({ id, destinations })),
  unknown: [...owners.keys()].filter(id => !valid.has(id)),
  omitted: [...valid].filter(id => !owners.has(id)),
  unconfirmedFirstPriority: draft.websitePlan.filter(p => p.needsConfirmation && p.priority === "First").map(p => p.id),
};
const decisions = [
  { pageId: "plan-home", decision: "reject", reason: "Generic business-context homepage omits the demand-backed India equipment supplier purpose required by GS00. B1/B2 are not page coverage." },
  { pageId: "plan-equipment", decision: "reject", reason: "The category purpose matches GS03, but the proposed architecture collapses distinct complete product families into one confirmed-family section. Keep the category concept, but not this proposed scope and treatment as-is." },
  { pageId: "plan-training", decision: "keep", reason: "The dedicated staff-training service page matches GS02 and excludes certification. Keep the page concept; its confirmation/First-priority conflict still requires correction." },
  { pageId: "plan-faraday", decision: "keep", reason: "The combined manufacture-and-installation page matches GS04. Keep the page concept; its confirmation/First-priority conflict still requires correction." },
];
const mapping: Record<string, [string[], string]> = {
  GS00: [[], "No page explicitly serves India-wide equipment dealer/supplier intent. The generic Home is business-context-only; supplier evidence in a category does not itself establish that coverage."],
  GS01: [["plan-safety-faq"], "Safety precautions, zones and protocols are explicitly covered in FAQs. This is thin treatment, but the need is not completely missed."],
  GS02: [["plan-training"], "Dedicated staff-training service page."],
  GS03: [["plan-equipment"], "Equipment category explicitly proposed; architecture quality is judged separately."],
  "GS03.01": [["plan-families"], "Monitoring is explicitly named and linked to the monitoring cluster; demoted to a section."],
  "GS03.02": [["plan-equipment"], "The linked monitoring cluster explicitly includes pulse oximetry; merged rather than a separate family page."],
  "GS03.03": [["plan-conditional"], "Ventilators explicitly retained as conditional additional equipment; not a publish-ready family page."],
  "GS03.04": [["plan-families"], "Infusion pumps explicitly covered as a family section."],
  "GS03.05": [["plan-families"], "Laryngoscopes explicitly covered as a family section."],
  "GS03.06": [["plan-families"], "Wheelchairs explicitly covered as a family section."],
  "GS03.08": [["plan-families"], "Fire extinguishers explicitly covered as a family section."],
  "GS03.09": [["plan-conditional"], "Anesthesia equipment explicitly named in the conditional section."],
  "GS03.10": [[], "Suction evidence appears in a generic other-equipment cluster and unresolved list, but no recommended node or cluster need explicitly names suction machines. Raw evidence alone is not a website recommendation."],
  GS04: [["plan-faraday"], "Dedicated MRI room shielding manufacture-and-installation page."],
};
const coverage = mriEvaluation.core.map(core => ({ coreId: core.id, decision: mapping[core.id][0].length ? "covered" : "missed", pageIds: mapping[core.id][0], reason: mapping[core.id][1] }));
const review = {
  ...scoreRecord(draft.websitePlan, mriEvaluation.core, decisions, coverage),
  reviewer: "Codex provisional comparison; NOT practitioner-approved", validationResult: "FAIL",
  runId: run._id, sourceHash: run.sourceHash, answerKeyHash: mriEvaluation.answerKeyHash,
  retainedCorePageConcepts: { count: 2, expected: 14, percentage: 100 * 2 / 14, note: "Separate completeness comparison, not the 75% keep-rate denominator." },
  sourceDiscrepancies: mriEvaluation.discrepancies,
};
await writeFile("artifacts/mri-luna-validation.json", JSON.stringify(validation, null, 2));
await writeFile("artifacts/mri-luna-provisional-review.json", JSON.stringify(review, null, 2));
await writeFile("artifacts/mri-luna-raw-output.json", JSON.stringify(draft, null, 2));
const report = `# Separate Luna attempt — failed validation\n\nRun: ${run._id}\n\nOriginal run j971va29ts7jcx9fnahegwtc3h8g0f8r remains unchanged.\n\nSettings: gpt-6-luna, low reasoning, max_output_tokens 64000.\n\n## Validation\n\nFAIL: ${validation.repeated.length} repeated IDs, ${validation.unknown.length} non-canonical/seed-only IDs, ${validation.omitted.length} omitted canonical IDs, and ${validation.unconfirmedFirstPriority.length} unconfirmed recommendations marked First priority. ${validation.assignedExactlyOnce}/${valid.size} canonical IDs appear exactly once.\n\nRepeated: ${validation.repeated.map(x => x.id).join(", ")}\n\nNon-canonical: ${validation.unknown.join(", ")}\n\nOmitted: ${validation.omitted.join(", ")}\n\n## Provisional page comparison\n\nThis is Codex's assessment of the invalid raw draft, not an official practitioner score or a valid generated result. No decisions were saved as practitioner judgments.\n\nPages kept: **2 of 4 (50.0%) — below the 75% pass line**. Three of four would be needed. About/Contact and three on-page sections/FAQs are excluded.\n\n| Proposed page | Decision | Reason |\n|---|---|---|\n${review.pageDecisions.map(p => `| ${p.label} | ${p.decision} | ${p.reason} |`).join("\n")}\n\nKept standalone Core page concepts versus expected Core pages: **2 of 14 (14.3%)**. This is a completeness comparison; the agreed 75% rule uses proposed scored pages as its denominator.\n\nCore underlying needs mentioned somewhere in the proposed coverage: **12 of 14 (85.7%)**. Supplier/dealer homepage intent and explicit suction-machine coverage are missed. This generous coverage count includes merged and conditional treatments; it does not approve those treatments. The rule requires zero missed Core needs.\n\n| Expected Core need | Coverage | Reason |\n|---|---|---|\n${review.coreDecisions.map(c => `| ${c.label} | ${c.decision} | ${c.reason} |`).join("\n")}\n\n## Checks and next step\n\n24 automated tests, frontend build and Convex TypeScript checks passed; updated development functions deployed successfully. The actual model output failed the separate evidence checks above. No browser or phone verification was performed in this attempt. No production deployment or git commit was made.\n\nNext: enforce exclusive evidence assignment in the output structure, rather than relying only on prose instructions, before another run.\n`;
await writeFile("artifacts/mri-luna-review.md", report);
console.log(JSON.stringify({ validation, summary: { pagesKept: review.pagesKept, proposed: review.pagesProposed, percentage: review.keepPercentage, coreCovered: review.coreNeedsCovered, coreTotal: review.coreNeedsTotal, overall: review.overall } }, null, 2));
