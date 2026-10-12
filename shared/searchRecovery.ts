import { SEARCH_LIMIT } from "./firstValue";
type Run = { seeds?: string[]; searchCount: number; searches: {query: string; status: string; error?: string}[] };
export function temporarySearchFailure(error = "") { return /HTTP (429|5\d\d)\.|could not be reached|connection to SerpAPI failed|did not finish within/.test(error); }
export function searchAttemptLimit(run: Run) { return SEARCH_LIMIT + Math.min(2, run.searches.filter(s => s.status === "failed" && temporarySearchFailure(s.error)).length); }
export function nextSearchQuery(run: Run): string | undefined {
 if (run.searchCount >= searchAttemptLimit(run)) return undefined;
 return run.seeds?.find(query => {
  const attempts = run.searches.filter(s => s.query === query);
  return !attempts.some(s => s.status === "complete" || s.status === "running") && (attempts.length === 0 || (attempts.length < 2 && temporarySearchFailure(attempts.at(-1)?.error)));
 });
}
