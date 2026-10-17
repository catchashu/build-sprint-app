export type PrivacyConsent = { analytics: boolean; recording: boolean };
export const CONSENT_KEY = 'topic-gibbon:privacy-consent:v1';
const off = (): PrivacyConsent => ({ analytics: false, recording: false });
type ConsentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

// Only this dedicated preference record is read; never read saved research.
export function createConsentStore(storage: () => ConsentStorage | undefined) {
  let blocked = false;
  const listeners = new Set<() => void>();
  function hasChoice(): boolean {
    if (blocked) return false;
    try {
      const saved = JSON.parse(storage()?.getItem(CONSENT_KEY) ?? 'null');
      return saved?.version === 1 && saved.choiceMade === true && typeof saved.analytics === 'boolean' && typeof saved.recording === 'boolean';
    } catch { return false; }
  }
  function get(): PrivacyConsent {
    if (blocked) return off();
    try {
      const saved = JSON.parse(storage()?.getItem(CONSENT_KEY) ?? 'null');
      if (saved?.version !== 1 || typeof saved.analytics !== 'boolean' || typeof saved.recording !== 'boolean') return off();
      return { analytics: saved.analytics, recording: saved.recording };
    } catch { return off(); }
  }
  function refresh() { for (const listener of listeners) { try { listener(); } catch { /* Isolate subscribers. */ } } }
  function set(value: PrivacyConsent): boolean {
    try {
      const target = storage();
      if (!target) throw Error('Storage unavailable');
      target.setItem(CONSENT_KEY, JSON.stringify({ version: 1, choiceMade: true, analytics: value.analytics === true, recording: value.recording === true }));
      blocked = false;
      refresh();
      return true;
    } catch {
      blocked = true;
      try { storage()?.removeItem(CONSENT_KEY); } catch { /* Remain off in this tab. */ }
      refresh();
      return false;
    }
  }
  return { get, set, hasChoice, refresh, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}

export const privacyConsent = createConsentStore(() => typeof window === 'undefined' ? undefined : window.localStorage);
export const getPrivacyConsent = privacyConsent.get;
export const savePrivacyConsent = privacyConsent.set;
export function withdrawPrivacyConsent(preference: keyof PrivacyConsent): boolean {
  return privacyConsent.set({ ...privacyConsent.get(), [preference]: false });
}
