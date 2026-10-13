## Current handoff - 2026-10-12, after invite-field fix

This is the current stopping point; older milestone notes below are historical.

### Where we stopped

- Live app: https://ardent-fly-778.convex.site. The invite-entry fix was deployed successfully using `npm run deploy`; the live JavaScript was checked for the new controls.
- Invite entry now has Show code / Hide code and Clear code. Clearing shows an explicit confirmation. The input stays mounted during updates so editing and cursor position are preserved. Phone capitalization/autocorrection are disabled, and a rejected code can be replaced without duplicate submissions.
- All 72 automated tests and the production build passed. Browser access was unavailable, so these checks do not constitute visual verification on a phone. The user has not yet confirmed the latest invite-field fix.
- The invite code has NOT changed. Production matches the private copy in `artifacts/invite-code.txt`; never print or commit it. A separate live test confirmed that the valid code unlocks and survives reopening. The user's latest known run was still locked after one rejected attempt; no automatic unlock was applied.
- The user confirmed the earlier one-card recovery: refresh showed the correct card and Continue reached payment. Original searches were preserved. The first view now permits 1-4 cards, with at least two sourced queries per card.
- Milestone 5 (full research and Demand Map review) is implemented and deployed, with live server checks completed, but user phone acceptance is still pending. Milestone 6 (final website plan) has not been implemented. Real Razorpay payments remain disabled; the user does not yet have a test account.
- Last pushed checkpoint: `97f84d3` (one supported first-view card). Milestone 5 and the latest invite-field changes remain in the working tree, including new files. Preserve them; do not reset or discard them.

### What to do next

1. On the SAME phone tab, refresh, open Have an invite code?, tap Clear code, paste the existing code, inspect it with Show code, then tap Apply. Confirm that clearing/replacing works and the run opens full research.
2. If entry still fails, inspect the exact visible error and saved run state before changing code. Do not rotate the code, repeat searches, or bypass review/payment checks to hide the problem.
3. After unlock, finish the milestone-5 phone check: let research complete, inspect the full query/source list, try a correction, answer any consequential question, confirm the Demand Map, and refresh to verify it remains saved without restarting searches.
4. After the user confirms the relevant flow works, save and push its working changes and record acceptance here. Then discuss the milestone-6 website-plan implementation before writing new code.

# Progress

- 2026-10-12 — Fixed Correct feedback and card-list jumps. The scrolling list and unchanged cards now stay mounted during saves, preserve scroll/source expansion, and show Saving immediately on the selected card. Marked correct appears only after a confirmed server write; failures stay on the affected card with retry available. Already-correct cards cannot send duplicate saves. Added in-memory UI regressions for delayed success, failure/retry and correction-form validation/Cancel; they reproduced the old failures. All 57 tests and build passed. Three separate live test-run saves took 301/296/357 ms from this computer (`artifacts/card-save-timing.json`); that is not phone timing. Phone visual/interaction verification remains unavailable and awaits user confirmation.

- 2026-10-12 — Fixed first-value recovery after a partial search failure. A failed fourth request previously prevented grouping three saved responses and made Retry hit the same limit. Retry now resumes saved evidence; a partial provider failure can proceed to grouping, with the failure and incomplete-coverage warning retained. Insufficient evidence directs the user to edit context instead of repeating a futile retry. The regression test failed with SEARCH_LIMIT before the fix; all 54 tests and production build passed afterward. Deployed and resumed the exact reported Singapore-services run, producing two cards from its original saved sources without increasing 4/4 searches. Phone interaction still awaits user confirmation. Verification: `artifacts/search-recovery-verification.txt`.

- 2026-10-12 — Milestone 4 unlock screen deployed. Saved review now has Continue; successful new review also opens Unlock. Close preserves cards. Private single invite code configured on both deployments; local copy in ignored `artifacts/invite-code.txt`. All 51 tests and production build passed. `scripts/verify-unlock.ts` passed live unconfirmed-review rejection, wrong-code rejection, comped unlock persistence, immutable saved understanding, unchanged evidence and disabled checkout without test credentials. User has no Razorpay account: real Checkout, UPI intent/QR and webhook delivery are untested; no live charging is enabled. Full research is not connected and the unlocked screen says so. Browser interactions remain unverified. Setup and boundaries are in `PAYMENT_SETUP.md`; milestone 4 is not complete.

- 2026-10-12 — Milestone 3 part 2 deployed, awaiting user review. Added query selection for splitting and one-card merge selection, including retained selections on retry. All 45 tests and production build passed. A separate live test using saved real evidence passed actual AI split, merge, unaffected approvals, exact evidence preservation and Continue saving both corrections, with zero new searches. Reproduce with `npx tsx scripts/verify-card-grouping.ts`; private test receipt is in ignored `artifacts/m3-part2-live-receipt.json`. Browser inventory remains empty, so phone/desktop interaction and layout checks remain unverified. No part-2 completion commit/push until user confirmation.

- 2026-10-12 — Milestone 3 part 1 passed user review: desktop and correction actions reported working; phone screenshot confirmed the saved state, and the user confirmed the clearer “Your review is saved” message after deployment. All 42 tests and build passed. Continue is outside the scrolling cards. Agent browser checks remain unavailable. Next: part 2, selecting queries that do not belong and merging cards, preserving evidence and unaffected approvals.

## 2026-10-11 - Milestone 3 part 1: deployed, browser checks pending

- Stopped after building Correct, Exclude, Explain a wrong label, and Describe another correction, and deploying with `npm run deploy` to https://ardent-fly-778.convex.site/. Corrections use the existing engine, preserve original evidence and unaffected approvals, and require the changed card to be reviewed again. Continue saves the accepted understanding.
- Checked: all 42 automated tests passed; build passed; live server checks passed using saved real search evidence in a separate test run, with no additional searches. These were server checks, not phone or desktop browser checks. Raw results are in `artifacts/milestone-3-part-1-tests.txt` and `artifacts/milestone-3-part-1-live-tests.txt`.
- Still open: phone and desktop interaction checks could not run because no browser was connected. Part 1 has not yet passed user review. No UX fixes were made; details are still to come from the user. Part 2 has not started.
- Next: connect browser access, test all four actions and Continue on the live link at phone and desktop sizes, and paste the raw results. Then stop for the user's yes. Only after that approval, build part 2: select queries that do not belong, and merge. Preserve the working milestone 2 flow and earlier runs.

- UX fixes open, details to come from me later.

- 2026-10-11 — User confirms milestone 2 is live at https://ardent-fly-778.convex.site/ and works on phone and desktop; decision: preserve the working flow and plan milestone 3 (Correct / Fix this) before coding. Open: search-provider failures/retry experience and thin-evidence dead ends; the user's additional UX-fix list is awaiting clarification and has not been invented.

- 2026-10-11 ? Milestone 2 passed user review: user saw the live cards and reported all 4 accurate; live SerpAPI evidence, sourced cards, a visible four-search limit and explicit failures work. Decision: keep the milestone 1 engine and move to planning milestone 3 (Correct / Fix this). Still unresolved: SerpAPI can return 503, thin evidence can prevent cards, and automated browser/layout checks remain unavailable.

- 2026-10-11 — Milestone 1 passed user review on run j97dr7ghay28gsesgnqc38c3ds8g295p: 8/10 pages kept (80%, above 75%); batched reasoning produces a demand map and website plan with all 372 evidence IDs assigned exactly once. Decision: keep medium reasoning and structured batches of 50, preserve earlier runs, and move to Milestone 2. Still unresolved: four Core families remain conditional sections, duplicate suction coverage and a business-only source-label mismatch remain; browser/phone verification and production deployment are still pending.

## 2026-10-11 — Milestone 1 paused at AI access

Milestone 1 is not complete. The approved scope is one offering in India: real search evidence plus minimal business context in, a demand map and draft website plan out. Use the supplied MRI experiment and a plain test page.

### Completed and checked

- Read all nine files in `clustering logic/` and incorporated their grouping rules and pass line into `PLAN.md`. The original CSV files remain unchanged.
- Imported all 406 original evidence rows: 372 distinct working queries, 27 repeat occurrences and 7 search-only seeds. Preserved original source references; did not invent queries or volumes.
- Implemented the demand-map and website-plan generation flow, saved first responses, separate corrected versions, and practitioner scoring. Generation inputs are separated from the human answer key.
- Scoring shows pages kept as a count and percentage against the 75% pass line. Example only: **Pages kept: 8 of 13 (61.5%) — below the 75% pass line.** This is not a new MRI result.
- Passing requires both at least 75% kept and no Core need completely missed. The coverage checklist contains 14 Core needs. Unfinished reviews remain pending.
- All 22 automated tests passed. The frontend build and Convex TypeScript checks passed. Convex development functions were updated, and the real evidence import succeeded.
- Updated `README.md` with setup, running and scoring instructions.

### Where work stopped

- A real AI generation attempt stopped because Convex AI Gateway access was unavailable and no server environment variables were set on the development deployment `dynamic-crane-178`.
- No complete AI-generated MRI result or new practitioner score exists yet. Do not report the example score as an actual result or substitute test data for research.
- The saved run is `j971va29ts7jcx9fnahegwtc3h8g0f8r`. Its receipt is in `artifacts/mri-experiment-receipt.json`. Resume this run rather than replacing its first response.
- The page has not been verified in a browser or at phone width. Available browser access was missing during the work.
- No production deployment, commit or push was completed. No Git repository was present at the last check. The user has not confirmed the milestone works.

### Next steps

1. The user sets AI access privately from PowerShell in `C:\Users\catch\build-sprint-app`:

   ```powershell
   npx convex env set OPENAI_API_KEY
   ```

   Enter the key at the terminal prompt, never in chat, source files or a `VITE_` variable. Enabling Convex AI Gateway is an alternative. No search API key is needed for this supplied-file experiment.

2. Run `npm run research:mri` to resume the saved experiment. Inspect and preserve the first complete response, including any validation failure. The command prints the full output and writes the result and scoring record under `artifacts/`.
3. Run `npm run dev`, open the exact run URL printed by the research command, and verify the page flow in a browser. Check phone width; the phone can use Vite's Network address on the same Wi-Fi.
4. Review the actual demand map and draft website plan against the approved grouping rules. Have the practitioner record keep/reject reasons and all Core-coverage decisions. Keep original and revised results and scores separate.
5. Fix any observed failures, rerun relevant checks, and deliver the exact run steps plus the **full actual output**, not a summary.
6. Only after the user confirms the milestone works, handle the requested commit/push and add the completion entry here. Stay within milestone 1; no Landing, forest, Gibbon or styling work.

- 2026-10-12 - Fixed temporary search recovery: up to two extra attempts, at most two attempts per planned query, completed queries never repeated; new evidence clears stale grouping. 60 tests pass and production build/deployment checked. Resumed reported run: original two results unchanged, one additional result saved, six attempts total; evidence still insufficient for two cards. No phone/browser verification available. Next: diagnose retrieval relevance separately; do not lower evidence requirements or retry indefinitely.

- 2026-10-12 - Improved first-view search planning and service relevance: separate planning instructions from evidence-only analysis, require distinct requests of at most eight words, consider generic provider comparisons while preserving unrelated-brand exclusions and genuine ambiguity. Saved 16-query replay retained the previously excluded comparison; still honestly insufficient for two cards. Fresh development pass completed all four searches and generated four sourced draft cards from 30 observed queries. Production replay of that evidence completed with three sourced cards and zero new searches; all displayed queries/sources matched saved responses. 61 tests and build pass; npm run deploy completed. Original failed user run unchanged. Phone/browser check unavailable; next user check is refresh, Edit context, restart the same description.

- 2026-10-12 - USER PASS: completed the full flow from start through cards, stable card position, correction, approval, Continue, payment screen and invite-code Continue on phone. Milestone 3 and milestone 4 invite path accepted. Save/push working checkpoint. Next: full research and Demand Map review; real Razorpay checkout remains untested pending account setup.

- 2026-10-12 - Milestone 5 implementation deployed: unlocked runs start durable full research (up to eight new searches plus two bounded temporary-failure retries), preserve confirmed corrections/exclusions and completed evidence, and open Demand Map review with every retained query/source, area correction/split/merge/exclusion, consequential questions including custom answers, and saved confirmation. Refresh resumes without duplicate searches. No invented volumes; website architecture remains milestone 6 and real charging remains disabled. 68 automated tests, frontend build, Convex checks passed. Separate live development run completed five new searches, eight demand areas, 35 retained queries and two questions; real AI correction, custom answer and confirmation passed. Production replay completed three sourced areas and three answers, saved confirmation and reopened without additional searches. Browser surfaces unavailable; phone layout and user milestone acceptance still pending. User test: refresh the already-unlocked run, inspect evidence, try a correction, answer any question, confirm the map, then refresh.

- 2026-10-12 - Approved first-view fix: allow 1-4 cards while retaining at least two sourced examples per card; reject zero cards and missing sources. All 70 automated tests, frontend build and Convex checks passed. Live development replay of the reported saved grouping produced one card with three exact sourced examples, approved and reopened successfully. Deployed through npm run deploy and recovered the original production run: one card, original four searches/responses/batches unchanged, no additional searches, user review left pending. Browser unavailable; phone check pending: refresh the same tab, review the card, then Continue. Milestone 5 phone acceptance is still pending.

- 2026-10-12 - USER PASS: refreshing the recovered run showed the single card with correct options and Continue reached the invite/payment screen. Production invite setting matches the existing private local code; separate live invite validation passed. User run has one rejected invite attempt and remains locked; no code rotation or automatic unlock performed.

- 2026-10-12 - Invite-entry fix approved and implemented: keep the same input mounted during saved-state updates; add Show/Hide and Clear code with an explicit cleared message; disable phone capitalization/autocorrection; preserve replacement entry after rejection and block duplicate submits. Two new UI regression tests reproduce the original replacement problem and verify correction. All 72 tests and build pass; phone visual verification remains unavailable.

- 2026-10-13 - USER PASS: invite entry, full research, relevance questions, card approval and saved Demand Map completed on the user's phone. Milestone 5 accepted; milestone 6 website structure approved next.
