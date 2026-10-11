import { z } from "zod";

export type ScorePage = { id: string; label: string; treatment: string; role: string };
export type CoreNeed = { id: string; label: string };
export const pageDecisionSchema = z.object({ pageId: z.string(), decision: z.enum(["keep", "reject"]), reason: z.string().trim().min(1) }).strict();
export const coreDecisionSchema = z.object({ coreId: z.string(), decision: z.enum(["covered", "missed"]), pageIds: z.array(z.string()), reason: z.string().trim().min(1) }).strict();
export function scoredPages(pages: ScorePage[]) {
  return pages.filter(page => ["Page", "Supporting Content"].includes(page.treatment) && !/^(about(?: us| the company)?|contact(?: us| and (?:enquiries|inquiries))?)[.!]?$/i.test(page.label.trim()));
}
export function scoreRecord(pages: ScorePage[], core: CoreNeed[], rawDecisions: unknown, rawCoverage: unknown) {
  const decisions = z.array(pageDecisionSchema).parse(rawDecisions);
  const coverage = z.array(coreDecisionSchema).parse(rawCoverage);
  const candidates = scoredPages(pages);
  const candidateIds = new Set(candidates.map(p => p.id));
  const allPageIds = new Set(pages.map(p => p.id));
  const coreIds = new Set(core.map(c => c.id));
  if (new Set(decisions.map(d => d.pageId)).size !== decisions.length || decisions.some(d => !candidateIds.has(d.pageId))) throw new Error("Unknown or repeated page decision.");
  if (new Set(coverage.map(c => c.coreId)).size !== coverage.length || coverage.some(c => !coreIds.has(c.coreId) || c.pageIds.some(id => !allPageIds.has(id)) || (c.decision === "covered" && !c.pageIds.length) || (c.decision === "missed" && c.pageIds.length))) throw new Error("Invalid Core coverage decision.");
  const kept = decisions.filter(d => d.decision === "keep").length;
  const pagesComplete = candidates.length > 0 && decisions.length === candidates.length;
  const coreComplete = core.length > 0 && coverage.length === core.length;
  const missed = coverage.filter(c => c.decision === "missed").length;
  const percent = pagesComplete ? Math.round(kept / candidates.length * 1000) / 10 : null;
  const keepRatePass = pagesComplete ? kept * 4 >= candidates.length * 3 : null;
  const coreCoveragePass = coreComplete ? missed === 0 : null;
  const overall = pagesComplete && coreComplete ? keepRatePass && coreCoveragePass ? "PASS" : "FAIL" : "PENDING";
  return {
    pagesKept: kept, pagesProposed: candidates.length, pagesReviewed: decisions.length, keepPercentage: percent,
    passLinePercentage: 75, minimumPagesToKeep: Math.ceil(candidates.length * 0.75),
    keepRatePass, coreCoveragePass, coreNeedsCovered: coverage.filter(c => c.decision === "covered").length,
    coreNeedsTotal: core.length, coreNeedsMissed: missed, overall,
    display: pagesComplete ? `Pages kept: ${kept} of ${candidates.length} (${percent!.toFixed(1)}%) — ${keepRatePass ? "meets" : "below"} the 75% pass line.` : `Pages kept so far: ${kept} of ${candidates.length}; ${decisions.length} reviewed. Percentage pending — pass line 75%.`,
    countingRule: "Count each proposed Page or standalone Supporting Content item once. Exclude on-page Sections/FAQs and baseline About/Contact. Human keep/reject and Core coverage judgements are separate. No rounding up to pass.",
    pageDecisions: candidates.map(page => ({ ...page, ...(decisions.find(d => d.pageId === page.id) ?? { decision: "pending", reason: "Awaiting practitioner judgement" }) })),
    coreDecisions: core.map(need => ({ ...need, ...(coverage.find(c => c.coreId === need.id) ?? { decision: "pending", pageIds: [], reason: "Awaiting practitioner judgement" }) })),
  };
}
