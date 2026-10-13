import { characterAnimations, type CharacterAnimation, type CharacterState } from './characterAnimations';

export function createRestingStage(animations: Record<CharacterState, CharacterAnimation> = characterAnimations) {
  let selected = animations.landing;
  const stage = document.createElement('div'); stage.className = 'stage';
  const fallback = document.createElement('img'); fallback.src = selected.poster; fallback.alt = selected.label;
  const video = document.createElement('video'); video.src = selected.src; video.poster = fallback.src;
  video.muted = true; video.loop = selected.loop; video.playsInline = true; video.preload = 'metadata';
  video.setAttribute('aria-label', selected.label);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'); let paused = reduced.matches, failed = false;
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'motion-control';
  function sync() {
    toggle.textContent = paused ? 'Play animation' : 'Pause animation';
    if (paused || document.hidden || failed) video.pause();
    else void video.play().catch(() => { paused = true; toggle.textContent = 'Play animation'; });
  }
  toggle.onclick = () => { paused = !paused; sync(); };
  const preference = () => { paused = reduced.matches; sync(); };
  video.addEventListener('error', () => { failed = true; video.hidden = true; fallback.hidden = false; toggle.hidden = true; });
  fallback.hidden = true;
  document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', preference);
  stage.append(fallback, video, toggle); sync();
  function select(state: CharacterState) {
    const next = animations[state];
    if (next === selected) return;
    const changedSource = next.src !== selected.src;
    selected = next;
    fallback.src = next.poster; fallback.alt = next.label; video.poster = next.poster;
    video.loop = next.loop; video.setAttribute('aria-label', next.label);
    if (changedSource) {
      failed = false; fallback.hidden = true; video.hidden = false; toggle.hidden = false;
      video.src = next.src; sync();
    }
  }
  return { stage, select, stop: () => { video.pause(); document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', preference); } };
}
