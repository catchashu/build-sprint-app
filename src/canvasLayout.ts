export type CanvasMode = 'landing' | 'arrival' | 'context' | 'processing' | 'review' | 'result';

export function canvasMode(screen: string, phase?: string, hasQuestion = false): CanvasMode {
  if (screen === 'landing') return 'landing';
  if (screen === 'arrival') return 'arrival';
  if (screen === 'website' || screen === 'references') return 'context';
  if (screen === 'unlock') return 'review';
  if (phase === 'failed' || phase === 'review_required') return 'review';
  if (hasQuestion || phase === 'clarification') return 'context';
  if (phase === 'complete') return screen === 'plan' ? 'result' : 'review';
  return 'processing';
}

export function setCanvasMode(root: HTMLElement, mode: CanvasMode) {
  const app = root.closest<HTMLElement>('#app');
  if (app) app.dataset.canvasMode = mode;
}

export function keyboardOpen(editing: boolean, mobile: boolean, baseline: number, available: number, scale = 1) {
  return editing && mobile && scale <= 1.05 && baseline - available > Math.max(120, baseline * .2);
}

export function watchCanvasViewport(app: HTMLElement) {
  const viewport = window.visualViewport;
  let baseline = window.innerHeight, width = window.innerWidth, frame = 0, wasOpen = false;
  function update() {
    const editing = document.activeElement?.matches('input,textarea,[contenteditable="true"]') ?? false;
    if (Math.abs(window.innerWidth - width) > 80) { baseline = window.innerHeight; width = window.innerWidth; }
    if (!editing) baseline = Math.max(baseline, window.innerHeight);
    const available = viewport?.height ?? window.innerHeight;
    // Tapping a button blurs the input before Android has finished hiding its keyboard.
    const open = keyboardOpen(editing || wasOpen, window.innerWidth <= 600, baseline, available, viewport?.scale);
    app.dataset.keyboard = String(open);
    if (open) {
      app.style.setProperty('--keyboard-height', `${available}px`);
      app.style.setProperty('--keyboard-top', `${viewport?.offsetTop ?? 0}px`);
    } else {
      app.style.removeProperty('--keyboard-height'); app.style.removeProperty('--keyboard-top');
      if (wasOpen) { const panel = app.querySelector<HTMLElement>('.panel'); if (panel) panel.scrollTop = 0; }
    }
    wasOpen = open;
  }
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
  viewport?.addEventListener('resize', schedule); viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule); document.addEventListener('focusin', schedule); document.addEventListener('focusout', schedule);
  update();
  return () => { cancelAnimationFrame(frame); viewport?.removeEventListener('resize', schedule); viewport?.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); document.removeEventListener('focusin', schedule); document.removeEventListener('focusout', schedule); };
}
