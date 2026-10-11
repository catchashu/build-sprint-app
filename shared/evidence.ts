import { z } from "zod";

const sourceSchema = z.object({
  provider: z.string().min(1),
  reference: z.string().min(1),
  field: z.string().min(1),
  retrievedAt: z.string().min(1),
}).strict();
export const evidenceSchema = z.object({
  id: z.string().min(1), query: z.string().min(1).max(1000),
  volume: z.null(), sources: z.array(sourceSchema).min(1),
}).strict();
export type Evidence = z.infer<typeof evidenceSchema>;

// Only observed provider fields become evidence. The request q is never evidence.
export function extractSerpEvidence(responses: unknown[]): Evidence[] {
  const rows: Evidence[] = [];
  const byQuery = new Map<string, Evidence>();
  for (const raw of responses) {
    const result = z.object({
      error: z.string().optional(),
      search_metadata: z.object({ id: z.string(), status: z.string(), created_at: z.string().optional() }),
      search_parameters: z.object({ gl: z.literal("in") }),
      related_searches: z.array(z.object({ query: z.string().optional() }).passthrough()).optional(),
      related_questions: z.array(z.object({ question: z.string().optional() }).passthrough()).optional(),
    }).passthrough().parse(raw);
    if (result.error || result.search_metadata.status !== "Success") throw new Error("SerpAPI search did not succeed.");
    const accept = (query: string | undefined, field: string) => {
      if (!query?.trim()) return;
      const key = query.trim().toLocaleLowerCase("en-IN").replace(/\s+/g, " ");
      const source = {
        provider: "SerpAPI / Google / India",
        reference: `https://serpapi.com/searches/${result.search_metadata.id}.json`,
        field, retrievedAt: result.search_metadata.created_at ?? "Not supplied by provider",
      };
      const existing = byQuery.get(key);
      if (existing) {
        if (!existing.sources.some(s => s.reference === source.reference && s.field === source.field)) existing.sources.push(source);
      } else {
        const row: Evidence = { id: `e${rows.length + 1}`, query, volume: null, sources: [source] };
        rows.push(row);
        byQuery.set(key, row);
      }
    };
    result.related_searches?.forEach(row => accept(row.query, "related_searches.query"));
    result.related_questions?.forEach(row => accept(row.question, "related_questions.question"));
  }
  return rows;
}

export function parseEvidenceFile(text: string): Evidence[] {
  if (text.length > 500_000) throw new Error("Evidence file must be under 500 KB.");
  const data: unknown = JSON.parse(text);
  // Accept original SerpAPI response(s), or an explicitly user-supplied query file.
  if (Array.isArray(data)) return extractSerpEvidence(data);
  if (data && typeof data === "object" && "search_metadata" in data) return extractSerpEvidence([data]);
  const file = z.object({
    market: z.literal("India"),
    queries: z.array(z.object({ query: z.string().min(1).max(1000), source: z.string().min(1), retrievedAt: z.string().min(1) }).strict()).min(1).max(150),
  }).strict().parse(data);
  const rows: Evidence[] = [];
  for (const item of file.queries) {
    const existing = rows.find(row => row.query.trim().toLowerCase() === item.query.trim().toLowerCase());
    const source = { provider: "User-supplied file (not independently verified)", reference: item.source, retrievedAt: item.retrievedAt, field: "queries.query" };
    if (existing) existing.sources.push(source);
    else rows.push({ id: `e${rows.length + 1}`, query: item.query, volume: null, sources: [source] });
  }
  return rows;
}

const priority = z.enum(["First", "Next", "Later"]);
export const reasoningSchema = z.object({
  limitations: z.array(z.string()).min(1),
  clusters: z.array(z.object({
    id: z.string(), label: z.string(), need: z.string(),
    intent: z.enum(["Commercial", "Consideration", "Discovery"]),
    priority, rationale: z.string(), evidenceIds: z.array(z.string()).min(1),
  }).strict()).min(1).max(20),
  excluded: z.array(z.object({ evidenceId: z.string(), reason: z.string() }).strict()),
  websitePlan: z.array(z.object({
    id: z.string(), parentId: z.string().nullable(), label: z.string(),
    treatment: z.enum(["Page", "Section", "FAQ", "Supporting Content"]),
    priority, rationale: z.string(), coverage: z.array(z.string()).min(1),
    clusterIds: z.array(z.string()).min(1),
  }).strict()).min(1).max(30),
}).strict();
export type Reasoning = z.infer<typeof reasoningSchema>;

export function validateReasoning(raw: unknown, evidence: Evidence[]): Reasoning {
  const value = reasoningSchema.parse(raw);
  const evidenceIds = new Set(evidence.map(row => row.id));
  const accounted = new Set<string>();
  const clusterIds = new Set(value.clusters.map(c => c.id));
  if (clusterIds.size !== value.clusters.length) throw new Error("Duplicate cluster IDs.");
  for (const cluster of value.clusters) {
    for (const id of cluster.evidenceIds) {
      if (!evidenceIds.has(id)) throw new Error("AI referenced evidence that was not supplied.");
      if (accounted.has(id)) throw new Error("Each query must belong to one underlying need or be excluded.");
      accounted.add(id);
    }
  }
  for (const excluded of value.excluded) {
    if (!evidenceIds.has(excluded.evidenceId) || accounted.has(excluded.evidenceId)) throw new Error("Invalid exclusion.");
    accounted.add(excluded.evidenceId);
  }
  if (accounted.size !== evidenceIds.size) throw new Error("AI silently omitted supplied evidence.");
  const nodes = new Map(value.websitePlan.map(node => [node.id, node]));
  if (nodes.size !== value.websitePlan.length) throw new Error("Duplicate website node IDs.");
  for (const node of value.websitePlan) {
    if (node.clusterIds.some(id => !clusterIds.has(id))) throw new Error("Website recommendation has no supporting cluster.");
    const seen = new Set([node.id]);
    let parent = node.parentId;
    while (parent !== null) {
      if (seen.has(parent) || !nodes.has(parent)) throw new Error("Invalid website hierarchy.");
      seen.add(parent);
      parent = nodes.get(parent)!.parentId;
    }
  }
  return value;
}

export function materialize(reasoning: Reasoning, evidence: Evidence[]) {
  const byId = new Map(evidence.map(row => [row.id, row]));
  return {
    market: "India",
    evidenceNote: "Observed search suggestions/questions, not measured search volumes. AI interpretation is a draft; product range and safety claims need business confirmation.",
    limitations: reasoning.limitations,
    demandMap: reasoning.clusters.map(({ evidenceIds, ...cluster }) => ({
      ...cluster, demand: "Insufficient evidence", evidence: evidenceIds.map(id => byId.get(id)!),
    })),
    draftWebsitePlan: reasoning.websitePlan.map(node => ({ ...node, demand: "Insufficient evidence" })),
    excludedEvidence: reasoning.excluded.map(item => ({ reason: item.reason, evidence: byId.get(item.evidenceId)! })),
  };
}
