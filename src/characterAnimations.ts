export type CharacterState = 'landing' | 'arrival' | 'context' | 'processing' | 'review' | 'result';
export type CharacterAnimation = { src: string; poster: string; label: string; loop: boolean };

export const restingV1: CharacterAnimation = {
  src: '/animations/resting-v1.mp4', poster: '/images/gibbon-placeholder.jpg',
  label: 'Gibbon resting quietly in the forest', loop: true,
};

// Replace a state assignment only when its new performance is approved.
// Sharing an asset preserves playback position when the canvas changes state.
export const characterAnimations: Record<CharacterState, CharacterAnimation> = {
  landing: restingV1, arrival: restingV1, context: restingV1,
  processing: restingV1, review: restingV1, result: restingV1,
};
