export function readSavedState<T>(tab: Storage, device: Storage, key: string, blank: () => T): T {
  for (const [storage, name] of [[tab, key], [device, `${key}:plan`]] as const) {
    try { const value = storage.getItem(name); if (value) { const parsed = JSON.parse(value); if (parsed && typeof parsed === 'object' && typeof parsed.screen === 'string') return parsed as T; } } catch { /* Fall through to the saved plan or a fresh run. */ }
  }
  return blank();
}
export function saveState<T extends {screen: string}>(tab: Storage, device: Storage, key: string, state: T) {
  tab.setItem(key, JSON.stringify(state));
  if (state.screen === 'plan') device.setItem(`${key}:plan`, JSON.stringify(state));
}
