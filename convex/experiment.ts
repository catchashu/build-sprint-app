import { action } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { Agent } from "@convex-dev/agent";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { createOpenAI } from "@ai-sdk/openai";
import { Output } from "ai";
import { draftSchema, validateDraft, fullResult, MODEL_ID, GENERATION_SETTINGS } from "../shared/planning";
import type { ExperimentInput } from "../shared/experiment";

export const generate = action({
  args: { runId: v.id("experimentRuns") }, returns: v.string(),
  handler: async (ctx, { runId }): Promise<string> => {
    const key = process.env.OPENAI_API_KEY;
    const provider = key ? "OpenAI" : "Convex AI Gateway";
    const run = await ctx.runMutation(internal.experimentRuns.begin, { id: runId, model: `${provider}/${MODEL_ID}` });
    if (run.outputJson) return run.outputJson;
    const model = key ? createOpenAI({ apiKey: key })(MODEL_ID) : convexGateway(`openai/${MODEL_ID}`);
    const agent = new Agent(components.agent, { name: "Milestone 1 evidence planner", languageModel: model, instructions: run.rules });
    let raw: unknown;
    try {
      const { thread } = await agent.createThread(ctx);
      const response = await thread.generateText({ prompt: run.prompt, output: Output.object({ schema: draftSchema }), maxOutputTokens: GENERATION_SETTINGS.maxOutputTokens, providerOptions: { openai: { reasoningEffort: GENERATION_SETTINGS.reasoningEffort } }, maxRetries: 0 });
      raw = response.output;
    } catch (cause) {
      // Preserve a completed response that failed JSON/schema validation, without exposing request metadata.
      const completedText = cause && typeof cause === "object" && "text" in cause && typeof cause.text === "string" ? cause.text : undefined;
      const error = completedText ? "The first response failed structured-output validation and is frozen for inspection." : key
        ? "AI call failed. Check the OpenAI key, billing and model access in Convex. No complete output was received."
        : "Convex AI access is unavailable. Enable its AI Gateway, or run npx convex env set OPENAI_API_KEY and enter the key in your terminal.";
      await ctx.runMutation(internal.experimentRuns.finish, { id: runId, attempt: run.attempt, error, ...(completedText ? { rawOutputJson: JSON.stringify({ invalidResponseText: completedText }) } : {}) });
      throw new ConvexError(error);
    }
    const rawOutputJson = JSON.stringify(raw);
    let outputJson: string;
    try {
      const input = JSON.parse(run.inputJson) as ExperimentInput;
      const draft = validateDraft(raw, input);
      outputJson = JSON.stringify({
        runId, kind: run.kind, parentRunId: run.parentRunId, correction: run.correction,
        model: run.model, rulesVersion: run.rulesVersion, generatedAt: new Date().toISOString(),
        evaluationNote: "New rules-informed evaluation. Human scoring pending; not a repeat of the original blind test.",
        ...fullResult(draft, input),
      }, null, 2);
    } catch (cause) {
      const error = `First response failed the evidence checks: ${cause instanceof Error ? cause.message.slice(0, 350) : "Invalid output"}. Saved for inspection; no passing result claimed.`;
      await ctx.runMutation(internal.experimentRuns.finish, { id: runId, attempt: run.attempt, rawOutputJson, error });
      throw new ConvexError(error);
    }
    await ctx.runMutation(internal.experimentRuns.finish, { id: runId, attempt: run.attempt, rawOutputJson, outputJson });
    return outputJson;
  },
});
