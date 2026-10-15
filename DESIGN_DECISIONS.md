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
