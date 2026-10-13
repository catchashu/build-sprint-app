import { v, ConvexError } from 'convex/values';
import { WorkflowManager, start as startWorkflow } from '@convex-dev/workflow';
import { Agent } from '@convex-dev/agent';
import { createOpenAI } from '@ai-sdk/openai';
import { Output } from 'ai';
import { query, mutation, internalQuery, internalMutation, internalAction } from './_generated/server';
import type { QueryCtx, MutationCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';
import { internal, components } from './_generated/api';
import { PLAN_RULES, groundedPlanSchema, validateWebsitePlan, retainedCards, type PlanInput } from '../shared/websitePlan';
import { BATCH_SETTINGS } from '../shared/batchedPlanning';
import {readVolumes} from '../shared/searchVolume';
const identity = { id: v.id('firstValueRuns'), token: v.string() };
const workflow = new WorkflowManager(components.workflow, { workpoolOptions: { retryActionsByDefault: false } });
async function authorized(ctx: QueryCtx, id: Id<'firstValueRuns'>, token: string) {
  const source = await ctx.db.get(id);
  if (!source || source.token !== token || !source.unlock) throw new ConvexError('Open your unlocked run to continue.');
  const map = await ctx.db.query('fullResearchRuns').withIndex('by_run', q => q.eq('runId', id)).unique();
  if (!map || map.state !== 'complete' || !map.reviewJson) throw new ConvexError('Finish your demand map first.');
  return map;
}
async function latest(ctx: QueryCtx, id: Id<'firstValueRuns'>) {
  return ctx.db.query('websitePlans').withIndex('by_run', q => q.eq('runId', id)).order('desc').first();
}
function snapshot(map: NonNullable<Awaited<ReturnType<typeof authorized>>>): PlanInput {
  const review = JSON.parse(map.reviewJson!);
  const questions = JSON.parse(map.questionsJson ?? '[]'), answers = JSON.parse(map.answersJson ?? '[]');
  if (!review.accepted || map.reviewPending || !map.understandingJson || questions.some((q: {id:string}) => !answers.some((a: {questionId:string}) => a.questionId === q.id))) throw new ConvexError('Confirm your demand map and answer its questions before building the website plan.');
  return { offering: map.offering, context: map.context, review, questions, answers, unresolved: JSON.parse(map.mapJson ?? '{}').unresolved ?? [], clarifications: [], volumes:readVolumes(map.volumeJson) };
}
export const get = query({ args: identity, returns: v.any(), handler: async (ctx, { id, token }) => {
  const map = await authorized(ctx, id, token), plan = await latest(ctx, id);
  const review = JSON.parse(map.reviewJson!);
  if (!review.accepted || map.reviewPending || !map.understandingJson) return { state: 'review_required' };
  if (!plan || plan.mapRevision !== review.revision) return { state: 'ready' };
  const input: PlanInput = JSON.parse(plan.inputJson);
  return { id: plan._id, state: plan.state, error: plan.error ?? null,
    plan: plan.planJson ? JSON.parse(plan.planJson) : plan.previousPlanJson ? JSON.parse(plan.previousPlanJson) : null,
    question: plan.state === 'clarification' && plan.rawJson ? JSON.parse(plan.rawJson).question : null,
    cards: retainedCards(input), offering: input.offering, mapRevision: plan.mapRevision, volumes:readVolumes(map.volumeJson), volumeState:map.volumeState??null };
} });
export async function reservePlan(ctx: MutationCtx, args: { id: Id<'firstValueRuns'>; token: string; expectedId?: Id<'websitePlans'>; selectedNodeId?: string; correction?: string; answer?: string }) {
  const map = await authorized(ctx, args.id, args.token), input = snapshot(map), previous = await latest(ctx, args.id);
  const same = previous?.mapRevision === input.review.revision;
  if (args.expectedId && (!same || previous?._id !== args.expectedId)) throw new ConvexError('The saved plan changed. Reopen it before trying again.');
  if (same && previous && ['generating', 'checking'].includes(previous.state)) return { planId: previous._id, run: false };
  if (same && previous && !args.correction && !args.answer) {
    if (previous.state !== 'failed') return { planId: previous._id, run: false };
    await ctx.db.patch(previous._id, { state: 'generating', error: undefined, rawJson: undefined });
    return { planId: previous._id, run: true };
  }
  let previousPlanJson: string | undefined, selectedNodeId: string | undefined, correction: string | undefined;
  if (args.correction !== undefined) {
    if (!same || previous?.state !== 'complete' || !previous.planJson || !args.expectedId || !args.correction.trim() || args.correction.length > 2000) throw new ConvexError('Open a completed plan and describe the correction in up to 2,000 characters.');
    if (!JSON.parse(previous.planJson).nodes.some((n: {id:string}) => n.id === args.selectedNodeId)) throw new ConvexError('Choose an existing recommendation.');
    previousPlanJson = previous.planJson; selectedNodeId = args.selectedNodeId; correction = args.correction.trim();
    input.clarifications = JSON.parse(previous.inputJson).clarifications;
  } else if (args.answer !== undefined) {
    if (!same || previous?.state !== 'clarification' || !args.expectedId || !args.answer.trim() || args.answer.length > 2000) throw new ConvexError('Answer the pending question in up to 2,000 characters.');
    input.clarifications = [...JSON.parse(previous.inputJson).clarifications, { question: JSON.parse(previous.rawJson!).question, answer: args.answer.trim() }];
    previousPlanJson = previous.previousPlanJson; selectedNodeId = previous.selectedNodeId; correction = previous.correction;
  }
  const planId = await ctx.db.insert('websitePlans', { runId: args.id, mapRevision: input.review.revision, inputJson: JSON.stringify(input), state: 'generating',
    ...(previousPlanJson ? { previousPlanJson } : {}), ...(selectedNodeId ? { selectedNodeId } : {}), ...(correction ? { correction } : {}) });
  return { planId, run: true };
}
const startArgs = { ...identity, expectedId: v.optional(v.id('websitePlans')), selectedNodeId: v.optional(v.string()), correction: v.optional(v.string()), answer: v.optional(v.string()) };
export const reserve = internalMutation({ args: startArgs, returns: v.any(), handler: reservePlan });
export const start = mutation({ args: startArgs, returns: v.null(), handler: async (ctx, args) => {
  const job = await reservePlan(ctx, args);
  if (job.run) { const workflowId = await startWorkflow(ctx, internal.websitePlan.pipeline, { planId: job.planId }); await ctx.db.patch(job.planId, { workflowId }); }
  return null;
} });
export const read = internalQuery({ args: { planId: v.id('websitePlans') }, returns: v.any(), handler: async (ctx, { planId }) => {
  const plan = await ctx.db.get(planId); if (!plan) throw Error('Plan missing'); return plan;
} });
export const saveRaw = internalMutation({ args: { planId: v.id('websitePlans'), rawJson: v.string() }, returns: v.null(), handler: async (ctx, { planId, rawJson }) => {
  const plan = await ctx.db.get(planId); if (plan?.state === 'generating') await ctx.db.patch(planId, { rawJson, state: 'checking' }); return null;
} });
export const finish = internalMutation({ args: { planId: v.id('websitePlans'), error: v.optional(v.string()) }, returns: v.null(), handler: async (ctx, { planId, error }) => {
  const job = await ctx.db.get(planId); if (!job || !['generating', 'checking'].includes(job.state)) return null;
  if (error) { await ctx.db.patch(planId, { state: 'failed', error }); return null; }
  const result = validateWebsitePlan(JSON.parse(job.rawJson!), JSON.parse(job.inputJson), job.previousPlanJson ? JSON.parse(job.previousPlanJson) : undefined, job.selectedNodeId);
  await ctx.db.patch(planId, { state: result.outcome === 'ready' ? 'complete' : 'clarification', ...(result.outcome === 'ready' ? { planJson: JSON.stringify(result) } : {}), error: undefined }); return null;
} });
export const pipeline = workflow.define({ args: { planId: v.id('websitePlans') }, returns: v.null() }).handler(async (step, { planId }): Promise<null> => {
  try { await step.runAction(internal.websitePlan.generate, { planId }, { retry: false }); await step.runMutation(internal.websitePlan.finish, { planId }); }
  catch { await step.runMutation(internal.websitePlan.finish, { planId, error: 'I couldn’t finish your website plan. Your demand map is safe. Try again.' }); }
  return null;
});
export const generate = internalAction({ args: { planId: v.id('websitePlans') }, returns: v.null(), handler: async (ctx, { planId }): Promise<null> => {
  const job = await ctx.runQuery(internal.websitePlan.read, { planId }); if (job.rawJson) return null;
  const key = process.env.OPENAI_API_KEY; if (!key) throw Error('AI unavailable');
  const agent = new Agent(components.agent, { name: 'Website architecture', languageModel: createOpenAI({ apiKey: key }).responses(BATCH_SETTINGS.model), instructions: PLAN_RULES });
  const { thread } = await agent.createThread(ctx);
  const input: PlanInput = JSON.parse(job.inputJson);
  const result = await thread.generateText({ prompt: JSON.stringify({ input, allowedDemandAreas: retainedCards(input).map(c=>({id:c.groupId,label:c.label})), instruction:'clusterIds MUST use the exact allowedDemandAreas IDs. Earlier card IDs inside business context are historical and are not valid final-map references.', previousPlan: job.previousPlanJson ? JSON.parse(job.previousPlanJson) : null, selectedNodeId: job.selectedNodeId ?? null, correction: job.correction ?? null }), output: Output.object({ schema: groundedPlanSchema(input) }), maxRetries: 0, maxOutputTokens: BATCH_SETTINGS.maxOutputTokens, providerOptions: { openai: { reasoningEffort: BATCH_SETTINGS.reasoningEffort, strictJsonSchema: true } } });
  await ctx.runMutation(internal.websitePlan.saveRaw, { planId, rawJson: JSON.stringify(result.output) }); return null;
} });
