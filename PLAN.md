# PLAN.md

## Current strategy — approved 2026-10-15

Phase 1 is UX and visual polish only, using the unchanged approved resting animation in every state. Phase 2 adds the state-specific Character Bible / DESIGN.md animations after Phase 1 approval. Phase 3 addresses deeper research, discovery, clustering, demand, priorities, output accuracy and integrations. This ordering supersedes older priority notes below.

Review one step at a time: 0 Landing (reopened for refinement); 1 Landing to Website Context; 2 reference context; 3 initial research; 4 initial cluster review; 5 unlock; 6 full research and Demand Map review; 7 plan generation; 8 final plan; 9 Excel / Exit / new run; 10 complete responsive journey. Cluster review means one cluster card at a time with tick/cross controls, not individual-topic cards or the older stacked-card layout. Preserve approved copy and design except explicitly authorized changes.

Phase 1 Step 0 is approved and complete (2026-10-15), including the Landing and four explainer popups. Save implementation and documentation together in GitHub. Current scope: Step 1, Landing to Website Context, explanation and review only; no implementation changes until authorized. State-specific animations remain Phase 2 work.

## Milestones

2026-10-13 approved next step: connect DataForSEO Google Ads live search-volume estimates for India/English using server-only credentials. One saved batch of up to 1,000 supported observed phrases per unlocked run; no automatic paid retries. Preserve search evidence and saved recommendations; show estimates, provenance and honest missing values in the map, plan and Excel. Demand bands use the strongest measured query (Low <100, Medium 100–999, High >=1,000) rather than summing overlapping phrases; disclose method and coverage. Integration is retained but optional by user approval: V1 uses server-side USE_DATAFORSEO=false in development and production. Only exact true plus both server credentials enables requests. Disabled, missing credentials, and provider/auth/funding failures must never block the Golden Flow. Real-volume success verification is deferred until explicitly enabled; no account top-up is required to test the app. User confirmed a fresh full run with a different offering worked end to end; optional V1 flow accepted.

2026-10-13 approved output-quality follow-up to milestone 6: tighten the separate-page versus section/FAQ decision and priority explanations, distinguish separate pages/resources from on-page content on screen and in Excel, preserve saved plans and source evidence. Implemented and live; automated, real-model, phone-width and downloaded-workbook checks passed. User confirmed a fresh run: subpages, reasoning, separated FAQs and priorities all passed. Accepted for commit/push. Search-volume integration remains outside this change.

2026-10-13 user acceptance: milestone 6 passed the full user flow, including the website plan, Excel download in the expected format, and Exit returning to the main screen. The invite-based end-to-end flow is accepted. Real Razorpay payment testing remains open; live charging stays disabled.

2026-10-13 approved milestone 6: turn the confirmed Demand Map into a saved hierarchical website plan with Page / Section / FAQ / Supporting Content, First / Next / Later priorities, traceable retained search evidence, and Insufficient evidence for demand while volume data is unavailable. Provide Why this?, a structured Excel download, targeted recommendation correction, and consequential clarification rather than guessing. Reuse existing research, preserve earlier plans/corrections, and resume after refresh. Keep live Razorpay charging disabled pending checkout testing. Milestone 5 passed user phone review.

2026-10-12 approved bug fix: first value may contain 1-4 supported cards. Each card still requires at least two distinct sourced queries. Never split one need just to reach a card count; preserve saved searches when recovering the reported run.

Milestone 5 (approved 2026-10-12): after unlock, expand the same confirmed run with up to eight new searches and two bounded temporary-failure retries, retain completed evidence, group by customer need, preserve corrections and exclusions, and show a saved Demand Map with full source inspection and area corrections. Ask only consequential relevance questions; save their answers. No invented search-volume ratings. Website architecture remains milestone 6; live Razorpay charging stays disabled until that promised output and checkout testing are complete.


2026-10-12 user acceptance: the complete start-to-invite-unlock flow passed on the user's phone, including stable cards, correction, approval, Continue and invite-code submission. Milestone 3 is passed; the invite path of milestone 4 is passed. Razorpay payment testing remains open until account setup. Next: milestone 5, full research and Demand Map review after unlock; implementation approved by the user; in progress.


Milestone 4 (approved 2026-10-12): connect saved-review Continue to the ₹399 UPI/invite unlock tray, preserving the same run and allowing Close/back. User has no Razorpay account yet. Implement and verify the server-only invite path; prepare UPI-only Razorpay test checkout, signed confirmation, webhook and return recovery. Reject live payment keys until the promised full research is connected. A saved unlock currently leads to an honest not-yet-started research status, not simulated research. Razorpay account setup, actual checkout/device testing, and the full-research handoff remain open.

Milestone 3 part 2 (approved 2026-10-12): add selection of searches that do not belong together and selection of one other remaining card to merge with. Reuse the existing AI correction workflow; preserve original evidence and unaffected approvals; require every changed card to be reviewed again. Passed user phone review on 2026-10-12; merging was confirmed earlier.

1. I can give the core reasoning engine real search evidence + minimal business context for one offering/market and receive a coherent demand map and draft website plan that I would genuinely use as a starting point. — passed user review (8/10, 80%)
2. I can describe one established offering in 1–2 lines on the Landing, optionally add an existing website and up to 2 competitor/inspiration URLs through progressive context questions, and see an initial India-grounded structure from lightweight real-search retrieval with 2–3 sourced query examples under each card. ? passed user review (all 4 cards accurate)
3. I can mark the product's initial understanding as Correct or Fix this, and any correction changes the understanding carried into the rest of the run. ? passed user phone review  
4. I can unlock one run after seeing first value either by paying through Razorpay UPI or by applying the single V1 invite code for 100% comped access, then continue the same analysis without creating an account.  
5. I can review a synthesised demand map grouped by underlying need/intent, see directional High / Medium / Low demand when reliable external volume evidence is available and Insufficient evidence when it is not, inspect the full retained relevant keyword/query set and provenance within each cluster when needed, and answer only an ambiguity that would materially change the output.  
6. I can receive a final prioritised hierarchical website page/content plan that labels each recommendation as Page / Section / FAQ / Supporting Content, shows what deserves website coverage and relative priority, and lets me trace each recommendation back to one or more underlying demand clusters and their retained relevant search evidence.  
Last: I can close it, reopen it, and my data is still there.

## Milestone 1 build plan — approved

Use the earlier MRI experiment in `clustering logic/` as the starting point. The milestone remains real evidence plus business context in, a demand map and draft website plan out. Use a plain test page, with no Landing, forest, Gibbon, payment or visual-design work. The user approved this revised plan and requested pages kept as both a count and a percentage against the 75% pass line.

### Inputs and evidence boundaries

- Preserve all nine original CSV files unchanged.
- Use `1 Raw Search Tree.csv` (the filename ends with this suffix) as the supplied evidence: 406 original nodes with their IDs, exact text, parent/path, source type and screenshot/narration references. Accept its actual CSV format and complete size; replace the current JSON-only, 150-query restriction rather than dropping rows to fit it.
- Keep search requests, catalogue seeds, observed autocomplete/questions/related searches, and narrated observations distinguishable. The supplied file includes these different source types; do not relabel every row as a live API observation or measured demand. Screenshot references are references in the CSV, not screenshots independently inspected in this folder.
- Deduplicate for reasoning across the whole dataset while retaining every original node ID and source occurrence. A retained query may inform more than one page through linked needs; deduplication must not erase cross-cutting modifiers or evidence provenance.
- Use confirmed business facts from `6 Business Context.csv`: India; the established MRI equipment business; MRI safety training for healthcare workers; no certification offering; MRI Faraday cage manufacture and installation. Preserve known catalogue facts as business context, not demand proof. Do not copy the existing website hierarchy.
- Keep the context sheet's demand-derived homepage target out of the generation input: it is an architecture conclusion, not a neutral business fact. Separate confirmed catalogue facts from the status/reasoning columns in `7 Seed Backlog.csv`; those columns are not blind-test inputs.
- Give the model only neutral business context, original evidence and the approved general grouping rules. Do not send the gold-standard rows, expected page names, retrieval decisions, product-learning examples or previous model results to the generation call. Answer-key material is for a separate evaluation step.
- This is a new rules-informed evaluation using a known case, not a claim to repeat the original untouched blind experiment. Freeze the input, rules, model settings and scoring interpretation before its first complete output.
- No search API key is needed for this supplied-file test. Keep all AI credentials on the Convex server. AI provider access remains to be resolved before the real reasoning run. Never invent queries, source dates, sources or volumes.

### Grouping and website rules

1. Apply business offering, buyer and India-market relevance before grouping. Training is offered; certification is not. Patient/implant questions, unrelated generic products, wrong geographies and support manuals generally do not belong in this acquisition plan. Preserve uncertain relevance explicitly rather than guessing. These are context-sensitive rules, not blanket keyword bans.
2. Group by the underlying customer need and actual product family. Merge genuine synonyms, but preserve meaningful subtypes and distinct complete product families. Do not merge separate products merely because they share a clinical use. Search wording is not proof of a product's actual MR safety classification.
3. Keep the product hierarchy separate from search breadth. A short branch does not make a complete machine an accessory or an important offered service irrelevant. Do not create products or branches to fill gaps.
4. Separate search intent (learning, evaluating, buying, or finding a brand) from customer stage (discovery, consideration, or purchase). Product/category browsing may already be purchase-stage. Price, cost, best, manufacturer, availability and lead-time are normally consideration sub-intents of the same product need.
5. Attach pricing, supplier, availability and geographic modifiers to the relevant product page. Avoid thin standalone price pages or automatic city pages. Broad whole-catalogue supplier intent may justify a homepage role when supported by evidence; do not hard-code that output into the model input.
6. Preserve observed brand/model vocabulary without assuming the business sells every brand. Recommend actual model-detail pages only for confirmed stock; otherwise mark business confirmation needed.
7. Distinguish major product families, accessories, individual products, services, and combined product-and-installation offerings. Keep the product's top-level output labels Page / Section / FAQ / Supporting Content, and add a more specific role such as Category page, Product family page, Product detail page, Service page, Product-service page, Article or Downloadable resource where useful.
8. Merge format variants such as PDF/PPT/handbook into the underlying information need, with a resource treatment when useful. Keep selection/specification/purchase FAQs where they help; follow the final recorded rule against generic compatibility-check FAQs for this specialist catalogue. Do not turn every question into a separate article.
9. Cross-product discoveries belong with the right family regardless of the search branch where they appeared. Keep provisional/needs-confirmation items separate from confirmed recommendations. Business-context-only coverage may be proposed if clearly labelled as not demand-validated; do not invent a query to support it.
10. Keep source evidence and AI interpretation separate. Account for each original row as retained, duplicated, excluded with a reason, seed-only, or unresolved. Trace recommendations to real evidence and/or explicitly labelled business context. Allow one page to serve several needs and one need to support more than one treatment without duplicating the underlying evidence.
11. Query recurrence and breadth are not volume. This experiment has no external volume measurements, so use Insufficient evidence for demand. Explain relative priority through business fit, customer intent and importance, separately from demand size.
12. Where future live retrieval is used, follow new meaningful branches and stop when they repeat, drift outside scope or add no new need. Queue adjacent product discoveries separately. Catalogue, synonym and geography checks guide coverage; they do not prove demand. Do not add live evidence to this frozen evaluation.

### Build and evaluation sequence

1. Import the supplied CSVs without changing them. Validate all 406 raw IDs, provenance and source types; show an import/accounting report. Keep generation inputs separate from evaluation-only files on the server.
2. Replace the current generic example context and flat grouping with the approved context and rules above. Produce a provisional demand map and product/content hierarchy with explicit merge/split reasoning and unresolved business questions.
3. Generate and save the first complete, uncoached draft website plan from that provisional map. Save the complete input, output and settings before feedback. No cherry-picking a later response as the first run.
4. Score that saved first result against the unchanged human answer key and website plan. Show a keep/reject decision with reasons for each scored AI-proposed page/content area, plus a separate check for each Core need. Human judgement controls the keep decisions; an AI self-score is not proof of passing.
5. Then support a small plain-page practitioner review of consequential merges, splits, product-family placement and page-versus-section choices. Generate a revised draft from accepted corrections. Keep it separate from the first output and score, so guided improvements never inflate the first-pass result. This is a milestone-1 reasoning check, not the styled onboarding/First-Value flow.
6. Test evidence preservation, synonym grouping, distinct product families, modifiers staying on-page, separate intent/stage fields, unknown-offer handling, business-only provenance and no invented volume. Check the actual test-page flow when browser access is available.
7. Deliver exact run steps and the full generated output, not a summary, along with the scoring record and any remaining limitations. Keep keys server-side. Commit/push and mark progress only after the user confirms the milestone works.

### Pass line — unchanged

- Keep at least 75% of the AI-proposed scored pages/content areas, AND completely miss none of the Core gold-standard underlying needs. Both conditions must pass.
- Keep rate = accepted scored AI-proposed areas / all scored AI-proposed areas. Fix the counting interpretation before the run; do not pad the denominator or numerator with on-page bullets or duplicate recommendations.
- Display the count and percentage together, for example: Pages kept: 8 of 13 (61.5%) — below the 75% pass line. For this run, count Page and standalone Supporting Content entries; exclude on-page Sections/FAQs and baseline About/Contact. Unreviewed decisions remain pending, never automatic rejects. Use the unrounded fraction for pass/fail.
- Equivalent purpose/scope under a different name counts. A reasonable merge can cover a Core need, but that does not automatically make the proposed architecture worth keeping. Coverage and keep rate are separate checks.
- The final Website Plan contains 14 Core entries. The demand-backed homepage is included in scoring. About and Contact are baseline site hygiene and excluded.
- Preserve the historical result: Gemini's official first run kept 8/13 (61.5%), passed Core coverage and FAILED overall. Claude was a secondary comparison, reported at approximately 54% strict to 66% generous, also below the bar. Do not rewrite those results.

### Source issues to settle before scoring

- The Expert Gold Standard's stretcher row cites fire-extinguisher nodes; the Website Plan identifies the actual stretcher nodes N288 and N291. Several other gold-standard node lists also mix unrelated evidence. Validate links against the raw file and report discrepancies separately; never silently edit the frozen answer key.
- The Expert Gold Standard has an unfinished suction-machine row, while the Website Plan explicitly marks that family Core. Use the final Website Plan's Core roster for the coverage checklist.
- Some older FAQ notes and supporting-node lists still include compatibility checks despite the final recorded removal rule. The final rule should govern the revised implementation; record the stale references before scoring.
- Retrieval Decisions and Seed Backlog contain old Open/Not searched states even though the final status says collection is frozen. Treat them as the history of retrieval, not an instruction to reopen the evidence collection.
- The folder records aggregate model scores but does not include the full original Gemini/Claude responses or row-by-row scoring. Historical scores can be reported as recorded, not independently reproduced from these files.

## Parked (not now):

## Mobile composition follow-up — initial landing first
Initial mobile landing accepted and saved at 54a6805. Supporting copy remains verbatim in the approved explainers. State-driven canvas implementation is now deployed for phone review: context bottom third, review half, processing compact strip, final plan bottom two-thirds. Approved resting loop remains unchanged. Automated and browser checks pass; physical phone keyboard/safe-area review and user acceptance remain pending. Exceptionally short 320x568 landing fit remains unresolved without changing approved content hierarchy.
