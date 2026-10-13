export function createRestingStage() {
  const stage = document.createElement('div'); stage.className = 'stage';
  const fallback = document.createElement('img'); fallback.src = '/images/gibbon-placeholder.jpg'; fallback.alt = 'Gibbon resting quietly in the forest';
  const video = document.createElement('video'); video.src = '/animations/resting-v1.mp4'; video.poster = fallback.src;
  video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'metadata';
  video.setAttribute('aria-label', 'Gibbon resting quietly in the forest');
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
  return { stage, stop: () => { video.pause(); document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', preference); } };
}
