export type TrayGeometry = { stage: number; panel: number };
const active = new WeakMap<HTMLElement, Animation>();

export function trayGeometry(app: HTMLElement): TrayGeometry {
  return {
    stage: app.querySelector<HTMLElement>('.stage')!.getBoundingClientRect().height,
    panel: app.querySelector<HTMLElement>('.panel')!.getBoundingClientRect().height,
  };
}

/** Animate the existing grid tracks, never scale text or replace the video. */
export function transitionTray(app: HTMLElement, from: TrayGeometry, to: TrayGeometry) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || app.dataset.keyboard === 'true') return;
  app.dataset.trayMoving = 'true';
  const animation = app.animate([
    { gridTemplateRows: `${from.stage}px ${from.panel}px` },
    { gridTemplateRows: `${to.stage}px ${to.panel}px` },
  ], { duration: 350, easing: 'cubic-bezier(.16,1,.3,1)' });
  active.set(app, animation);
  const clear = () => {
    if (active.get(app) !== animation) return;
    delete app.dataset.trayMoving; active.delete(app);
  };
  animation.addEventListener('finish', clear, { once: true });
  animation.addEventListener('cancel', clear, { once: true });
  return animation;
}
