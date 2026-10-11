import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { importExperiment, neutralBusinessContext, csvTable } from "../shared/experiment.ts";

const folder = new URL("../clustering logic/", import.meta.url);
const names = await readdir(folder);
const source = async (suffix: string) => {
  const name = names.find(name => name.endsWith(suffix));
  if (!name) throw new Error(`Missing source: ${suffix}`);
  return readFile(new URL(name, folder), "utf8");
};
const raw = await source("1 Raw Search Tree.csv");
const context = await source("6 Business Context.csv"), seeds = await source("7 Seed Backlog.csv");
const sourceHash = createHash("sha256").update(raw).update(context).update(seeds).digest("hex");
const fixture = { ...importExperiment(raw), businessFacts: neutralBusinessContext(context, seeds), sourceHash };
const websiteCsv = await source("4 Website Plan.csv"), goldCsv = await source("3 Expert Gold Standard.csv");
const expected = csvTable(websiteCsv, "Page ID").filter(row => /^GS/.test(row["Page ID"]));
const evaluation = {
  core: expected.filter(row => row.Criticality === "Core").map(row => ({ id: row["Page ID"], label: row["Page / Content Area"] })),
  expectedWebsitePlan: expected,
  goldStandard: csvTable(goldCsv, "Query / Group"),
  answerKeyHash: createHash("sha256").update(websiteCsv).update(goldCsv).digest("hex"),
  discrepancies: [
    "Gold-standard stretcher references point to extinguisher nodes. Website Plan GS03.07 correctly points to N288/N291. Original sources unchanged.",
    "Gold-standard suction-machine row is unfinished. Final Website Plan GS03.10 explicitly marks it Core.",
    "Some older compatibility-FAQ notes conflict with the final removal rule. Use the final rule; preserve older source text for inspection.",
    "Some gold-standard references mix other products or excluded queries. Judge by the stated need and actual raw query, not node-list membership alone.",
    "Earlier Open/Not searched statuses are historical. Final collection is frozen.",
    "Original full model responses and per-page scores are absent. Historical aggregate scores cannot be independently reconstructed.",
  ],
};
const out = new URL("../convex/fixtures/", import.meta.url); await mkdir(out, { recursive: true });
await writeFile(new URL("mriInput.ts", out), `// Generated from unchanged supplied CSVs. Generation inputs only.\nexport const mriInput = ${JSON.stringify(fixture)};\n`);
await writeFile(new URL("mriEvaluation.ts", out), `// Evaluation only. Never import into the generation module or its prompt.\nexport const mriEvaluation = ${JSON.stringify(evaluation)};\n`);
console.log(JSON.stringify({ ...fixture.importReport, businessFacts: fixture.businessFacts.length, coreNeeds: evaluation.core.length, sourceHash }, null, 2));
