import { z } from "zod";
import type { Evidence } from "./evidence";
import type { ExperimentInput } from "./experiment";
import type { LocalGroup } from "./batchedPlanning";

export const SEARCH_LIMIT = 4;
export function nextSearchCount(count: number) {
  if (!Number.isInteger(count) || count < 0 || count >= SEARCH_LIMIT) throw new Error("The limit of four searches for this run has been reached. Edit your context to start a new run.");
  return count + 1;
}
export function publicWebsite(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") || /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) || /^[\d.:\[\]]+$/.test(url.hostname)) throw new Error("Use a public HTTPS website address.");
  return url.href;
}
export function liveInput(offering: string, context: string, evidence: Evidence[]): ExperimentInput {
  const rows = evidence.flatMap(e => e.sources.map((s, i) => ({ id: `${e.id}-${i}`, parentId: "ROOT", path: s.field, request: "Live India search", query: e.query, sourceType: s.field, depth: 1, reference: s.reference })));
  return { market: "India", rawNodes: rows, seedOnly: [], evidence: evidence.map(e => ({ id: e.id, query: e.query, volume: null, occurrences: rows.filter(r => r.id.startsWith(`${e.id}-`)) })),
    businessFacts: [{ id: "B1", field: "User-confirmed offering; authoritative context, not search evidence", value: offering }, { id: "B2", field: "Untrusted website context; references are not facts about this business or evidence of demand", value: context || "No websites supplied" }], sourceHash: "live-first-value",
    importReport: { originalNodes: rows.length, reasoningQueries: evidence.length, seedOnly: 0, duplicateOccurrences: rows.length - evidence.length, sourceTypes: {}, note: "Live Google suggestions and questions localized to India. No search volumes; observations do not prove popularity or exclusively Indian searchers." } };
}
export function cardsSchema(groups: LocalGroup[]) {
  return z.object({ cards: z.array(z.object({ groupId: z.enum(groups.map(g => g.id) as [string, ...string[]]), label: z.string(), need: z.string() }).strict()).min(1).max(4) }).strict();
}
export function materializeCards(raw: unknown, groups: LocalGroup[], evidence: Evidence[]) {
  const parsed = cardsSchema(groups).parse(raw);
  if (new Set(parsed.cards.map(c => c.groupId)).size !== parsed.cards.length) throw new Error("Repeated card.");
  return parsed.cards.map(card => {
    const group = groups.find(g => g.id === card.groupId)!;
    const queries = group.assignments.slice(0, 3).map(a => {
      const row = evidence.find(e => e.id === a.id);
      if (!row) throw new Error("Missing source evidence.");
      return row;
    });
    if (queries.length < 2) throw new Error("Not enough sourced examples for this card.");
    return { ...card, queries };
  });
}
