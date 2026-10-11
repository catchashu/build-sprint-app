import { v } from "convex/values";
export const runFields = {
  inputJson: v.string(), sourceHash: v.string(), rules: v.string(), rulesVersion: v.string(), prompt: v.string(),
  kind: v.union(v.literal("first"), v.literal("revised")), parentRunId: v.union(v.id("experimentRuns"), v.null()), correction: v.string(),
  state: v.union(v.literal("ready"), v.literal("running"), v.literal("complete"), v.literal("failed")),
  attempt: v.number(), startedAt: v.optional(v.number()), model: v.optional(v.string()),
  settingsJson: v.optional(v.string()),
  workflowId: v.optional(v.string()),
  rawOutputJson: v.optional(v.string()), outputJson: v.optional(v.string()), error: v.optional(v.string()),
  scoreJson: v.optional(v.string()), history: v.array(v.object({ at: v.number(), message: v.string() })),
};
export const runDoc = v.object({ ...runFields, _id: v.id("experimentRuns"), _creationTime: v.number() });
