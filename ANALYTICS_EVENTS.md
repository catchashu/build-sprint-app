# V1 workflow analytics (collection OFF)

The code release lock `COLLECTION_RELEASED = false` in `src/analytics.ts` blocks all workflow events and analytics identity/marker creation, even with enabled environment configuration and consent. The previously approved manual localhost diagnostic is separate. No UI or consent defaults changed.

## Event contract

| Event | Successful trigger | Frequency |
| --- | --- | --- |
| onboarding_started | Valid Landing submission finishes the arrival handoff and opens Website Context | Once per journey |
| initial_results_viewed | Initial research is complete and the review subscription has rendered nonempty cards | Once per journey |
| final_plan_viewed | A complete website plan is rendered in the mounted plan view | Once per journey |
| excel_export_triggered | Workbook generation resolves after the browser download link is clicked | First successful export per journey |

Export means download triggered, not proof the user saved the file. Repeated downloads still work but do not add funnel milestones. Subscription updates, corrections, remounts and refreshes do not resend already recorded milestones.

The final outgoing filter reconstructs the payload; it does not trust any SDK-added or caller-supplied event properties. Workflow fields are limited to the project routing token, an event UUID, random `distinct_id`, random `journey_id`, `view_kind` (`new` or `reopened`), and fixed flags disabling person profiles and IP geolocation. No research IDs, access tokens, business text, URLs, referrers, session IDs or customer information are passed into analytics.

## Identity and resumed work

An independently generated `tg_` UUID is stored as the browser's anonymous analytics identity. A different random ID is attached to each journey's existing saved application state. Starting a new run or using Edit context resets the journey. These IDs are unrelated to the research access token and backend ID. They are pseudonymous browser identifiers, not proof of a unique person or cross-device identity.

Dedicated local-storage keys hold only the identity and milestone flags. With storage intact, a refresh or reopened saved plan keeps the same journey and suppresses milestones already recorded. A completed result first encountered on subscription is classified `reopened`; completion observed after an in-progress state is `new`. Previously recorded views are suppressed entirely. Legacy saved runs get a new analytics journey on their first eligible view, with no invented onboarding event. For a new-completion funnel, filter view events to `view_kind = new`, and group/hold constant `journey_id` so separate runs by one browser are not combined.

Only consented, released activity is recorded. No old milestones are backfilled after consent. Withdrawal immediately blocks future captures; local random IDs and flags remain, so later re-consent does not resend milestones. Clearing browser storage removes that continuity. Unavailable storage or crypto skips analytics. Markers are saved before capture: failed network/SDK delivery can undercount rather than create duplicates. Web Locks serializes claims across tabs where supported; simultaneous tabs without that browser API are best effort. SDK retries can retransmit the same event UUID. A dispatched request cannot be recalled by withdrawal.

## Before production activation

1. Approve activation separately. Review the currently Landing-only What? ? Privacy access before collecting during longer journeys; no new UI was added here.
2. Run a controlled four-event test with fake research data, including reload/reopen, failed export and withdrawal. Automated tests prove the rules and render/download hooks, but actual four-event PostHog delivery has not been tested with the release lock open.
3. After approval, change the code release lock, configure the existing EU project's public token, EU host and exact enabled flag for the production build, then build/test and deploy only with separate authorization. An environment flag alone cannot activate this implementation.
4. Verify event payloads and a journey-based funnel in PostHog. Keep replay, autocapture, pageviews, console/network recording and automatic errors disabled.

All requests necessarily expose a network IP to the receiving service even with geolocation disabled. The filter protects event payloads, not browser-managed HTTP headers. The diagnostic and normal event paths remain independent.
