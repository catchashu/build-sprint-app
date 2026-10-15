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
