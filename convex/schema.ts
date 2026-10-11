import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { runFields } from "./runFields";

export default defineSchema({
  firstValueRuns: defineTable({
    token: v.string(), offering: v.string(), context: v.string(), state: v.string(), searchCount: v.number(),
    searches: v.array(v.object({ query: v.string(), status: v.string(), error: v.optional(v.string()) })),
    seeds: v.optional(v.array(v.string())), responses: v.array(v.string()), batches: v.array(v.string()),
    merge: v.optional(v.string()), cards: v.optional(v.string()), error: v.optional(v.string()), workflowId: v.optional(v.string()),
  }),
  experimentRuns: defineTable(runFields),
  experimentSteps: defineTable({
    runId: v.id("experimentRuns"), step: v.number(), state: v.union(v.literal("running"), v.literal("complete"), v.literal("failed")),
    requestJson: v.string(), rawJson: v.optional(v.string()), usageJson: v.optional(v.string()), error: v.optional(v.string()),
  }).index("by_run_step", ["runId", "step"]),
  researchInputs: defineTable({
    context: v.string(), evidenceJson: v.string(), source: v.string(),
    researchRequests: v.array(v.string()), rawEvidenceJson: v.string(),
  }),
});
