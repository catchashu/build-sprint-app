/** V1 resting placeholder is already settled: no timer or media-length wait. */
export function arriveReady(offering: string, ready: () => void, missing: () => void) {
  let cancelled = false;
  queueMicrotask(() => { if (!cancelled) (offering.trim() ? ready : missing)(); });
  return () => { cancelled = true; };
}
