import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { runDoc } from "./runFields";
import { mriInput } from "./fixtures/mriInput";
import type { ExperimentInput } from "../shared/experiment";
import { generationPrompt, PLANNING_RULES, RULES_VERSION, GENERATION_SETTINGS } from "../shared/planning";
import { BATCH_SETTINGS, BATCH_RULES, BATCH_RULES_VERSION } from "../shared/batchedPlanning";

export const create = mutation({
  args: { parentRunId: v.optional(v.id("experimentRuns")), pipeline: v.optional(v.literal("batched-v1")) }, returns: v.id("experimentRuns"),
  handler: async (ctx, { parentRunId, pipeline }) => {
    const parent = parentRunId ? await ctx.db.get(parentRunId) : null;
    if (parentRunId && !parent?.rawOutputJson) throw new ConvexError("A separate attempt requires a saved original response.");
    const input = parent ? JSON.parse(parent.inputJson) as ExperimentInput : mriInput as ExperimentInput;
    return ctx.db.insert("experimentRuns", {
      inputJson: JSON.stringify(input), sourceHash: input.sourceHash, rules: pipeline ? BATCH_RULES : PLANNING_RULES, rulesVersion: pipeline ? BATCH_RULES_VERSION : RULES_VERSION,
      prompt: generationPrompt(input), kind: parent ? "revised" : "first", parentRunId: parentRunId ?? null,
      correction: parent ? "Separate attempt: exclusive evidence ownership instructions and revised model settings; no previous output or answer key supplied." : "",
      settingsJson: JSON.stringify(pipeline ? BATCH_SETTINGS : GENERATION_SETTINGS),
      state: "ready", attempt: 0, history: [],
    });
  },
});
export const get = query({ args: { id: v.id("experimentRuns") }, returns: v.union(runDoc, v.null()), handler: (ctx, { id }) => ctx.db.get(id) });
export const read = internalQuery({ args: { id: v.id("experimentRuns") }, returns: v.union(runDoc, v.null()), handler: (ctx, { id }) => ctx.db.get(id) });
export const begin = internalMutation({
  args: { id: v.id("experimentRuns"), model: v.string() }, returns: runDoc,
  handler: async (ctx, { id, model }) => {
    const run = await ctx.db.get(id);
    if (!run) throw new ConvexError("Run not found.");
    if (run.state === "complete") return run;
    if (run.rawOutputJson) throw new ConvexError("The first complete response is frozen, including its validation failure. It cannot be replaced by a better retry.");
    if (run.state === "running" && Date.now() - (run.startedAt ?? 0) < 600_000) throw new ConvexError("This run is already generating. Wait before retrying.");
    if (run.model && run.model.split("/").at(-1) !== model.split("/").at(-1)) throw new ConvexError("This run's model is frozen. Restore the same model before retrying.");
    const patch = { state: "running" as const, attempt: run.attempt + 1, startedAt: Date.now(), model,
      history: [...run.history, { at: Date.now(), message: `Generation attempt through ${model}; evidence and prompt unchanged.` }] };
    await ctx.db.patch(id, patch);
    return { ...run, ...patch };
  },
});
export const finish = internalMutation({
  args: { id: v.id("experimentRuns"), attempt: v.number(), rawOutputJson: v.optional(v.string()), outputJson: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, attempt, rawOutputJson, outputJson, error }) => {
    const run = await ctx.db.get(id);
    if (!run || run.attempt !== attempt || run.state !== "running") throw new ConvexError("Stale generation response; saved run was not overwritten.");
    await ctx.db.patch(id, {
      state: outputJson ? "complete" : "failed",
      ...(rawOutputJson ? { rawOutputJson } : {}), ...(outputJson ? { outputJson } : {}), ...(error ? { error } : {}),
      history: [...run.history, { at: Date.now(), message: outputJson ? "First complete response saved and validated." : error ?? "Generation failed." }],
    });
    return null;
  },
});
