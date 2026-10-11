# Progress

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
