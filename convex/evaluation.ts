// Answer-key data stays in this evaluation module, never in the generation prompt.
import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { mriEvaluation } from "./fixtures/mriEvaluation";
import { draftSchema, generationPrompt } from "../shared/planning";
import { scoreRecord } from "../shared/scoring";
import type { ExperimentInput } from "../shared/experiment";

export const get = query({
  args: { runId: v.id("experimentRuns") }, returns: v.string(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run?.outputJson || !run.rawOutputJson) throw new ConvexError("Generate and freeze the first response before opening the answer key.");
    const draft = draftSchema.parse(JSON.parse(run.rawOutputJson));
    return JSON.stringify({ ...mriEvaluation, runId, kind: run.kind,
      score: run.scoreJson ? JSON.parse(run.scoreJson) : scoreRecord(draft.websitePlan, mriEvaluation.core, [], []) });
  },
});
export const save = mutation({
  args: { runId: v.id("experimentRuns"), decisionsJson: v.string(), coverageJson: v.string() }, returns: v.string(),
  handler: async (ctx, { runId, decisionsJson, coverageJson }) => {
    const run = await ctx.db.get(runId);
    if (!run?.outputJson || !run.rawOutputJson) throw new ConvexError("No validated draft to score.");
    try {
      const draft = draftSchema.parse(JSON.parse(run.rawOutputJson));
      const score = { ...scoreRecord(draft.websitePlan, mriEvaluation.core, JSON.parse(decisionsJson), JSON.parse(coverageJson)),
        runId, kind: run.kind, answerKeyHash: mriEvaluation.answerKeyHash, sourceHash: run.sourceHash, scoredAt: new Date().toISOString(), reviewer: "Practitioner", sourceDiscrepancies: mriEvaluation.discrepancies };
      const scoreJson = JSON.stringify(score, null, 2);
      await ctx.db.patch(runId, { scoreJson, history: [...run.history, { at: Date.now(), message: score.display }] });
      return scoreJson;
    } catch { throw new ConvexError("Scoring was not saved. Every selected decision needs a reason; covered Core needs must name valid supporting page IDs."); }
  },
});
export const revise = mutation({
  args: { runId: v.id("experimentRuns"), correction: v.string() }, returns: v.id("experimentRuns"),
  handler: async (ctx, { runId, correction }) => {
    const run = await ctx.db.get(runId);
    if (!run?.outputJson || !run.rawOutputJson) throw new ConvexError("Generate the first draft before revising it.");
    if (!run.scoreJson || JSON.parse(run.scoreJson).overall === "PENDING") throw new ConvexError("Finish the saved draft's scoring before creating a revised version. The first score must stay separate.");
    if (!correction.trim() || correction.length > 6000) throw new ConvexError("Describe the merge, split, placement or page/section correction (up to 6,000 characters).");
    const input = JSON.parse(run.inputJson) as ExperimentInput;
    const prior = draftSchema.parse(JSON.parse(run.rawOutputJson));
    return ctx.db.insert("experimentRuns", {
      inputJson: run.inputJson, sourceHash: run.sourceHash, rules: run.rules, rulesVersion: run.rulesVersion,
      prompt: generationPrompt(input, prior, correction.trim()), kind: "revised", parentRunId: runId, correction: correction.trim(),
      state: "ready", attempt: 0, history: [],
    });
  },
});
