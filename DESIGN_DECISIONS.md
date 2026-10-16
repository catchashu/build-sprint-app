# Design decisions

Record approved decisions and their reasons here. DESIGN.md remains the design specification; PROGRESS.md tracks implementation and review status. Experiments are not final decisions. Save approved implementation and documentation together in GitHub after checkpoint approval.

## 2026-10-15 — Landing visual direction approved

- Preserve 65% light tint with 12px blur: the user preferred the more visible forest treatment after mobile and desktop review.
- Preserve full-width bottom-anchored mobile tray and the existing centered 780px bottom-anchored desktop layout: approved overall composition.
- Preserve the supplied transparent Topic Gibbon logo inside the tray, approved typography, copy and resting animation.
- State-specific character animations remain planned for Phase 2; the resting loop is the Phase 1 placeholder.

## 2026-10-15 - Phase 1 Step 0 checkpoint approved and complete

User approved the finished Landing Page UX on mobile and desktop, including all explainer refinements.

- Consistent outlined X + Close control, minimum 44px height, in each explainer header: recognizable and easy to tap without competing with the content.
- Filled selected audience tab with unfilled inactive state: makes the default and subsequent selection clear. Accessible tab state and keyboard switching preserve usability.
- Remove visible pause/play controls throughout the UI: removes utility clutter while preserving the approved resting asset, normal playback, reduced-motion preference and hidden-tab pausing.
- Retain the previously approved 65% tint / 12px blur, transparent logo, mobile full-width bottom tray, centered 780px desktop bottom tray, Inter typography and exact approved copy.
- Keep the known 320x568 content-fit compromise explicit: approximately 61px page scrolling with a saved plan, rather than hiding controls or shrinking text.
- Preserve the earlier approved baseline tags. This checkpoint supersedes prior Landing glass, brand and explainer-control instructions only; later states need their own reviews.

Implementation and specifications are saved together at this checkpoint. Phase 1 Step 1 is review-only next; state-specific character animation implementation remains deferred to Phase 2.

## 2026-10-15 - Phase 1 Step 1 approved and complete

User approved Landing to Website Context after physical Android testing; desktop layout and transition checks also passed.

- Prioritize the offering field and CTA while the keyboard is open; temporarily hide non-form landing content. Reason: prevent the keyboard from obscuring the primary action without changing the approved closed-keyboard appearance.
- Restore the original layout and entered text on dismissal; keep controls stable until the keyboard actually closes, even after input blur. Allow temporary scrolling only when the visible height is unusually short.
- Resize the same bottom-anchored tray directly over 350ms, including Back. Reason: make changing task layouts feel continuous without forcing identical tray heights or scaling text.
- Keep the forest and original resting video continuous, without restarting playback or inserting a collapsed Arrival pause. Reduced motion skips the transition; keyboard resizing takes priority.
- Extend the approved transparent logo, 65% tint / 12px blur, Inter and spacing to Website Context. Use full-width mobile and centered maximum-780px desktop trays, sized for the content.
- Preserve the Website Context copy, optional field, Back/Continue behaviour, offering and saved URL. Phase 2 character-animation plans remain unchanged.

Step 2 is review-only next; its existing design is not approved by this checkpoint.

## 2026-10-15 - Phase 1 Step 2 approved and complete

User approved Competitor / Inspiration Context after physically testing both URL fields with the Android keyboard, navigation and visual treatment.

- Let the bottom-anchored tray grow upward to fit both fields and navigation, reducing the Gibbon area first: avoid hidden controls and unnecessary internal scrolling while keeping text readable.
- Carry forward the transparent logo, 65% tint / 12px blur, matching typography/inputs/buttons, full-width mobile and centered maximum-780px desktop layout: preserve one coherent interface.
- During reference entry, prioritize both fields and navigation; temporarily hide introductory content and the Gibbon strip. Automatically reveal the focused field through keyboard resizing and browser panning. Restore layout and URLs on dismissal: physical Android testing exposed a gap in the earlier simulation.
- Smoothly resize the same tray between context states while preserving the resting video and honoring reduced motion. Both references remain optional, including proceeding with both blank.
- Test each field without manually scrolling it into view; retain regression coverage for viewport offsets and keyboard-height changes.

Stop development after this checkpoint. Step 3 (Finding Your Customers / Initial Research), research questions and cluster-card UX are pending review. The existing approved cluster direction remains one topic cluster at a time with Tinder-style tick/cross controls. No Step 3 or cluster redesign implemented tonight. Character performances remain Phase 2 work.

## 2026-10-15 - End-of-day release decision

All approved work through Phase 1 Step 2 is saved in GitHub. Continue local review for remaining Phase 1 steps; defer production deployment until Phase 1 is complete and the full user journey has been tested. Reason: save approved checkpoints without publishing design experiments or partially reviewed flows. Step 3 review is next; keep the resting animation through Phase 1 and defer state-specific animations to Phase 2.


## 2026-10-16 - Batch 1 / Phase 1 Steps 3-4 approved

User confirmed physical Android approval of the cluster deck, stable canvas, readable text, evidence popup and Close control, Accept/Reject, correction and decision summary.

- One cluster at a time; Accept means relevant, Reject means outside the offering, Fix this handles meaning/grouping. Previous/Next and summary review allow changed decisions. Save before advancing.
- Keep the review frame stable across content lengths and corrections; reserve save-status space. Reason: prevent canvas and Gibbon framing jumps. Preserve the original resting animation.
- Preserve readable type. Show 2-3 search examples when space allows; very small viewports prioritize decisions and navigation. Explicit full-detail access retains complete labels, needs, searches and sources. The evidence popup scrolls deliberately; the main card does not.
- Final authorized refinement: replace the prominent red partial-search warning with a small neutral note in evidence only. Reason: avoid alarming users when the saved results remain usable, while accurately disclosing unavailable suggestions. Blocking errors and technical records remain intact.
- Apply the approved transparent logo, 65% tint / 12px blur, bottom tray and typography to Steps 3-4. Steps 0-2 and later batches remain unchanged.

Validation: 116 tests and build passed. Browser regression covers 320x480, 320x568, 375x667, 390x844 and 1280x900; short/long clusters, stable frame, Accept/Reject/revisit, corrections, full evidence preservation, keyboard simulation, summary and unlock handoff. Warning refinement checks partial failures, clean results and actionable unusable-research errors. Browser fixtures simulate provider responses; physical Android approval covers the preceding complete Batch 1 UX, not a new full research rerun. No production deployment.


## 2026-10-16 - USER PASS: Batch 2

User approved Invite Unlock, Full Research, Clarifications and Demand Map after physical Android review, including final footer and V1 no-volumes wording.

- Invite-only presentation reduces distraction while preserving future payment activation. Dynamic viewport height removes the gap below Unlock.
- Expanded latest-three activity makes real work visible; reserved space prevents jumping. Manual collapse and a separate complete history preserve user control and readable detail.
- Refresh wording reflects saved server workflows; failed runs still require Try again. Backend retries are unchanged.
- Focused clarifications and the reused cluster deck keep decisions consistent, with existing corrections and evidence retained.
- Remove unsupported volume/provider/band claims from V1 Demand Map presentation. Enrichment implementation remains available for Phase 3.
- Exclude video intrinsic size from automatic summary grid sizing: reproduced the oversized Gibbon regression, fixed it and obtained physical Android confirmation.
- Preserve transparent logo, 65% tint/12px blur, Inter and the existing resting animation throughout.

Validation: 116 tests/build passed; browser fixtures cover 320/375/390px and desktop, keyboard changes, invite validation, recent/history activity, clarifications, map confirmation and summary/Unlock/back transitions. Simulated provider responses are not a new live-provider verification. Batch 3 remains pending plan approval. No deployment.


## 2026-10-16 - USER PASS: Batch 3 in full

Physical Android review approved generation, final plan, collapsible hierarchy, Excel and Exit. User subsequently accepted all final verification results and explicitly waived further visual review.

- Single plan reading area plus persistent Download Excel preserves readable results and reachable completion controls without nested scrolling or overlays.
- Preserve hierarchy/evidence/corrections; retain expanded details, drafts and reading position through updates. Keyboard layouts reveal the complete correction form rather than overlapping its input.
- Show subtle three-dot animation only during actual generation/checking; stationary with reduced motion. This reassures users without invented progress or delays.
- Remove routine Back navigation from generation/results to reduce clutter, but retain Review demand map when confirmation or recovery is necessary.
- Group identical provenance under optional View source details; show real queries and concise source descriptions first. Preserve source links/timestamps and complete Excel evidence.
- Keep V1 volume explanations honest; preserve workbook schema and enrichment code/data for future use.
- Preserve Exit/Cancel/new-run confirmations and saved-plan reopening. Use only the existing resting Gibbon performance.

Validation: 116 automated tests and build passed. Browser checks at 320x568, 375x667, 390x844 and 1280x900 covered long/short plans, errors/retry, clarification, keyboard corrections, expansion/draft retention, reduced motion, evidence grouping/links, actual Excel downloads, refresh, Exit/Cancel, reopening and Start New Run. Downloaded XLSX files were reopened programmatically: five original worksheets, columns and expected research rows preserved. Browser fixtures used sample saved plans, not fresh live research. Batch 4 now verifies one real Android run. No deployment.
