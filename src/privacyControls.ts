import { privacyConsent, type PrivacyConsent } from './privacyConsent';
type Store = typeof privacyConsent;
const storageError = 'Your browser could not save this choice. Optional collection stays off. You may be asked again next time.';

function element<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, text = '', className = '') {
  const node = doc.createElement(tag); node.textContent = text; node.className = className; return node;
}
function button(doc: Document, text: string, action: () => void, className = 'secondary') {
  const node = element(doc, 'button', text, className); node.type = 'button'; node.onclick = action; return node;
}

export function openPrivacyDialog(doc: Document, trigger: HTMLElement, store: Store = privacyConsent, onClose?: () => void) {
  const dialog = element(doc, 'dialog', '', 'privacy-dialog');
  dialog.setAttribute('aria-labelledby', 'privacy-title');
  const title = element(doc, 'h2', 'Privacy choices'); title.id = 'privacy-title'; title.tabIndex = -1;
  const form = element(doc, 'form');
  const introduction = element(doc, 'p', 'Both choices are optional. You can use Gibbon without either and change your mind here later.', 'small');
  const selected = store.get();
  function preference(key: keyof PrivacyConsent, label: string, description: string) {
    const wrapper = element(doc, 'label', '', 'privacy-preference');
    const input = element(doc, 'input'); input.type = 'checkbox'; input.checked = selected[key]; input.name = key;
    const text = element(doc, 'span'); text.append(element(doc, 'strong', label));
    const help = element(doc, 'span', description, 'small'); help.id = `privacy-${key}-help`; input.setAttribute('aria-describedby', help.id);
    text.append(help); wrapper.append(input, text); form.append(wrapper); return input;
  }
  const analytics = preference('analytics', 'Anonymous product analytics & sanitized error reporting', 'Help us understand which features work and where errors occur, without sending your research text or access codes.');
  const recording = preference('recording', 'Session recording', 'Allow a replay of clicks and scrolling to help us spot usability problems. Your inputs and research content are hidden.');
  const status = element(doc, 'p', '', 'error small'); status.setAttribute('role', 'alert');
  function save(value: PrivacyConsent) {
    if (store.set(value)) dialog.close();
    else { analytics.checked = false; recording.checked = false; status.textContent = storageError; }
  }
  const actions = element(doc, 'div', '', 'privacy-actions');
  const submit = button(doc, 'Save preferences', () => {}, 'primary'); submit.type = 'submit';
  actions.append(submit, button(doc, 'Decline optional collection', () => save({analytics: false, recording: false})), button(doc, 'Cancel', () => dialog.close()));
  form.append(status, actions); form.onsubmit = event => {event.preventDefault(); save({analytics: analytics.checked, recording: recording.checked});};
  dialog.append(title, introduction, form);
  const unsubscribe = store.subscribe(() => {const current = store.get(); analytics.checked = current.analytics; recording.checked = current.recording;});
  dialog.addEventListener('close', () => {
    unsubscribe(); dialog.remove();
    const fallback = doc.querySelector<HTMLElement>('.landing h1');
    (trigger.isConnected && !trigger.closest('[hidden]') ? trigger : fallback)?.focus({preventScroll: true});
    onClose?.();
  }, {once: true});
  doc.body.append(dialog); dialog.showModal(); title.focus();
  return dialog;
}

const dismissedNotices = new WeakSet<Store>();
export function mountPrivacyNotice(panel: HTMLElement, store: Store = privacyConsent) {
  if (store.hasChoice() || dismissedNotices.has(store)) return () => {};
  const doc = panel.ownerDocument, view = doc.defaultView;
  const notice = element(doc, 'dialog', '', 'privacy-notice'); notice.setAttribute('aria-label', 'Optional analytics');
  notice.setAttribute('aria-describedby', 'privacy-notice-copy');
  const copy = element(doc, 'p', 'Optional analytics help us improve Gibbon. Session recordings require separate consent.', 'small'); copy.id = 'privacy-notice-copy';
  let disposed = false, custom: HTMLDialogElement | undefined;
  function dismiss() {
    dismissedNotices.add(store);
    notice.close(); notice.remove();
    doc.querySelector<HTMLElement>('.landing h1')?.focus({preventScroll: true});
  }
  function decline() { store.set({analytics: false, recording: false}); dismiss(); }
  const close = button(doc, '×', decline, 'privacy-notice-close'); close.setAttribute('aria-label', 'Close');
  notice.append(close, copy);
  const error = element(doc, 'p', '', 'error small'); error.setAttribute('role', 'alert');
  const actions = element(doc, 'div', '', 'privacy-actions');
  const customize = button(doc, 'Customize', () => {
    notice.close();
    custom = openPrivacyDialog(doc, customize, store, () => {
      custom = undefined;
      if (!disposed && !store.hasChoice() && !dismissedNotices.has(store)) { notice.showModal(); position(); close.focus({preventScroll: true}); }
    });
  });
  actions.append(button(doc, 'Accept', () => { if (!store.set({analytics: true, recording: false})) error.textContent = storageError; }), button(doc, 'Decline', decline), customize);
  notice.append(actions, error); doc.body.append(notice);
  // Position within the visible tray, without changing any page geometry.
  function position() {
    if (!notice.open) return;
    const viewport = view?.visualViewport;
    const top = viewport?.offsetTop ?? 0, height = viewport?.height ?? view?.innerHeight ?? 600;
    const tray = panel.getBoundingClientRect(), half = notice.getBoundingClientRect().height / 2;
    const center = (Math.max(top, tray.top) + Math.min(top + height, tray.bottom)) / 2;
    notice.style.setProperty('--privacy-center', `${Math.max(top + half + 16, Math.min(center, top + height - half - 16))}px`);
  }
  const unsubscribe = store.subscribe(() => {if (store.hasChoice()) dismiss();});
  notice.addEventListener('cancel', event => {event.preventDefault(); decline();});
  view?.addEventListener('resize', position); view?.visualViewport?.addEventListener('resize', position);
  notice.showModal(); position(); close.focus({preventScroll: true});
  void doc.fonts?.ready.then(() => {if (!disposed) position();});
  return () => {disposed = true; unsubscribe(); view?.removeEventListener('resize', position); view?.visualViewport?.removeEventListener('resize', position); custom?.close(); notice.close(); notice.remove();};
}
