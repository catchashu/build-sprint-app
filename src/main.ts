import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Doc, Id } from "../convex/_generated/dataModel";
import type { ExperimentInput } from "../shared/experiment";
import type { Draft } from "../shared/planning";
import { scoreRecord, type CoreNeed } from "../shared/scoring";

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const client = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
const storageKey = `mri-milestone-first:${import.meta.env.VITE_CONVEX_URL}`;
let current: Doc<"experimentRuns"> | null = null;
let firstId = (new URL(location.href).searchParams.get("firstRun") || localStorage.getItem(storageKey)) as Id<"experimentRuns"> | null;
let lastRevisionId = localStorage.getItem(`${storageKey}:revision`) as Id<"experimentRuns"> | null;
let draft: Draft | null = null;
let coreNeeds: CoreNeed[] = [];
let evaluation: { score: ReturnType<typeof scoreRecord> } | null = null;
let busy = false;
const add = (parent: HTMLElement, tag: string, text: string) => { const node = document.createElement(tag); node.textContent = text; parent.append(node); return node; };

async function work(message: string, task: () => Promise<void>) {
  if (busy) return;
  busy = true; el("error").textContent = ""; el("status").textContent = message;
  document.querySelectorAll<HTMLButtonElement>("button").forEach(button => button.disabled = true);
  try { await task(); }
  catch (cause) {
    const data = cause && typeof cause === "object" && "data" in cause ? cause.data : null;
    el("error").textContent = typeof data === "string" ? data : cause instanceof Error ? cause.message : "Request failed. Saved work is unchanged.";
    el("status").textContent = "";
  } finally {
    busy = false; document.querySelectorAll<HTMLButtonElement>("button").forEach(button => button.disabled = false);
    el<HTMLButtonElement>("load").disabled = firstId !== null;
    el<HTMLButtonElement>("generate").disabled = !current || current.state === "complete" || Boolean(current.rawOutputJson);
  }
}
async function showRun(id: Id<"experimentRuns">) {
  const run = await client.query(api.experimentRuns.get, { id });
  if (!run) throw new Error("Saved run not found. No existing result was replaced.");
  current = run;
  if (run.kind === "first") { firstId = id; localStorage.setItem(storageKey, id); }
  else { lastRevisionId = id; localStorage.setItem(`${storageKey}:revision`, id); }
  const input = JSON.parse(run.inputJson) as ExperimentInput, report = input.importReport;
  el("input-section").hidden = false;
  el("import-report").textContent = `${report.originalNodes} original rows = ${report.reasoningQueries} distinct working queries + ${report.duplicateOccurrences} repeat occurrences + ${report.seedOnly} search-only seeds. ${report.note}`;
  el("business-facts").replaceChildren(); input.businessFacts.forEach(f => add(el("business-facts"), "li", `${f.id}: ${f.field}: ${f.value}`));
  el("evidence-list").replaceChildren(); input.rawNodes.forEach(r => add(el("evidence-list"), "p", `${r.id}: ${r.query} — ${r.sourceType}; ${r.reference}; parent ${r.parentId}; path ${r.path}`));
  el("run-info").textContent = `Run ${id}; ${run.kind}; ${run.state}; attempts ${run.attempt}. Rules ${run.rulesVersion}. ${run.model ?? "Model selected at generation."}`;
  el("generate").textContent = run.kind === "first" ? "Generate first demand map and draft plan" : "Generate saved revised draft";
  el("result-section").hidden = !run.outputJson;
  el("invalid-section").hidden = !run.rawOutputJson || Boolean(run.outputJson);
  el<HTMLTextAreaElement>("invalid-output").value = run.outputJson ? "" : run.rawOutputJson ?? "";
  el("back-first").hidden = run.kind === "first";
  el("back-revision").hidden = !lastRevisionId || id === lastRevisionId;
  if (!run.outputJson || !run.rawOutputJson) { el("status").textContent = run.error ?? "Inputs saved. Ready for generation."; return; }
  draft = JSON.parse(run.rawOutputJson) as Draft;
  el("result-title").textContent = run.kind === "first" ? "Frozen first complete result" : "Revised result — separate from the first run";
  el<HTMLTextAreaElement>("full-output").value = run.outputJson;
  const view = el("result"); view.replaceChildren();
  add(view, "h3", "Limitations and unresolved questions"); draft.limitations.forEach(t => add(view, "p", t));
  draft.unresolved.forEach(g => add(view, "p", `${g.question} (${g.evidenceIds.join(", ")}) ${g.reason}`));
  add(view, "h3", "Provisional demand and product hierarchy");
  const showClusters = (parent: string | null, depth = 0) => {
    for (const g of draft!.clusters.filter(c => c.parentId === parent)) {
      add(view, "h4", `${"↳ ".repeat(depth)}${g.id}: ${g.label} (${g.kind})`);
      add(view, "p", `${g.need} Intent: ${g.intent}. Stage: ${g.stage}. Priority: ${g.priority}. Demand: Insufficient evidence. ${g.rationale}`);
      add(view, "p", `Evidence: ${g.evidenceIds.join(", ")}`);
      g.subIntents.forEach(s => add(view, "p", `${s.label}: ${s.intent} / ${s.stage}; ${s.evidenceIds.join(", ")}`)); showClusters(g.id, depth + 1);
    }
  }; showClusters(null);
  add(view, "h3", "Draft website plan");
  const showPages = (parent: string | null, depth = 0) => {
    for (const p of draft!.websitePlan.filter(p => p.parentId === parent)) {
      add(view, "h4", `${"↳ ".repeat(depth)}${p.id}: ${p.label} (${p.role}; ${p.priority})`);
      add(view, "p", `${p.rationale}${p.needsConfirmation ? " Needs business confirmation." : ""}`);
      add(view, "p", `Supports: ${p.clusterIds.join(", ") || "Business context only"}; business facts: ${p.businessFactIds.join(", ") || "None cited"}.`);
      p.coverage.forEach(t => add(view, "p", t)); showPages(p.id, depth + 1);
    }
  }; showPages(null);
  const record = JSON.parse(await client.query(api.evaluation.get, { runId: id })); evaluation = record; coreNeeds = record.core;
  renderScoring(record.score); el("answer-key").replaceChildren();
  record.discrepancies.forEach((t: string) => add(el("answer-key"), "p", t));
  record.expectedWebsitePlan.forEach((r: Record<string, string>) => add(el("answer-key"), "p", `${r["Page ID"]}: ${r["Page / Content Area"]} — ${r.Criticality}; ${r.Treatment}; ${r["Why Separate / Merged"]}`));
  el("back-first").hidden = run.kind === "first"; el("status").textContent = "Result saved. Practitioner scoring is separate from AI generation.";
}
function labelled(parent: HTMLElement, label: string, id: string, choices?: string[]) {
  const p = add(parent, "p", ""), l = document.createElement("label"); l.htmlFor = id; l.textContent = label; p.append(l, document.createElement("br"));
  const control = document.createElement(choices ? "select" : "input"); control.id = id;
  if (choices) for (const choice of choices) { const option = document.createElement("option"); option.value = choice; option.textContent = choice || "Not reviewed"; control.append(option); }
  p.append(control); return control as HTMLInputElement | HTMLSelectElement;
}
function renderScoring(score: ReturnType<typeof scoreRecord>) {
  el("page-decisions").replaceChildren(); el("core-decisions").replaceChildren();
  for (const p of score.pageDecisions) {
    const group = document.createElement("fieldset"); el("page-decisions").append(group); add(group, "legend", `${p.id}: ${p.label}`);
    labelled(group, "Keep or reject", `decision-${p.id}`, ["", "keep", "reject"]).value = p.decision === "pending" ? "" : p.decision;
    labelled(group, "Reason", `reason-${p.id}`).value = p.decision === "pending" ? "" : p.reason;
  }
  for (const n of score.coreDecisions) {
    const group = document.createElement("fieldset"); el("core-decisions").append(group); add(group, "legend", `${n.id}: ${n.label}`);
    labelled(group, "Covered or completely missed", `core-${n.id}`, ["", "covered", "missed"]).value = n.decision === "pending" ? "" : n.decision;
    labelled(group, "Supporting page IDs, separated by commas", `core-pages-${n.id}`).value = n.pageIds.join(", ");
    labelled(group, "Reason", `core-reason-${n.id}`).value = n.decision === "pending" ? "" : n.reason;
  } showScore(score);
}
function decisions() {
  if (!draft || !evaluation) throw new Error("Generate a draft first.");
  const value = (id: string) => el<HTMLInputElement>(id).value.trim();
  return {
    pages: evaluation.score.pageDecisions.flatMap(p => value(`decision-${p.id}`) ? [{ pageId: p.id, decision: value(`decision-${p.id}`), reason: value(`reason-${p.id}`) }] : []),
    core: coreNeeds.flatMap(n => value(`core-${n.id}`) ? [{ coreId: n.id, decision: value(`core-${n.id}`), pageIds: value(`core-pages-${n.id}`).split(",").map(v => v.trim()).filter(Boolean), reason: value(`core-reason-${n.id}`) }] : []),
  };
}
function showScore(score: ReturnType<typeof scoreRecord>, unsaved = false) {
  el("score-summary").textContent = score.display + (unsaved ? " Unsaved changes." : "");
  el("core-summary").textContent = `Core needs covered: ${score.coreNeedsCovered} of ${score.coreNeedsTotal}; completely missed: ${score.coreNeedsMissed}. Coverage: ${score.coreCoveragePass === null ? "PENDING" : score.coreCoveragePass ? "PASS" : "FAIL"}.`;
  el("overall").textContent = `Overall: ${score.overall}. Both the 75% keep rate and complete Core coverage must pass.`;
}
el("score-form").addEventListener("input", () => {
  if (!draft) return;
  try { const d = decisions(); showScore(scoreRecord(draft.websitePlan, coreNeeds, d.pages, d.core), true); }
  catch {
    el("score-summary").textContent = "Pages kept: review incomplete. Percentage pending — pass line 75%. Unsaved changes.";
    el("core-summary").textContent = "Core coverage: PENDING.";
    el("overall").textContent = "Scoring incomplete: selected decisions need reasons and valid supporting page IDs. Changes are not saved.";
  }
});
el("score-form").addEventListener("submit", event => {
  event.preventDefault(); void work("Saving scoring record…", async () => {
    if (!current) return; const d = decisions();
    current.scoreJson = await client.mutation(api.evaluation.save, { runId: current._id, decisionsJson: JSON.stringify(d.pages), coverageJson: JSON.stringify(d.core) });
    showScore(JSON.parse(current.scoreJson)); el("status").textContent = "Scoring record saved.";
  });
});
el("load").addEventListener("click", () => void work("Loading supplied experiment…", async () => {
  if (!firstId) { firstId = await client.mutation(api.experimentRuns.create, {}); localStorage.setItem(storageKey, firstId); } await showRun(firstId);
}));
el("generate").addEventListener("click", () => void work("Generating from frozen evidence…", async () => {
  if (!current) return; const id = current._id;
  try { await client.action(api.experiment.generate, { runId: id }); } finally { await showRun(id); }
}));
el("correction-form").addEventListener("submit", event => {
  event.preventDefault(); void work("Saving correction as a separate version…", async () => {
    if (!current) return;
    const correction = `${el<HTMLSelectElement>("correction-type").value}: ${el<HTMLTextAreaElement>("correction").value}`;
    const id = await client.mutation(api.evaluation.revise, { runId: current._id, correction }); await showRun(id);
    try { await client.action(api.experiment.generate, { runId: id }); } finally { await showRun(id); }
  });
});
el("back-first").addEventListener("click", () => void work("Opening frozen first result…", async () => { if (firstId) await showRun(firstId); }));
el("back-revision").addEventListener("click", () => void work("Opening saved revised result…", async () => { if (lastRevisionId) await showRun(lastRevisionId); }));
el("download").addEventListener("click", () => {
  if (!current?.outputJson) return;
  const data = { result: JSON.parse(current.outputJson), scoring: current.scoreJson ? JSON.parse(current.scoreJson) : evaluation?.score, frozenSettings: { model: current.model, rules: current.rules, rulesVersion: current.rulesVersion, sourceHash: current.sourceHash }, history: current.history };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = `mri-${current.kind}-${current._id}.json`; a.click(); URL.revokeObjectURL(url);
});
if (firstId) void work("Restoring saved experiment…", () => showRun(firstId!));
