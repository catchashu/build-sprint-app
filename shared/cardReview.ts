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
