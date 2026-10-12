import { z } from "zod";
import type { materializeCards } from "./firstValue";

export type Card = ReturnType<typeof materializeCards>[number];
export type Review = { revision: number; cards: Card[]; decisions: Record<string, "pending" | "correct" | "excluded">; notes: { cardId: string; kind: string; text: string }[]; accepted: boolean };
export function readReview(cards: string, saved?: string): Review {
  if (saved) return JSON.parse(saved);
  const values: Card[] = JSON.parse(cards);
  return { revision: 0, cards: values, decisions: Object.fromEntries(values.map(c => [c.groupId, "pending"])), notes: [], accepted: false };
}
export function reviewCard(review: Review, cardId: string) {
  const card = review.cards.find(c => c.groupId === cardId);
  if (!card) throw new Error("This card could not be found. Refresh and try again.");
  return card;
}
export function decide(review: Review, cardId: string, decision: "correct" | "excluded") {
  reviewCard(review, cardId);
  return { ...review, revision: review.revision + 1, accepted: false, decisions: { ...review.decisions, [cardId]: decision },
    notes: decision === "excluded" ? [...review.notes, { cardId, kind: "exclude", text: "This isn’t part of what I offer." }] : review.notes };
}
export const correctionSchema = z.object({ outcome: z.enum(["updated", "needs_clarification"]), label: z.string().min(1).max(160), need: z.string().min(1).max(800), explanation: z.string().min(1).max(800) }).strict();
export function correctMeaning(review: Review, cardId: string, kind: string, text: string, raw: unknown): Review {
  const card = reviewCard(review, cardId), result = correctionSchema.parse(raw);
  if (result.outcome !== "updated") throw new Error(result.explanation);
  return { ...review, revision: review.revision + 1, accepted: false,
    cards: review.cards.map(c => c.groupId === cardId ? { ...card, label: result.label, need: result.need } : c),
    decisions: { ...review.decisions, [cardId]: "pending" }, notes: [...review.notes, { cardId, kind, text }] };
}
export function acceptedUnderstanding(review: Review, offering: string, context: string) {
  const retained = review.cards.filter(c => review.decisions[c.groupId] !== "excluded");
  if (!retained.length || retained.some(c => review.decisions[c.groupId] !== "correct")) throw new Error("Confirm every remaining card before continuing. Keep at least one card.");
  return { offering, websiteContext: context, cards: retained, excludedGroupIds: review.cards.filter(c => review.decisions[c.groupId] === "excluded").map(c => c.groupId), corrections: review.notes, revision: review.revision };
}

export type GroupSelection = { queryIds?: string[]; targetCardId?: string };
export function groupingInput(review: Review, cardId: string, kind: "split" | "merge", selection: GroupSelection) {
  const card = reviewCard(review, cardId);
  if (review.decisions[cardId] === "excluded") throw new Error("Choose a remaining card.");
  if (kind === "merge") {
    const target = reviewCard(review, selection.targetCardId ?? "");
    if (target.groupId === cardId || review.decisions[target.groupId] === "excluded") throw new Error("Choose a different remaining card.");
    return [card, target];
  }
  const ids = selection.queryIds ?? [];
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !card.queries.some(q => q.id === id))) throw new Error("Select searches from this card.");
  if (ids.length === card.queries.length) throw new Error("Leave at least one search in this card, or correct its meaning instead.");
  return [card];
}
export const groupingSchema = z.object({ outcome: z.enum(["updated", "needs_clarification"]), explanation: z.string().min(1).max(800), groups: z.array(z.object({ label: z.string().min(1).max(160), need: z.string().min(1).max(800), queryIds: z.array(z.string()).min(1) }).strict()).max(12) }).strict();
export function correctGrouping(review: Review, cardId: string, kind: "split" | "merge", selection: GroupSelection, raw: unknown): Review {
  const affected = groupingInput(review, cardId, kind, selection), result = groupingSchema.parse(raw);
  if (result.outcome !== "updated") throw new Error(result.explanation);
  const evidence = new Map(affected.flatMap(c => c.queries).map(q => [q.id, q]));
  const ids = result.groups.flatMap(g => g.queryIds);
  if (ids.length !== evidence.size || new Set(ids).size !== ids.length || ids.some(id => !evidence.has(id))) throw new Error("The correction must preserve every original search exactly once.");
  if (kind === "merge" && result.groups.length !== 1) throw new Error("The selected cards must become one area.");
  if (kind === "split") {
    const selected = new Set(selection.queryIds);
    if (result.groups.length < 2 || result.groups.some(g => g.queryIds.some(id => selected.has(id)) && g.queryIds.some(id => !selected.has(id)))) throw new Error("Selected searches must be separated from the remaining searches.");
  }
  const replacements = result.groups.map((g, i) => ({ groupId: i === 0 ? cardId : `${cardId}-r${review.revision + 1}-${i}`, label: g.label, need: g.need, queries: g.queryIds.map(id => evidence.get(id)!) }));
  const affectedIds = new Set(affected.map(c => c.groupId));
  const decisions = { ...review.decisions };
  for (const id of affectedIds) delete decisions[id];
  for (const card of replacements) decisions[card.groupId] = "pending";
  return { ...review, revision: review.revision + 1, accepted: false,
    cards: review.cards.flatMap(c => c.groupId === cardId ? replacements : affectedIds.has(c.groupId) ? [] : [c]), decisions,
    notes: [...review.notes, { cardId, kind, text: JSON.stringify({ ...selection, affectedCardIds: [...affectedIds], explanation: result.explanation }) }] };
}
