# MRI experiment — milestone 1

Real supplied search evidence and business context in; a demand map and draft website plan out. A plain development test page using the unchanged CSVs in `clustering logic/`.

## Run

In PowerShell in `C:\Users\catch\build-sprint-app`:

```powershell
npm install
npx convex env set OPENAI_API_KEY
npx convex dev --once
npm run dev
```

The key command prompts privately in your terminal and stores the key on Convex. Never put it in chat, code or a `VITE_` variable. An enabled Convex AI Gateway can be used instead. No search key is needed for your supplied evidence.

Open the Local address printed by Vite. On your phone, open the Network address while both devices share Wi-Fi and the computer remains running.

1. Load the supplied experiment. Inspect 406 original rows: 372 distinct working queries, 27 repeat occurrences and 7 search-only seeds.
2. Generate the first demand map and draft plan. Inputs, rules and the first complete response are saved. A completed invalid response is preserved rather than silently replaced.
3. Inspect the full result and source references. No volume is inferred; demand is labelled Insufficient evidence.
4. Keep or reject each scored area with a reason. Check all 14 Core needs separately, naming supporting page IDs when covered.
5. Save the scoring record. It shows, for example: Pages kept: 8 of 13 (61.5%) — below the 75% pass line. Passing requires at least 75% kept AND no Core need completely missed. Incomplete reviews remain pending.
6. Enter a correction after scoring to create a separate revised result with its own score.
7. Download the full output, scoring record, settings and history.

About/Contact and on-page Sections/FAQs do not count toward the keep rate. Page and standalone Supporting Content entries count once. Human judgement controls the score.

## Full terminal output

```powershell
npm run research:mri -- --import-only
npm run research:mri
```

The second command prints the full generated output and scoring record and writes `artifacts/mri-full-output.json` and `artifacts/mri-scoring-record.json`. Scoring stays pending until reviewed. Repeating the command resumes the saved run. Open its printed browser URL to review that exact run.

Without AI access, import works but generation stops with an explicit error. No replacement research is invented.

## Separate structured-batch experiment

```powershell
npx tsx scripts/run-batched-attempt.ts
```

This starts one separately saved `gpt-6-luna` attempt with medium reasoning and a 64,000-token output limit per call. Its receipt is `artifacts/mri-batched-medium-attempt-receipt.json`. Repeating the command only watches/exports that same attempt; a finished attempt is never regenerated. The older `mri-batched-*` receipt preserves an API schema rejection before generation.

The 372 canonical queries are sent as seven batches of 50 and one of 22. Each strict response schema contains a required field for each exact input ID and permits only one destination. No other ID field is allowed. Code collects each input ID once. A global grouping step merges synonymous needs; it cannot change evidence ownership. The final architecture step has no writable evidence-ID lists. Code attaches the saved assignments and validates the complete draft. Original observations, duplicate occurrences and search-only seeds remain in the frozen input.

Convex Workflow saves each model step and has retries disabled. A refusal, incomplete response or invalid schema stops the attempt; it does not become a fabricated passing result. The command exports the run, every request/schema/response, the merged draft and validation under `artifacts/mri-batched-*`. Earlier runs and their scores remain unchanged. Page-quality judgments remain a separate practitioner review.

To inspect on your phone, run `npm run dev` and open Vite's Network address on the same Wi-Fi, adding `/?firstRun=` followed by the run ID printed by the command.

## Code checks

```powershell
npm test
npm run build
npx tsc --noEmit -p convex/tsconfig.json
```

Tests cover evidence accounting, separation from the answer key, output checks, score arithmetic, frozen first responses and separate revisions. Test-only draft structures never become actual research results.

`npm run prepare:mri` rebuilds server fixtures from the original CSVs. Only evaluation receives the human answer key. This is a rules-informed evaluation of a known case, not a repeat of the untouched historical blind experiment.

This development page has no production access controls. Browser verification and an actual generated MRI result are required before declaring the milestone complete.


## Full research and demand map

After the first-value review and invite/test-payment unlock, the same run opens full research. It reuses saved evidence and confirmed corrections, adds at most eight planned searches plus two bounded temporary-failure retries, and saves each completed request. Refreshing the current browser tab resumes the run. The current session link is still held in session storage; cross-device/account recovery is not implemented.

Demand Map review exposes all retained queries and source links. Areas can be corrected, split, merged, excluded or restored. Only consequential relevance questions are asked, with a custom-answer option. Confirmation saves the corrected map and opens website planning. Already-confirmed maps have Build my website plan. No search-volume data is currently available, so demand is labelled Insufficient evidence. Live payment keys remain rejected.

`npm test` includes research access checks, evidence preservation, retry bounds, clarification persistence and a DOM-level scrolling check (not a visual phone test). The live scripts `scripts/verify-full-research.ts`, `scripts/verify-demand-map-review.ts` and `scripts/verify-full-research-production.ts` use private ignored fixtures under `artifacts/`; the first makes real development search requests, while the production script replays those responses without more provider searches. Do not print private receipt tokens or the invite-code file.

## Website plan

Website planning takes an immutable snapshot of the accepted Demand Map, corrections, exclusions and clarification answers. It makes no search requests. Convex Workflow generates the architecture with the existing AI model and validates cluster references, complete retained-area coverage and an acyclic hierarchy before showing it. A pending business question pauses the plan; answers are saved as business context, never search evidence. Corrections create a new saved version and can change only the selected recommendation; failures retain the previous plan. Editing the Demand Map requires reconfirmation before making a fresh plan.

The result uses a collapsible hierarchy with Page / Section / FAQ / Supporting Content and First / Next / Later priority. Why this? exposes coverage, rationale, mapped demand areas and exact saved sources. Download Excel lazily loads ExcelJS and exports Website plan, Demand areas, Search evidence, and Context and limits. Text is stored as literal cells, never interpreted as spreadsheet formulas. ExcelJS's uuid dependency is overridden to the compatible patched CommonJS version 11.1.1 or later in that major.

The active tab retains its own run. Reaching website planning also saves a private run reference in this browser's local storage, so closing and reopening the browser can recover it. Starting a new run or exiting keeps a Reopen saved website plan action on the Landing; only the most recently opened plan is remembered. Clearing browser storage removes this recovery link; there is no cross-device/account recovery.

`npx tsx scripts/verify-website-plan.ts` verifies an existing confirmed development test run; add `--prod` for the saved production test run or `--receipt=artifacts/<private-receipt>.json` for another explicitly identified test run. It validates the generated plan, exact sources, unchanged Demand Map and search counts, and idempotent re-entry. `scripts/verify-website-plan-correction.ts` checks a real AI correction against the development test result. Receipts and generated results stay ignored under artifacts.
