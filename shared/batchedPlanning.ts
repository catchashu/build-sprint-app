import { z } from "zod";
import { draftSchema, PLANNING_RULES, validateDraft, type Draft } from "./planning";
import type { EvidenceItem, ExperimentInput } from "./experiment";

export const BATCH_SETTINGS = { pipeline: "batched-v1", model: "gpt-6-luna", reasoningEffort: "medium", maxOutputTokens: 64000, batchSize: 50, maxRetries: 0 } as const;
export const BATCH_RULES_VERSION = "mri-experiment-rules-3-batched";
export const BATCH_RULES = `${PLANNING_RULES}\nSTRUCTURED PIPELINE: assignment responses use one required property per canonical evidence ID, rather than lists of IDs. Choose one destination for each property. Code alone creates the final evidence lists. Later stages may consolidate existing needs and propose website treatments but cannot reassign, create, remove or repeat evidence IDs. Different batches may describe the same need with different words; consolidate real synonyms globally while preserving distinct complete product families. Follow the schema for the current stage, not the final draft format described above.`;
const text = z.string().min(1);
const clusterShape = draftSchema.shape.clusters.element.shape;
const retained = z.object({
  destination: z.literal("cluster"), needKey: text, label: text, need: text,
  kind: clusterShape.kind, intent: clusterShape.intent, stage: clusterShape.stage,
  priority: clusterShape.priority, reason: text, subIntent: text,
}).strict();
const assignment = z.union([retained,
  z.object({ destination: z.literal("excluded"), reason: text }).strict(),
  z.object({ destination: z.literal("unresolved"), reason: text, question: text }).strict(),
]);
export type Assignment = z.infer<typeof assignment>;
export type BatchOutput = { assignments: Record<string, Assignment> };
function exactKeys<T extends z.ZodType>(keys: string[], value: T) {
  if (!keys.length || new Set(keys).size !== keys.length) throw new Error("Expected nonempty unique schema keys.");
  return z.object(Object.fromEntries(keys.map(id => [id, value])) as Record<string, T>).strict();
}
export function evidenceBatches(input: ExperimentInput, size = BATCH_SETTINGS.batchSize): EvidenceItem[][] {
  if (!Number.isInteger(size) || size < 1 || size > 50) throw new Error("Batch size must be 1–50.");
  const keys = input.evidence.map(row => row.id);
  if (!keys.length || new Set(keys).size !== keys.length) throw new Error("Input evidence IDs must be unique.");
  return Array.from({ length: Math.ceil(keys.length / size) }, (_, i) => input.evidence.slice(i * size, (i + 1) * size));
}
export function assignmentSchema(batch: EvidenceItem[]) {
  return z.object({ assignments: exactKeys(batch.map(row => row.id), assignment) }).strict();
}
export function batchPrompt(input: ExperimentInput, batch: EvidenceItem[], index: number) {
  return JSON.stringify({ stage: "Assign each supplied query to one destination", batch: index + 1,
    market: input.market, businessFacts: input.businessFacts,
    instruction: "Use a concise, specific underlying-need key consistently within this batch. Classify relevance and family, not website pages. Catalogue facts do not exhaust the potentially relevant product universe. A family-level procurement query need not be unresolved merely because individual brands or stock are unconfirmed; preserve that distinction. Exclude irrelevant queries with reasons; keep genuine uncertainty unresolved. Use subIntent for buying, price, selection, format or other query-level distinctions.",
    evidence: batch.map(row => ({ id: row.id, query: row.query,
      observations: row.occurrences.map(o => ({ sourceType: o.sourceType, request: o.request, path: o.path, reference: o.reference })) })),
  });
}
export type LocalGroup = { id: string; batch: number; key: string; assignments: { id: string; value: z.infer<typeof retained> }[] };
export function collectBatches(input: ExperimentInput, responses: unknown[]) {
  const batches = evidenceBatches(input);
  if (responses.length !== batches.length) throw new Error("Missing or extra batch response.");
  const groups: LocalGroup[] = [], excluded: Draft["excluded"] = [], unresolved: Draft["unresolved"] = [];
  batches.forEach((batch, index) => {
    const parsed = assignmentSchema(batch).parse(responses[index]);
    const local = new Map<string, LocalGroup>();
    // Iterate input IDs, never model-supplied ID lists. Each ID is visited once.
    for (const row of batch) {
      const value = parsed.assignments[row.id];
      if (value.destination === "excluded") excluded.push({ evidenceIds: [row.id], reason: value.reason });
      else if (value.destination === "unresolved") unresolved.push({ evidenceIds: [row.id], reason: value.reason, question: value.question });
      else {
        let group = local.get(value.needKey);
        if (!group) { group = { id: `G${String(groups.length + 1).padStart(3, "0")}`, batch: index, key: value.needKey, assignments: [] }; groups.push(group); local.set(value.needKey, group); }
        group.assignments.push({ id: row.id, value });
      }
    }
  });
  return { groups, excluded, unresolved };
}
export function groupSummaries(groups: LocalGroup[]) {
  return groups.map(group => ({ id: group.id,
    descriptions: [...new Set(group.assignments.map(a => `${a.value.label}: ${a.value.need}`))],
    kinds: [...new Set(group.assignments.map(a => a.value.kind))],
    subIntents: [...new Set(group.assignments.map(a => a.value.subIntent))],
  }));
}
export function consolidationSchema(groups: LocalGroup[]) {
  const keys = groups.map(g => g.id);
  return z.object({ destinations: exactKeys(keys, z.object({ groupId: z.enum(keys as [string, ...string[]]), reason: text }).strict()) }).strict();
}
export function consolidate(input: ExperimentInput, responses: unknown[], raw: unknown) {
  const collected = collectBatches(input, responses);
  const mapping = consolidationSchema(collected.groups).parse(raw);
  const merged = new Map<string, LocalGroup>();
  // Target names are bucket keys, not graph links. No recursive remapping or evidence duplication.
  for (const group of collected.groups) {
    const target = mapping.destinations[group.id].groupId;
    const prior = merged.get(target);
    if (prior) prior.assignments.push(...group.assignments);
    else merged.set(target, { ...group, id: target, assignments: [...group.assignments] });
  }
  return { ...collected, groups: [...merged.values()] };
}
export function architectureSchema(groups: LocalGroup[], input: ExperimentInput) {
  const keys = groups.map(g => g.id);
  const clusterId = z.enum(keys as [string, ...string[]]);
  const metadata = draftSchema.shape.clusters.element.omit({ id: true, evidenceIds: true, subIntents: true }).extend({ parentId: clusterId.nullable() });
  const base = draftSchema.shape.websitePlan.element.omit({ treatment: true, role: true, needsConfirmation: true, priority: true }).extend({
    clusterIds: z.array(clusterId), businessFactIds: z.array(z.enum(input.businessFacts.map(f => f.id) as [string, ...string[]])),
  });
  const pageVariants = [
    { treatment: z.literal("Page"), role: z.enum(["General page", "Category page", "Product family page", "Product detail page", "Service page", "Product-service page"]) },
    { treatment: z.literal("Section"), role: z.literal("Section") },
    { treatment: z.literal("FAQ"), role: z.literal("FAQ") },
    { treatment: z.literal("Supporting Content"), role: z.enum(["Article", "Downloadable resource"]) },
  ].flatMap(shape => [base.extend({ ...shape, needsConfirmation: z.literal(false), priority: clusterShape.priority }),
    base.extend({ ...shape, needsConfirmation: z.literal(true), priority: z.enum(["Next", "Later"]) })]);
  return z.object({ limitations: z.array(text).min(1), clusters: exactKeys(keys, metadata),
    websitePlan: z.array(z.union(pageVariants as [typeof pageVariants[number], typeof pageVariants[number], ...typeof pageVariants[number][]])).min(1).max(90),
  }).strict();
}
export function assembleDraft(input: ExperimentInput, responses: unknown[], merge: unknown, architecture: unknown): Draft {
  const collected = consolidate(input, responses, merge);
  const plan = architectureSchema(collected.groups, input).parse(architecture);
  const clusters = collected.groups.map(group => {
    const subIntents: Draft["clusters"][number]["subIntents"] = [];
    const bySub = new Map<string, typeof subIntents[number]>();
    for (const { id, value } of group.assignments) {
      const key = JSON.stringify([value.subIntent, value.intent, value.stage]);
      let sub = bySub.get(key);
      if (!sub) { sub = { label: value.subIntent, intent: value.intent, stage: value.stage, evidenceIds: [] }; bySub.set(key, sub); subIntents.push(sub); }
      sub.evidenceIds.push(id);
    }
    return { ...plan.clusters[group.id], id: group.id, evidenceIds: group.assignments.map(a => a.id), subIntents };
  });
  return validateDraft({ limitations: plan.limitations, clusters, excluded: collected.excluded, unresolved: collected.unresolved, websitePlan: plan.websitePlan }, input);
}
