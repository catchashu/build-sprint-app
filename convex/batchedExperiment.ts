import { z } from "zod";
import { v, ConvexError } from "convex/values";
import { WorkflowManager, start as startWorkflow } from "@convex-dev/workflow";
import { Agent } from "@convex-dev/agent";
import { createOpenAI } from "@ai-sdk/openai";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { Output } from "ai";
import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { BATCH_SETTINGS, BATCH_RULES_VERSION, evidenceBatches, assignmentSchema, batchPrompt, collectBatches, groupSummaries, consolidationSchema, consolidate, architectureSchema, assembleDraft } from "../shared/batchedPlanning";
import { fullResult } from "../shared/planning";
import type { ExperimentInput } from "../shared/experiment";

const workflow = new WorkflowManager(components.workflow, { workpoolOptions: { retryActionsByDefault: false } });
export const start = mutation({
  args: { runId: v.id("experimentRuns") }, returns: v.string(),
  handler: async (ctx, { runId }): Promise<string> => {
    const run = await ctx.db.get(runId);
    if (!run || run.rulesVersion !== BATCH_RULES_VERSION || run.settingsJson !== JSON.stringify(BATCH_SETTINGS)) throw new ConvexError("Create a new batched run with frozen current settings.");
    if (run.state !== "ready" || run.attempt !== 0 || run.workflowId) throw new ConvexError("This run already started. No model calls will be repeated.");
    const count = evidenceBatches(JSON.parse(run.inputJson)).length;
    const provider = process.env.OPENAI_API_KEY ? "OpenAI" : "Convex AI Gateway";
    const workflowId = await startWorkflow(ctx, internal.batchedExperiment.pipeline, { runId, count });
    await ctx.db.patch(runId, { state: "running", attempt: 1, startedAt: Date.now(), workflowId,
      model: `${provider}/${BATCH_SETTINGS.model}`, history: [...run.history, { at: Date.now(), message: `Started one batched attempt: ${count} query batches, consolidation, architecture; medium reasoning; retries disabled.` }] });
    return workflowId;
  },
});
export const pipeline = workflow.define({ args: { runId: v.id("experimentRuns"), count: v.number() }, returns: v.null() })
  .handler(async (step, { runId, count }): Promise<null> => {
    try {
      for (let index = 0; index < count + 2; index++) await step.runAction(internal.batchedExperiment.generateStep, { runId, index }, { retry: false });
      await step.runMutation(internal.batchedExperiment.finalize, { runId });
    } catch {
      await step.runMutation(internal.batchedExperiment.fail, { runId });
    }
    return null;
  });
export const readSteps = internalQuery({
  args: { runId: v.id("experimentRuns") }, returns: v.string(),
  handler: async (ctx, { runId }) => JSON.stringify(await ctx.db.query("experimentSteps").withIndex("by_run_step", q => q.eq("runId", runId)).take(12)),
});
export const exportSteps = query({
  args: { runId: v.id("experimentRuns") }, returns: v.string(),
  handler: async (ctx, { runId }) => JSON.stringify(await ctx.db.query("experimentSteps").withIndex("by_run_step", q => q.eq("runId", runId)).take(12)),
});
export const reserve = internalMutation({
  args: { runId: v.id("experimentRuns"), index: v.number(), requestJson: v.string() }, returns: v.id("experimentSteps"),
  handler: async (ctx, { runId, index, requestJson }) => {
    const run = await ctx.db.get(runId);
    if (run?.state !== "running") throw new ConvexError("Run is not active.");
    const existing = await ctx.db.query("experimentSteps").withIndex("by_run_step", q => q.eq("runId", runId).eq("step", index)).unique();
    if (existing) throw new ConvexError("This model step has already been attempted; retries are disabled.");
    return ctx.db.insert("experimentSteps", { runId, step: index, state: "running", requestJson });
  },
});
export const saveStep = internalMutation({
  args: { id: v.id("experimentSteps"), rawJson: v.optional(v.string()), usageJson: v.optional(v.string()), error: v.optional(v.string()) }, returns: v.null(),
  handler: async (ctx, { id, ...result }) => {
    const saved = await ctx.db.get(id);
    if (!saved || saved.state !== "running") throw new ConvexError("Saved step cannot be overwritten.");
    await ctx.db.patch(id, { ...result, state: result.error ? "failed" : "complete" });
    const run = await ctx.db.get(saved.runId);
    if (run) await ctx.db.patch(saved.runId, { history: [...run.history, { at: Date.now(), message: `Step ${saved.step + 1}: ${result.error ?? "saved and schema-validated"}` }] });
    return null;
  },
});
type SavedStep = { step: number; state: string; rawJson?: string; error?: string };
function priorResults(steps: SavedStep[], count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => {
    const saved = steps.find(s => s.step === i);
    if (saved?.state !== "complete" || !saved.rawJson) throw new Error(`Step ${i + 1} is incomplete.`);
    return JSON.parse(saved.rawJson);
  });
}
export const generateStep = internalAction({
  args: { runId: v.id("experimentRuns"), index: v.number() }, returns: v.null(),
  handler: async (ctx, { runId, index }): Promise<null> => {
    const run = await ctx.runQuery(internal.experimentRuns.read, { id: runId });
    if (!run || run.state !== "running" || run.settingsJson !== JSON.stringify(BATCH_SETTINGS)) throw new Error("Run/settings mismatch.");
    const input: ExperimentInput = JSON.parse(run.inputJson), batches = evidenceBatches(input);
    const steps: SavedStep[] = JSON.parse(await ctx.runQuery(internal.batchedExperiment.readSteps, { runId }));
    let schema: z.ZodType, prompt: string;
    if (index < batches.length) {
      schema = assignmentSchema(batches[index]); prompt = batchPrompt(input, batches[index], index);
    } else {
      const batchesOutput = priorResults(steps, batches.length);
      const local = collectBatches(input, batchesOutput);
      if (index === batches.length) {
        schema = consolidationSchema(local.groups);
        prompt = JSON.stringify({ stage: "Consolidate synonymous underlying needs across batches", businessFacts: input.businessFacts, market: input.market,
          instruction: "Every input group must choose exactly one target group key. Groups with the same underlying need choose the SAME target key. Keys are bucket names, not pointers to follow recursively. Preserve separate complete product families and separate general knowledge from a training service. Do not merge unrelated products because they share a use or because their query branches are small. Do not change relevance decisions or build pages in this step.", groups: groupSummaries(local.groups) });
      } else if (index === batches.length + 1) {
        const merge = priorResults(steps, batches.length + 1).at(-1);
        const merged = consolidate(input, batchesOutput, merge);
        schema = architectureSchema(merged.groups, input);
        prompt = JSON.stringify({ stage: "Build the global demand hierarchy and website plan", market: input.market, businessFacts: input.businessFacts,
          instruction: "Describe EVERY supplied cluster key. Evidence ownership is frozen in code; do not return any evidence IDs. Choose hierarchy and page/section/FAQ/resource treatment globally. Preserve distinct complete product families; limited fan-out is not a reason to downgrade a machine to an accessory. A query's product-family relevance does not confirm stocked brands/models. Product-detail pages require a matching confirmed business fact or needsConfirmation. First priority is unavailable for unconfirmed recommendations. Parent IDs must exist, never self-reference, and never form cycles. Recommendations may share cluster keys. Explain consequential merges and splits. Give actual website coverage, not lists of business fact IDs. No search volumes are available.",
          groups: groupSummaries(merged.groups),
          unresolved: merged.unresolved.map(u => ({ reason: u.reason, question: u.question })),
          datasetLimitations: input.importReport.note });
      } else throw new Error("Unknown pipeline step.");
    }
    const requestJson = JSON.stringify({ settings: BATCH_SETTINGS, rules: run.rules, prompt: JSON.parse(prompt), schema: z.toJSONSchema(schema) });
    const stepId = await ctx.runMutation(internal.batchedExperiment.reserve, { runId, index, requestJson });
    let rawJson: string | undefined;
    try {
      const key = process.env.OPENAI_API_KEY;
      const languageModel = key ? createOpenAI({ apiKey: key }).responses(BATCH_SETTINGS.model) : convexGateway(`openai/${BATCH_SETTINGS.model}`);
      const agent = new Agent(components.agent, { name: "Batched evidence planner", languageModel, instructions: run.rules });
      const { thread } = await agent.createThread(ctx);
      const result = await thread.generateText({ prompt, output: Output.object({ schema }),
        maxOutputTokens: BATCH_SETTINGS.maxOutputTokens, maxRetries: 0,
        providerOptions: { openai: { reasoningEffort: BATCH_SETTINGS.reasoningEffort, strictJsonSchema: true } } });
      rawJson = result.text;
      schema.parse(result.output);
      await ctx.runMutation(internal.batchedExperiment.saveStep, { id: stepId, rawJson: JSON.stringify(result.output), usageJson: JSON.stringify(result.usage) });
    } catch (cause) {
      const completedText = rawJson ?? (cause && typeof cause === "object" && "text" in cause && typeof cause.text === "string" ? cause.text : undefined);
      const error = cause instanceof Error ? cause.message.slice(0, 800) : "Model step failed.";
      await ctx.runMutation(internal.batchedExperiment.saveStep, { id: stepId, ...(completedText ? { rawJson: completedText } : {}), error });
      throw new Error(`Step ${index + 1} failed; saved without retry.`);
    }
    return null;
  },
});
export const finalize = internalMutation({
  args: { runId: v.id("experimentRuns") }, returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.state !== "running" || run.rawOutputJson) throw new Error("Run cannot be overwritten.");
    const input: ExperimentInput = JSON.parse(run.inputJson), count = evidenceBatches(input).length;
    const steps = await ctx.db.query("experimentSteps").withIndex("by_run_step", q => q.eq("runId", runId)).take(12);
    const outputs = priorResults(steps, count + 2);
    const draft = assembleDraft(input, outputs.slice(0, count), outputs[count], outputs[count + 1]);
    const outputJson = JSON.stringify({ runId, kind: run.kind, parentRunId: run.parentRunId, model: run.model,
      rulesVersion: run.rulesVersion, settings: BATCH_SETTINGS, generatedAt: new Date().toISOString(),
      evaluationNote: "Separate batched attempt; human review pending; earlier runs unchanged.", ...fullResult(draft, input) }, null, 2);
    await ctx.db.patch(runId, { rawOutputJson: JSON.stringify(draft), outputJson, state: "complete",
      history: [...run.history, { at: Date.now(), message: "All batch assignments merged in code. Full draft passed validation." }] });
    return null;
  },
});
export const fail = internalMutation({
  args: { runId: v.id("experimentRuns") }, returns: v.null(),
  handler: async (ctx, { runId }) => {
    const run = await ctx.db.get(runId);
    if (!run || run.state !== "running") return null;
    await ctx.db.patch(runId, { state: "failed", error: "Batched attempt failed. All completed step outputs are preserved; no automatic retry or repaired result substituted.",
      history: [...run.history, { at: Date.now(), message: "Batched attempt failed; inspect saved steps." }] });
    return null;
  },
});
