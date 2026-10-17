
export const WORKFLOW_EVENTS = ['onboarding_started', 'initial_results_viewed', 'final_plan_viewed', 'excel_export_triggered'] as const;
export type WorkflowEvent = typeof WORKFLOW_EVENTS[number];
export type ViewKind = 'new' | 'reopened';
export type WorkflowProperties = { anonymous_id: string; journey_id: string; view_kind: ViewKind };
export const isAnalyticsId = (value: unknown): value is string => typeof value === 'string' && /^tg_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const prefix = 'topic-gibbon:analytics:v1:';

// Only random analytics IDs and milestone booleans are stored. No run IDs or access tokens.
// Mark before sending: prefer a missed event over duplicate funnel milestones on retry.
export function createMilestones(storage: () => Pick<Storage, 'getItem' | 'setItem'>, allowed: () => boolean,
  send: (event: WorkflowEvent, properties: WorkflowProperties) => unknown,
  random: () => string = () => `tg_${crypto.randomUUID()}`) {
  function journey(existing?: string): string | undefined {
    try { return allowed() ? (isAnalyticsId(existing) ? existing : random()) : undefined; } catch { return undefined; }
  }
  function record(event: WorkflowEvent, journeyId: string | undefined, kind: ViewKind): void {
    try {
      if (!allowed() || !isAnalyticsId(journeyId) || !WORKFLOW_EVENTS.includes(event) || !['new', 'reopened'].includes(kind)) return;
      const target = storage();
      const marker = `${prefix}${journeyId}:${event}`;
      if (target.getItem(marker)) return;
      let anonymous = target.getItem(`${prefix}identity`);
      if (!isAnalyticsId(anonymous)) { anonymous = random(); if (!isAnalyticsId(anonymous)) return; target.setItem(`${prefix}identity`, anonymous); }
      target.setItem(marker, '1');
      if (!allowed()) return;
      const result = send(event, { anonymous_id: anonymous, journey_id: journeyId, view_kind: kind });
      // Async SDK failures must never become unhandled rejections.
      if (result instanceof Promise) void result.catch(() => {});
    } catch { /* Missing storage/crypto or analytics failure must not affect the app. */ }
  }
  return { journey, record };
}

// Serialise milestone claims across same-origin tabs where Web Locks is available.
export function withMilestoneLock(action: () => void): void {
  try {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      void navigator.locks.request('topic-gibbon-analytics', action).catch(() => {});
    } else action();
  } catch { /* Best effort, never block navigation. */ }
}
