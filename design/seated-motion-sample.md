# Seated motion sample — review brief

Status: user approved one paid sample. Submitted through vidIQ using Veo 3.1 Fast, 8 seconds, 720p portrait, 240 credits. Job: job_5ea08071-07bc-4912-bbd1-bc6758ebb342. No app changes.

## Source and purpose

Use `public/images/gibbon-placeholder.jpg` as the exact starting frame for this sample only. It is the current app image, not an approved reusable character model. Preserve its face, fur, proportions, seated contact points and forest composition. Do not independently generate different characters or frames.

Authority: Motion Bible section 5A, Quiet Sit / Look Around / Chill. The Character Bible v0.4 remains reference-stage; final artwork/model approval is a separate step.

## Eight-second shot

- 0–2 seconds: hold the current seated pose, with barely perceptible breathing.
- 2–4 seconds: one slow, small head turn toward the viewer; shoulders, hands, feet and pelvis stay planted.
- 4–6 seconds: quiet gaze hold and one natural blink; relaxed mouth, no smile.
- 6–8 seconds: gently return toward the initial gaze and settle.

Locked camera; no zoom, cuts, added props, text, music or intended vocalisation. No whole-image rocking. This is a motion study, not a guaranteed seamless loop or a rigged production asset.

## Generation prompt

Animate this exact starting image as an eight-second quiet seated gibbon motion study. Preserve the same individual, adult anatomy, golden buff fur, pale facial border, dark facial skin, long arms, fingers and grasping feet. Keep the log, forest background, lighting and camera fixed. The pelvis, hands and feet stay at their original contact points throughout. For the first two seconds hold with only faint respiratory movement. Between two and four seconds turn the head slowly a small distance toward the viewer without turning the shoulders or torso. Hold the gaze for two seconds with one brief natural blink. During the final two seconds gently return toward the starting gaze and settle. Keep the mouth relaxed with no smile or speech. No fidgeting, sliding feet, morphing limbs, body bounce, camera motion, zoom, cuts, added objects, captions, music or vocalisation. Prioritize stable identity and grounded contact over large movements.

## Review criteria

Check face and limb consistency, stationary contact points, restrained breathing, slow head movement separated by still holds, clean blink and a fixed camera. Reject visible morphing or drift. Do not regenerate a paid shot without permission.

## Production boundary

Do not wire this sample into the Golden Flow. Later production work requires a consistent animatable asset, interruptible states, reduced-motion handling and a static fallback that cannot block research or planning.


## First sample result

Completed successfully: 8 seconds, 720x1280, 24 fps. Original saved at artifacts/character-motion/seated-sample.mp4. Silent review copy: artifacts/character-motion/seated-sample-silent.mp4 (audio removed without re-encoding video). Cost: 240 credits; no additional generation.

One-second sampled frames show a broadly stable seated base and recognizable character, but the head scans more frequently and farther than requested. The last pose differs from the first, so this is not a seamless idle loop. Blink timing and smoothness are not established by those sampled stills. Await user review of the actual clip before any further paid generation or app integration.

## User review and loop edit

User approved the first clip: "this is really good and feels natural". User then approved making a loop. Created a local forward-and-reverse edit with eased timing at the turnarounds; no new video generation or credit charge. This retraces the existing movement rather than synthesizing a new action. Output: artifacts/character-motion/seated-loop.mp4, 384 frames, approximately 16 seconds, silent, 720x1280. Looping review player: artifacts/character-motion/seated-loop-preview.html. Sampled boundary frames inspected; small decoded pixel differences at the loop boundary are consistent with compression. Perceptual pacing still awaits user review. Live app remains unchanged.

User reported a visible interruption during the return. V2 removes nonlinear retiming, retains the original 24 fps pace, removes duplicated reversal endpoints and rebuilds uniform timestamps. Verified 382 frames with no timestamp gaps. Still uses a reversed return, so perceptual turnaround quality requires user review; no claim of a newly performed natural return. No credits used. File: artifacts/character-motion/seated-loop-v2.mp4.

User found a corrective head turn around 9 seconds and reversed mouth movement around 14 seconds in V2. V3 retains only original source frames 102–155 (4.25–6.5 seconds) and retraces this single closed-mouth turn; 106 frames total, 4.42 seconds, constant 24 fps. Sampled face frames inspected throughout; excluded source portions contain the reported gestures. Shorter repetition cadence requires user review. Separate V3 preview preserves earlier versions. No credits or live-app changes.

## Revised direction after V3 review

User rejects the reversed return, even in the shortened loop, and wants the longer performance with only the unnatural movements corrected. V1–V3 reverse-playback edits are not accepted. Do not continue trimming or reversing them.

Proposed next shot: one continuous 15-second video edit using the approved original eight-second clip as the appearance and performance reference. Preserve its natural pace, stable seated body, forest, camera and character. Generate a genuinely new return action; do not reverse footage. Keep the mouth softly closed throughout. One deliberate turn toward the viewer, a sustained quiet hold, one deliberate turn to the side, a sustained hold, then one smooth return to the initial gaze. No partial turn followed by a corrective turn, repeated swivels, twitch, jaw flap, camera movement or body drift. End with a quiet hold in the starting pose. This is a target for generation, not a guarantee of an exact seamless loop.

This requires a new paid vidIQ generation. Await explicit approval for one paid 15-second version before submission; do not treat the unused credit balance as blanket spending approval. Do not replace the accepted original or modify the live app.

User approved one new paid 15-second version. Submitted via vidIQ Minimax H3 video edit, original eight-second clip as reference, 768p portrait, 240 credits. Job job_bcae9368-26a5-4710-b3ee-740de29e4122. Requested closed mouth throughout, one slow turn toward viewer, sustained hold, one continuous return to starting gaze, then hold. No reverse playback. Pending generation and review.

15-second generation completed: job_bcae9368-26a5-4710-b3ee-740de29e4122. Saved original as artifacts/character-motion/seated-continuous-15s.mp4 and silent copy as seated-continuous-15s-silent.mp4. 768x1344, 24 fps, container duration 15.08 seconds. Preview: seated-continuous-preview.html. One-second sampled frames inspected: generated forward-time return to screen-right gaze is present, with no editor-applied reversal. Generator retained additional early gaze changes rather than following the exact single-turn choreography. Starting and ending poses are similar but not identical; do not claim verified seamless looping or fully corrected motion based on stills. Await user playback review. 240 credits used for this attempt, 480 total across two successful generations. No new paid retries or live app changes.

User approved the continuous generation except for its restart jump. Added a 0.75-second circular dissolve between resting end/start poses; unchanged forward-time interior motion, no reverse playback. Output seated-continuous-loop.mp4 and seated-continuous-loop-preview.html, 344 frames / 14.33 seconds. Low-resolution decoded mean pixel change at restart decreased from 25.41 to 2.23. Blend sampled visually; user playback review remains the acceptance check. No credits used; original preserved.

LOCKED: User approved the final circular-blend version as the V1 resting loop. Exact deliverable and original generation sources are now preserved in tracked public/animations/ and design/character/resting-v1/. No further animation work before the mobile UX correction. Do not stretch, reverse or alter the approved clip to simulate other movements.
