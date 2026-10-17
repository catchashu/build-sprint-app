# Controlled local PostHog connection test

No test event has been sent as part of preparing this code. Ordinary builds keep collection blocked. The diagnostic is available only in a production build with mode `posthog-test`, enabled configuration, a loopback hostname, saved analytics consent, and a manual command. Session replay, automatic interactions, pageviews and automatic errors stay disabled. No workflow events are enabled.

## Configure locally (after approval to send the test)

1. In your editor, create `.env.posthog-test.local` in the repository root. Do not paste the token into chat, a terminal command, screenshots or source files. Use the **public project token** beginning `phc_` from PostHog project settings, never a personal/admin API key. This public token is necessarily included in the local browser build; it is not a secret server credential.
2. Put these three lines in that local file, replacing the placeholder in your editor:

```dotenv
VITE_POSTHOG_PROJECT_TOKEN=phc_REPLACE_IN_YOUR_EDITOR
VITE_POSTHOG_HOST=https://eu.i.posthog.com
VITE_POSTHOG_ENABLED=true
```

3. Confirm it is ignored without printing its contents:

```powershell
git check-ignore .env.posthog-test.local
```

It must print the filename. Do not proceed if it does not. Existing environment files need no changes. This mode-specific file is not loaded by ordinary development or production builds.

## Build and serve locally

From the project folder:

```powershell
npm.cmd exec -- tsc --noEmit
npm.cmd exec -- vite build --mode posthog-test --outDir artifacts/posthog-preview
npm.cmd exec -- vite preview --outDir artifacts/posthog-preview --host 127.0.0.1 --port 4174 --strictPort
```

Open `http://127.0.0.1:4174/` in a fresh private browser window. Do not deploy or share this build. The output is under ignored `artifacts/`, separate from deployment's normal `dist/` output. Vite may use existing backend configuration: stay on Landing and do not start research or payments.

Accept analytics, or use What? ? Privacy to enable analytics only. Leave session recording OFF. Consent alone sends no diagnostic. Open browser developer tools ? Network and Console. Run this command **only when ready to send one synthetic event**:

```javascript
await window.topicGibbonPostHogConnectionTest()
```

The command attempts at most one capture per page load and immediately closes the collection gate again. `attempted` is not a delivery confirmation. `blocked` means configuration, localhost or consent requirements were not met. An undefined function means this is not the correctly configured local test build.

## Verify and finish

In the EU PostHog project, open Activity ? Live events and find `posthog_connection_test`. Confirm the fixed identifier `topic-gibbon-connection-test`, `diagnostic: true` and `environment: local`. The outgoing event includes only these, the project routing token, a generated event UUID, and flags disabling person profiles and IP geolocation. Inspect the outgoing payload: no page URLs, referrers, session IDs, browser metadata, research, results or credentials should survive. PostHog may add server-side processing fields on receipt. Network success alone does not prove ingestion; confirm the event in PostHog.

No browser recording, `$pageview`, `$autocapture`, `$exception` or `$opt_in` event should appear. The SDK may retry a failed delivery of the same synthetic event. Withdrawal prevents new captures, but cannot retract an already dispatched request. PostHog necessarily sees the network connection's IP address even with geolocation disabled. Use a clean localhost URL with no sensitive query or fragment; the event filter governs JSON payloads, not browser-managed HTTP headers.

After verification, decline collection through What? ? Privacy, stop the preview server (Ctrl+C), and remove the test-only local environment file or change its enabled value to false. Rebuild before another preview if configuration changes. Do not deploy the diagnostic build. Live collection remains a separate approval and privacy review.

Automated tests use a fake SDK and token; they verify consent, local gates, filtering and failure handling without contacting PostHog. Actual ingestion remains unverified until this controlled test is authorized and run.
