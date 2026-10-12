import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { runFields } from "./runFields";

export default defineSchema({
  firstValueRuns: defineTable({
    token: v.string(), offering: v.string(), context: v.string(), state: v.string(), searchCount: v.number(),
    searches: v.array(v.object({ query: v.string(), status: v.string(), error: v.optional(v.string()) })),
    seeds: v.optional(v.array(v.string())), responses: v.array(v.string()), batches: v.array(v.string()),
    merge: v.optional(v.string()), cards: v.optional(v.string()), error: v.optional(v.string()), workflowId: v.optional(v.string()),
    failureKind: v.optional(v.union(v.literal("search"), v.literal("insufficient"), v.literal("build"))),
    reviewJson: v.optional(v.string()), reviewPending: v.optional(v.id("cardCorrections")), reviewLast: v.optional(v.id("cardCorrections")), understandingJson: v.optional(v.string()),
    unlock: v.optional(v.object({ via: v.union(v.literal("comped"), v.literal("test"), v.literal("paid")), at: v.number(), understandingJson: v.string(), reviewJson: v.optional(v.string()), paymentId: v.optional(v.string()) })),
    inviteAttempts: v.optional(v.number()), inviteWindow: v.optional(v.number()),
  }),
  paymentOrders: defineTable({ runId: v.id("firstValueRuns"), state: v.union(v.literal("creating"), v.literal("ready"), v.literal("error")), attemptId: v.string(), startedAt: v.number(), orderId: v.optional(v.string()), keyId: v.string(), understandingJson: v.string(), reviewJson: v.string() }).index("by_run", ["runId"]).index("by_order", ["orderId"]),
  cardCorrections: defineTable({ runId: v.id("firstValueRuns"), cardId: v.string(), kind: v.union(v.literal("label"), v.literal("other"), v.literal("split"), v.literal("merge")), queryIds: v.optional(v.array(v.string())), targetCardId: v.optional(v.string()), note: v.string(), revision: v.number(), requestId: v.string(), state: v.string(), resultJson: v.optional(v.string()), error: v.optional(v.string()) }).index("by_run_request", ["runId", "requestId"]),
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
