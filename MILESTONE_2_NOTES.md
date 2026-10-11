# Milestone 2 — awaiting browser verification and production setup

The first-value flow uses the milestone 1 assignment and consolidation engine: gpt-6-luna, medium reasoning, 64,000 maximum output tokens, strict evidence keys, batches of at most 50. The original experiment files, runs and review remain unchanged. The milestone 1 screen is retained at `/milestone-1.html`.

The new flow asks for the offering, an optional business website, and up to two reference websites. Website text is context only. The first view stops at 2–4 need cards; correction, payment and full website planning remain later milestones.

Every search attempt reserves one of four slots on the server before the provider call. Failed attempts count, and retrying the same run cannot reset the count. Successful search responses and model batches remain saved. The UI exposes the count, search activity, source timestamps and failures. Search requests use SerpAPI's `no_cache=true`; there is no fake-data or older-run fallback.

Live development run `jh7ctecgcwj3anqqkd2zxv6znn8g2bab` completed with 3/4 searches and three cards: hospital beds, examination tables, medical trolleys. All cards contain 2–3 exact observed queries and source references. The receipt and result are saved in ignored `artifacts/` files. Public website reading succeeded for example.com and returned an explicit error for example.invalid.

The frontend build and automated tests pass. Browser controls reported no available browser, so desktop, phone, keyboard and on-screen failure checks are still pending. Do not describe the milestone as complete or user-approved.

Production keys were set privately by the user and their names verified. `npm run deploy` succeeded on 2026-10-11: https://ardent-fly-778.convex.site. The published HTML, scripts, stylesheet, placeholder image and font all returned HTTP 200. Fresh production run `jd74aezpsqhj5acp02bacpn3b98g2k8x` completed with 3/4 searches and three cards: hospital beds (2 sourced queries), examination tables (3), medical trolleys (2). Its receipt and complete result are saved under ignored `artifacts/first-value-production-*.json`. Browser access remained unavailable; deployment and backend validation do not establish that phone/desktop layout or keyboard flows work. Milestone 2 remains pending visual verification and user review. No milestone completion commit has been made.

## Mobile search failure ? 2026-10-11

User reported SerpAPI could not be reached. Production run `jd7aj0pk92j995a00yjffmxf9d8g2xaz` had one successful search and a second failed search. The search action ended after 46.07 seconds, consistent with its former 45-second request timeout. Increased the single-request deadline to 120 seconds and separated timeout, network and HTTP error messages. No automatic extra search, budget reset or fallback was added. All 37 tests and the build passed; `npm run deploy` completed.

Retried only the missing search in the same saved run. It succeeded, bringing the count to 3/4 including the original failed attempt. The original failure stays in the search activity. The two successful responses contain seven distinct questions; the engine excluded five unrelated scanner/patient/history questions and retained only two material-compatibility questions in one group. Consequently the run still cannot honestly produce the required 2?4 cards. Asked the user which actual products are offered to test a more specific description; do not describe that as a remaining network failure or fabricate cards. Before/after artifacts and full test output are under ignored `artifacts/`.

## User acceptance ? 2026-10-11

The user confirmed seeing the cards in the live browser and reported all four accurate. This is the user?s review, not a claim that the earlier two-card diagnostic run had four cards. Milestone 2 is accepted. Automated browser, keyboard and responsive-layout checks remain unavailable. Milestone 3 is next; no milestone 3 implementation has begun.
