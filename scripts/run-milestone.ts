import { readFile, mkdir, writeFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const env = await readFile(".env.local", "utf8");
const url = env.match(/^(?:VITE_)?CONVEX_URL=(.+)$/m)?.[1].trim().replace(/^['"]|['"]$/g, "");
if (!url) throw new Error("Run npx convex dev --once first.");
const client = new ConvexHttpClient(url);
const outputFolder = new URL("../artifacts/", import.meta.url);
await mkdir(outputFolder, { recursive: true });
const receiptPath = new URL("mri-experiment-receipt.json", outputFolder);
try {
  let runId: Id<"experimentRuns">;
  try {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    if (receipt.deployment !== url) throw new Error("Receipt belongs to another deployment.");
    runId = receipt.runId;
  } catch (cause) {
    if (!(cause && typeof cause === "object" && "code" in cause && cause.code === "ENOENT")) throw cause;
    runId = await client.mutation(api.experimentRuns.create, {});
    await writeFile(receiptPath, JSON.stringify({ runId, deployment: url }, null, 2));
  }
  console.log(`Frozen run: ${runId}. Re-running this command resumes the same run; it never silently creates a better first response.`);
  console.log(`Review this same run at http://localhost:5173/?firstRun=${runId} (with npm run dev running).`);
  const run = await client.query(api.experimentRuns.get, { id: runId });
  if (!run) throw new Error("Saved run not found.");
  const input = JSON.parse(run.inputJson);
  await writeFile(new URL("mri-import-report.json", outputFolder), JSON.stringify(input.importReport, null, 2));
  console.log(JSON.stringify(input.importReport, null, 2));
  if (process.argv.includes("--import-only")) { console.log("Import verified. No AI call made."); process.exit(0); }
  const output = await client.action(api.experiment.generate, { runId });
  await writeFile(new URL("mri-full-output.json", outputFolder), output);
  const evaluation = JSON.parse(await client.query(api.evaluation.get, { runId }));
  await writeFile(new URL("mri-scoring-record.json", outputFolder), JSON.stringify(evaluation.score, null, 2));
  console.log(output);
  console.log(JSON.stringify(evaluation.score, null, 2));
} catch (cause) {
  const data = cause && typeof cause === "object" && "data" in cause ? cause.data : null;
  console.error(typeof data === "string" ? data : cause instanceof Error ? cause.message : "Run failed. Saved inputs unchanged; no result invented.");
  process.exitCode = 1;
}
