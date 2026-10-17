import type { PostHogConfig } from 'posthog-js';
import { privacyConsent, CONSENT_KEY, type PrivacyConsent } from './privacyConsent';
import { WORKFLOW_EVENTS, isAnalyticsId, createMilestones, withMilestoneLock, type WorkflowEvent, type WorkflowProperties, type ViewKind } from './analyticsMilestones';

type Environment = { PROD?: boolean; MODE?: string; VITE_POSTHOG_ENABLED?: string; VITE_POSTHOG_PROJECT_TOKEN?: string; VITE_POSTHOG_HOST?: string };
export type AnalyticsProperties = {
  stage?: 'initial' | 'full' | 'plan';
  outcome?: 'success' | 'failure';
  count?: number;
  duration_ms?: number;
};
type AnalyticsSdk = {
  init(token: string, config: Partial<PostHogConfig>): unknown;
  capture(event: string, properties: Record<string, unknown>, options?: { send_instantly: boolean }): unknown;
  opt_in_capturing(options: { captureEventName: false }): void;
  opt_out_capturing(): void;
  stopSessionRecording(): void;
};

// Explicit event allowlist. Workflow collection remains behind the release lock.
const approvedEvents: ReadonlySet<string> = new Set(['posthog_connection_test', ...WORKFLOW_EVENTS]);
const EU_HOST = 'https://eu.i.posthog.com';
// Separate from visitor consent: no collection is released in this step.
const COLLECTION_RELEASED = false;

export const replayPrivacy: NonNullable<PostHogConfig['session_recording']> = {
  maskAllInputs: true,
  maskTextSelector: '*',
  maskAllElementAttributes: true,
  blockSelector: '.review, .website-plan, .research-question, .search-activity, .initial-activity, .cluster-evidence, .invite-form, input[type="hidden"], input[type="file"], iframe, [data-private]',
  recordHeaders: false,
  recordBody: false,
  streamNetworkBody: false,
  captureJsonLd: false,
  recordCrossOriginIframes: false,
  inlineStylesheet: false,
  captureCanvas: { recordCanvas: false },
  maskCapturedNetworkRequestFn: () => null,
};

// Reconstruct rather than subtract: unknown fields, SDK-added URLs/referrers,
// nested backend objects and credentials never survive this boundary.
export function filterOutgoingEvent(event: { uuid: string; event: string; properties?: Record<string, unknown> }, consent: PrivacyConsent, projectToken?: string, workflow?: WorkflowProperties) {
  if (!projectToken?.startsWith('phc_')) return null;
  if (!consent.analytics || !approvedEvents.has(event.event) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(event.uuid)) return null;
  if (event.event !== 'posthog_connection_test') {
    if (!workflow || !isAnalyticsId(workflow.anonymous_id) || !isAnalyticsId(workflow.journey_id) || !['new', 'reopened'].includes(workflow.view_kind)) return null;
    return { uuid: event.uuid, event: event.event, properties: {
      token: projectToken, distinct_id: workflow.anonymous_id, journey_id: workflow.journey_id,
      view_kind: workflow.view_kind, $process_person_profile: false, $geoip_disable: true,
    } };
  }
  return { uuid: event.uuid, event: event.event, properties: {
    token: projectToken, distinct_id: 'topic-gibbon-connection-test',
    diagnostic: true, environment: 'local', $process_person_profile: false, $geoip_disable: true,
  } };
}

export function connectionTestAllowed(env: Environment, hostname: string): boolean {
  return env.PROD === true && env.MODE === 'posthog-test' && env.VITE_POSTHOG_ENABLED === 'true'
    && env.VITE_POSTHOG_HOST === EU_HOST && !!env.VITE_POSTHOG_PROJECT_TOKEN?.trim().startsWith('phc_')
    && (hostname === 'localhost' || hostname === '127.0.0.1');
}

export function sanitizeProperties(properties: Record<string, unknown>): AnalyticsProperties {
  const safe: AnalyticsProperties = {};
  if (properties.stage === 'initial' || properties.stage === 'full' || properties.stage === 'plan') safe.stage = properties.stage;
  if (properties.outcome === 'success' || properties.outcome === 'failure') safe.outcome = properties.outcome;
  for (const key of ['count', 'duration_ms'] as const) {
    const value = properties[key];
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) safe[key] = value;
  }
  return safe;
}

// Injectable loader lets tests verify privacy boundaries without loading the SDK.
export function createAnalytics(load: () => Promise<AnalyticsSdk>, consent = privacyConsent) {
  let sdk: AnalyticsSdk | undefined;
  let initialization: Promise<void> | undefined;
  let diagnosticOpen = false;
  let diagnosticAttempted = false;
  let workflowCapture: { event: WorkflowEvent; properties: WorkflowProperties } | undefined;
  function stopCollection() {
    diagnosticOpen = false;
    workflowCapture = undefined;
    try { sdk?.stopSessionRecording(); } catch { /* Privacy failures never break the UI. */ }
    try { sdk?.opt_out_capturing(); } catch { /* The local gates remain closed. */ }
  }
  const unsubscribe = consent.subscribe(stopCollection);
  function initialize(env: Environment): Promise<void> {
    const preferences = consent.get();
    if (!preferences.analytics && !preferences.recording) return Promise.resolve();
    const token = env.VITE_POSTHOG_PROJECT_TOKEN?.trim();
    if (!env.PROD || env.MODE === 'test' || env.VITE_POSTHOG_ENABLED !== 'true' || !token?.startsWith('phc_') || env.VITE_POSTHOG_HOST !== EU_HOST) return Promise.resolve();
    initialization ??= (async () => {
      try {
        const instance = await load();
        const latest = consent.get();
        if (!latest.analytics && !latest.recording) return;
        instance.init(token, {
          api_host: EU_HOST,
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
          disable_session_recording: true,
          capture_exceptions: false,
          capture_performance: false,
          rageclick: false,
          enable_recording_console_log: false,
          disable_surveys: true,
          advanced_disable_flags: true,
          person_profiles: 'never',
          persistence: 'memory',
          ip: false,
          opt_out_capturing_by_default: true,
          opt_out_persistence_by_default: true,
          session_recording: replayPrivacy,
          // Open only during the manual local diagnostic. Reconstruct the
          // payload after the SDK has attached its automatic properties.
          before_send: event => diagnosticOpen && event.event === 'posthog_connection_test'
            ? filterOutgoingEvent(event, consent.get(), token)
            : COLLECTION_RELEASED && workflowCapture?.event === event.event
              ? filterOutgoingEvent(event, consent.get(), token, workflowCapture.properties) : null,
        });
        sdk = instance;
        stopCollection();
      } catch { /* Analytics must never interrupt the product. No sensitive logs. */ }
    })();
    return initialization;
  }
  function track(event: string, properties: AnalyticsProperties = {}): void {
    if (!COLLECTION_RELEASED || !consent.get().analytics || !sdk || !approvedEvents.has(event)) return;
    try { sdk.capture(event, sanitizeProperties(properties)); } catch { /* Best effort only. */ }
  }
  async function connectionTest(env: Environment, hostname: string): Promise<string> {
    if (!connectionTestAllowed(env, hostname) || !consent.get().analytics) return 'blocked';
    if (diagnosticAttempted) return 'already attempted; reload to retry';
    diagnosticAttempted = true;
    await initialize(env);
    if (!sdk || !consent.get().analytics) return 'unavailable or consent withdrawn';
    try {
      sdk.opt_in_capturing({ captureEventName: false });
      diagnosticOpen = true;
      const result = sdk.capture('posthog_connection_test', {}, { send_instantly: true });
      return result ? 'attempted; verify receipt in PostHog' : 'not captured';
    } catch { return 'unavailable'; }
    finally { stopCollection(); }
  }
  async function workflow(event: WorkflowEvent, properties: WorkflowProperties, env: Environment): Promise<void> {
    if (!workflowCollectionAllowed(env) || !consent.get().analytics || !WORKFLOW_EVENTS.includes(event)) return;
    await initialize(env);
    if (!sdk || !consent.get().analytics) return;
    try {
      sdk.opt_in_capturing({ captureEventName: false });
      workflowCapture = { event, properties };
      sdk.capture(event, {}, { send_instantly: true });
    } catch { /* Never interrupt research or exports. */ }
    finally { stopCollection(); }
  }
  return { initialize, track, workflow, connectionTest, dispose: () => { stopCollection(); unsubscribe(); } };
}

export function workflowCollectionAllowed(env: Environment): boolean {
  return COLLECTION_RELEASED && env.PROD === true && env.MODE === 'production'
    && env.VITE_POSTHOG_ENABLED === 'true' && env.VITE_POSTHOG_HOST === EU_HOST
    && !!env.VITE_POSTHOG_PROJECT_TOKEN?.trim().startsWith('phc_');
}

const analytics = createAnalytics(async () => (await import('posthog-js')).default);
export function initializeAnalytics(): Promise<void> {
  return analytics.initialize(import.meta.env ?? {});
}
export const trackEvent = analytics.track;
const milestones = createMilestones(() => window.localStorage,
  () => workflowCollectionAllowed(import.meta.env ?? {}) && privacyConsent.get().analytics,
  (event, properties) => analytics.workflow(event, properties, import.meta.env ?? {}));
export const analyticsJourney = milestones.journey;
export function trackMilestone(event: WorkflowEvent, journey: string | undefined, kind: ViewKind = 'new'): void {
  if (!workflowCollectionAllowed(import.meta.env ?? {}) || !privacyConsent.get().analytics) return;
  withMilestoneLock(() => milestones.record(event, journey, kind));
}
// Re-read shared preferences on change/clear in another tab; no payloads logged.
if (typeof window !== 'undefined') {
  if (connectionTestAllowed(import.meta.env ?? {}, window.location.hostname)) {
    (window as Window & { topicGibbonPostHogConnectionTest?: () => Promise<string> }).topicGibbonPostHogConnectionTest =
      () => analytics.connectionTest(import.meta.env ?? {}, window.location.hostname);
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === CONSENT_KEY || event.key === null) privacyConsent.refresh();
  };
  window.addEventListener('storage', onStorage);
  import.meta.hot?.dispose(() => { window.removeEventListener('storage', onStorage); analytics.dispose(); });
}
