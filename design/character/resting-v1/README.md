# Approved V1 resting loop

User approval: "The resting animation looks good. Let's lock this as the approved V1 resting loop."

## Locked deliverable

`../../../public/animations/resting-v1.mp4` is the exact approved video, copied without re-encoding from `artifacts/character-motion/seated-continuous-loop.mp4`. It is silent, 768 x 1344, 24 fps, 344 frames (about 14.33 seconds).

Do not stretch, reverse, retime, regenerate or otherwise modify it to imitate other character movements. It may temporarily stand in for unavailable state-specific animations. Keep the static fallback and respect reduced-motion preferences when integrating.

## Preserved sources

- `source-original-8s.mp4`: original approved natural seated sample, vidIQ/Veo 3.1 Fast, job `job_5ea08071-07bc-4912-bbd1-bc6758ebb342`, 240 credits.
- `source-continuous-15s.mp4`: approved continuous forward-time performance, vidIQ/Minimax H3, job `job_bcae9368-26a5-4710-b3ee-740de29e4122`, 240 credits. Original audio retained in this source only.
- `../../../public/images/gibbon-placeholder.jpg`: original image reference, already tracked.
- `blend-boundary-original.py`: exact final editing script; historical input/output paths refer to the ignored artifacts folder. It removes audio in the preceding preparation and overlaps 18 ending/starting frames to smooth the restart. The final deliverable is authoritative; rebuilding is unnecessary.
- `../../seated-motion-sample.md`: generation prompts, decisions, rejected reverse-playback edits and review history.
- `SHA256.json`: checksums for the deliverable and source videos.

No additional animations are approved for creation. Next work is mobile layout, with initial landing review before state transitions.
