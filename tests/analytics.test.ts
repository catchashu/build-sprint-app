import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics, sanitizeProperties, filterOutgoingEvent, replayPrivacy, connectionTestAllowed } from '../src/analytics';
import { createConsentStore, CONSENT_KEY } from '../src/privacyConsent';

function consentFixture() {
  const values = new Map<string, string>();
  const storage = {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key, value);}, removeItem: (key: string) => {values.delete(key);} };
  const consent = createConsentStore(() => storage);
  return {consent, storage, values};
}
function grantedConsent() { const {consent} = consentFixture(); consent.set({analytics: true, recording: false}); return consent; }
const privacyMethods = { opt_in_capturing() {}, opt_out_capturing() {}, stopSessionRecording() {} };

const enabled = { PROD: true, MODE: 'production', VITE_POSTHOG_ENABLED: 'true', VITE_POSTHOG_PROJECT_TOKEN: 'phc_test_placeholder', VITE_POSTHOG_HOST: 'https://eu.i.posthog.com' };

test('analytics never loads without explicit production opt-in and valid EU configuration', async () => {
  let loads = 0;
  const analytics = createAnalytics(async () => { loads++; throw Error('Unexpected load'); }, grantedConsent());
  for (const env of [{}, {...enabled, PROD: false}, {...enabled, MODE: 'test'}, {...enabled, VITE_POSTHOG_ENABLED: 'false'}, {...enabled, VITE_POSTHOG_ENABLED: 'TRUE'}, {...enabled, VITE_POSTHOG_PROJECT_TOKEN: ''}, {...enabled, VITE_POSTHOG_HOST: 'https://example.com'}]) await analytics.initialize(env);
  analytics.track('unapproved', {});
  assert.equal(loads, 0);
});

test('analytics initializes once with all automatic collection off and blocks unapproved events', async () => {
  let loads = 0, inits = 0, captures = 0;
  let config: Record<string, any> = {};
  const analytics = createAnalytics(async () => {
    loads++;
    return { ...privacyMethods, init: (_token, options) => { inits++; config = options; }, capture: () => { captures++; } };
  }, grantedConsent());
  await Promise.all([analytics.initialize(enabled), analytics.initialize(enabled)]);
  assert.equal(loads, 1); assert.equal(inits, 1);
  for (const key of ['autocapture', 'capture_pageview', 'capture_pageleave', 'capture_exceptions', 'capture_performance', 'rageclick', 'enable_recording_console_log']) assert.equal(config[key], false, key);
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.advanced_disable_flags, true);
  assert.equal(config.opt_out_capturing_by_default, true);
  assert.equal(config.opt_out_persistence_by_default, true);
  assert.equal(config.before_send({event: '$pageview', properties: {secret: 'private'}}), null);
  analytics.track('unapproved', {});
  assert.equal(captures, 0);
});

test('SDK loading or initialization failures never escape into the application', async () => {
  for (const loader of [async () => { throw Error('Offline'); }, async () => ({...privacyMethods, init: () => { throw Error('Unavailable'); }, capture: () => { throw Error('Unexpected capture'); }})]) {
    const analytics = createAnalytics(loader, grantedConsent());
    await assert.doesNotReject(analytics.initialize(enabled));
    assert.doesNotThrow(() => analytics.track('unapproved', {}));
  }
});

test('consent defaults off, persists independently, and withdrawal survives reopening', () => {
  const {consent, storage, values} = consentFixture();
  assert.deepEqual(consent.get(), {analytics: false, recording: false});
  assert.equal(consent.set({analytics: false, recording: true}), true);
  assert.deepEqual(createConsentStore(() => storage).get(), {analytics: false, recording: true});
  consent.set({analytics: true, recording: true});
  consent.set({...consent.get(), analytics: false});
  assert.deepEqual(createConsentStore(() => storage).get(), {analytics: false, recording: true});
  consent.set({...consent.get(), recording: false});
  assert.deepEqual(createConsentStore(() => storage).get(), {analytics: false, recording: false});
  assert.deepEqual([...values.keys()], [CONSENT_KEY]);
});

test('malformed, old, and unavailable preference storage fail closed', () => {
  const {consent, values} = consentFixture();
  for (const raw of ['bad json', 'null', '{"version":0,"analytics":true,"recording":true}', '{"version":1,"analytics":"true","recording":true}']) {
    values.set(CONSENT_KEY, raw);
    assert.deepEqual(consent.get(), {analytics: false, recording: false});
  }
  const broken = createConsentStore(() => {throw Error('Blocked storage');});
  assert.deepEqual(broken.get(), {analytics: false, recording: false});
  assert.equal(broken.set({analytics: true, recording: true}), false);
  assert.deepEqual(broken.get(), {analytics: false, recording: false});
});

test('no consent prevents SDK loading and withdrawal during loading prevents initialization', async () => {
  const {consent} = consentFixture();
  let loads = 0, inits = 0;
  let finish!: (sdk: any) => void;
  const analytics = createAnalytics(() => {loads++; return new Promise(resolve => {finish = resolve;});}, consent);
  await analytics.initialize(enabled);
  assert.equal(loads, 0);
  consent.set({analytics: true, recording: true});
  const pending = analytics.initialize(enabled);
  consent.set({analytics: false, recording: false});
  finish({...privacyMethods, init: () => {inits++;}, capture() {throw Error('Unexpected');}});
  await pending;
  assert.equal(inits, 0);
});

test('failed preference writes disable this tab and report that saving failed', () => {
  const {storage} = consentFixture();
  storage.setItem(CONSENT_KEY, JSON.stringify({version: 1, analytics: true, recording: true}));
  const consent = createConsentStore(() => ({...storage, setItem() {throw Error('Storage full');}}));
  let notified = 0;
  consent.subscribe(() => {notified++;});
  assert.equal(consent.set({analytics: false, recording: false}), false);
  assert.deepEqual(consent.get(), {analytics: false, recording: false});
  assert.equal(storage.getItem(CONSENT_KEY), null);
  assert.equal(notified, 1);
});

test('recording-only consent never grants product analytics and the release lock blocks both', async () => {
  const {consent} = consentFixture(); consent.set({analytics: false, recording: true});
  let captures = 0;
  let config: Record<string, any> = {};
  const analytics = createAnalytics(async () => ({...privacyMethods, init(_token, options) {config = options;}, capture() {captures++;}}), consent);
  await analytics.initialize(enabled);
  analytics.track('unapproved', {count: 1});
  assert.equal(captures, 0);
  assert.equal(config.disable_session_recording, true);
  assert.equal(config.before_send({event: '$snapshot', properties: {private: 'text'}}), null);
});

test('withdrawal and shared-storage refresh stop collection even if SDK stop throws', async () => {
  const {consent, storage} = consentFixture();
  consent.set({analytics: true, recording: true});
  let stops = 0, optouts = 0, captures = 0;
  const analytics = createAnalytics(async () => ({...privacyMethods, init() {}, capture() {captures++;}, stopSessionRecording() {stops++; throw Error('SDK failure');}, opt_out_capturing() {optouts++;}}), consent);
  await analytics.initialize(enabled);
  consent.set({analytics: true, recording: false});
  storage.setItem(CONSENT_KEY, JSON.stringify({version: 1, analytics: false, recording: false}));
  consent.refresh();
  analytics.track('unapproved', {stage: 'initial'});
  assert.equal(stops, 3); assert.equal(optouts, 3); assert.equal(captures, 0);
  assert.deepEqual(consent.get(), {analytics: false, recording: false});
});

test('final boundary rejects SDK events, recordings, errors and all unapproved events regardless of consent', () => {
  for (const analytics of [false, true]) for (const recording of [false, true]) {
    for (const event of ['$pageview', '$snapshot', '$exception', '$identify', 'unapproved']) {
      assert.equal(filterOutgoingEvent({uuid: '00000000-0000-0000-0000-000000000000', event, properties: {token: 'secret', $current_url: 'https://example.com/?token=secret', $referrer: 'private', result: {private: true}}}, {analytics, recording}, enabled.VITE_POSTHOG_PROJECT_TOKEN), null);
    }
  }
  assert.deepEqual(sanitizeProperties({stage: 'plan', $current_url: 'secret', $referrer: 'secret', access_token: 'secret', invite_code: 'secret', result: 'private', backend: {}, $set: {private: true}}), {stage: 'plan'});
});

test('replay masks inputs/text/attributes and blocks all network payloads and sensitive containers', () => {
  assert.equal(replayPrivacy.maskAllInputs, true);
  assert.equal(replayPrivacy.maskTextSelector, '*');
  assert.equal(replayPrivacy.maskAllElementAttributes, true);
  for (const key of ['recordHeaders', 'recordBody', 'streamNetworkBody', 'captureJsonLd', 'recordCrossOriginIframes'] as const) assert.equal(replayPrivacy[key], false);
  for (const selector of ['.review', '.website-plan', '.cluster-evidence', '.invite-form', 'input[type="hidden"]', 'input[type="file"]']) assert.ok(replayPrivacy.blockSelector?.includes(selector));
  assert.equal(replayPrivacy.maskCapturedNetworkRequestFn?.({} as never), null);
});

test('property filtering drops unknown fields, free text, nested objects and invalid numbers', () => {
  assert.deepEqual(sanitizeProperties({stage: 'initial', outcome: 'success', count: 2, duration_ms: 50, token: 'private', offering: 'private', context: {secret: true}}), {stage: 'initial', outcome: 'success', count: 2, duration_ms: 50});
  assert.deepEqual(sanitizeProperties({stage: 'private business name', outcome: 'private error', count: NaN, duration_ms: -1}), {});
});

test('diagnostic requires local production test mode and explicit analytics consent', async () => {
  const env = {...enabled, MODE: 'posthog-test'};
  assert.equal(connectionTestAllowed(env, '127.0.0.1'), true);
  for (const [config, host] of [[enabled, 'localhost'], [env, 'topicgibbon.com'], [{...env, PROD: false}, 'localhost'], [{...env, VITE_POSTHOG_ENABLED: 'false'}, 'localhost']] as const) {
    assert.equal(connectionTestAllowed(config, host), false);
  }
  let loads = 0;
  const {consent} = consentFixture();
  const analytics = createAnalytics(async () => { loads++; throw Error('must not load'); }, consent);
  assert.equal(await analytics.connectionTest(env, 'localhost'), 'blocked');
  consent.set({analytics: false, recording: true});
  assert.equal(await analytics.connectionTest(env, 'localhost'), 'blocked');
  assert.equal(loads, 0);
});

test('manual diagnostic strips SDK metadata and closes collection after one attempt', async () => {
  const env = {...enabled, MODE: 'posthog-test'};
  const consent = grantedConsent();
  let config: Record<string, any> = {}, captures = 0, optouts = 0;
  const raw = {uuid: '00000000-0000-0000-0000-000000000000', event: 'posthog_connection_test', properties: {
    token: 'untrusted', distinct_id: 'personal', $current_url: 'https://private/?token=secret', $referrer: 'private',
    research: 'secret', results: {}, access_token: 'secret', invite_code: 'secret', $session_id: 'personal', $browser: 'private', count: 3,
  }, $set: {email: 'private'}};
  const analytics = createAnalytics(async () => ({...privacyMethods,
    init(_token, options) {config = options;},
    opt_in_capturing(options) {assert.deepEqual(options, {captureEventName: false});},
    opt_out_capturing() {optouts++;},
    capture(event, properties, options) {
      captures++;
      assert.equal(event, raw.event); assert.deepEqual(properties, {}); assert.deepEqual(options, {send_instantly: true});
      const clean = config.before_send(raw);
      assert.deepEqual(clean, {uuid: raw.uuid, event: raw.event, properties: {
        token: env.VITE_POSTHOG_PROJECT_TOKEN, distinct_id: 'topic-gibbon-connection-test', diagnostic: true,
        environment: 'local', $process_person_profile: false, $geoip_disable: true,
      }});
      assert.equal(config.before_send({...raw, event: '$pageview'}), null);
      return clean;
    },
  }), consent);
  await analytics.initialize(env);
  assert.equal(config.before_send(raw), null);
  assert.equal(captures, 0);
  assert.equal(await analytics.connectionTest(env, 'localhost'), 'attempted; verify receipt in PostHog');
  assert.equal(config.before_send(raw), null);
  assert.equal(await analytics.connectionTest(env, 'localhost'), 'already attempted; reload to retry');
  analytics.track(raw.event);
  assert.equal(captures, 1); assert.ok(optouts >= 2);
  consent.set({analytics: false, recording: false});
  assert.equal(await analytics.connectionTest(env, 'localhost'), 'blocked');
  assert.equal(filterOutgoingEvent(raw, consent.get(), env.VITE_POSTHOG_PROJECT_TOKEN), null);
});

test('diagnostic handles SDK failure and consent withdrawal while loading', async () => {
  const env = {...enabled, MODE: 'posthog-test'};
  const consent = grantedConsent();
  let finish!: (sdk: any) => void;
  const analytics = createAnalytics(() => new Promise(resolve => {finish = resolve;}), consent);
  const pending = analytics.connectionTest(env, 'localhost');
  consent.set({analytics: false, recording: false});
  finish({...privacyMethods, init() {assert.fail('must not initialize');}, capture() {assert.fail('must not send');}});
  assert.equal(await pending, 'unavailable or consent withdrawn');
  let stopped = 0;
  const failing = createAnalytics(async () => ({...privacyMethods, init() {}, capture() {throw Error('failure');}, opt_out_capturing() {stopped++;}}), grantedConsent());
  assert.equal(await failing.connectionTest(env, 'localhost'), 'unavailable');
  assert.equal(stopped, 2);
});
