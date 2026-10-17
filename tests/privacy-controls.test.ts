import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createConsentStore, CONSENT_KEY} from '../src/privacyConsent';
import {mountPrivacyNotice, openPrivacyDialog} from '../src/privacyControls';

function setup() {
  const window = new Window({url: 'http://localhost'}), doc = window.document as unknown as Document;
  doc.body.innerHTML = '<main id="app" class="landing"><section class="panel"><h1 tabindex="-1">Gibbon</h1><button id="privacy">Privacy</button></section></main>';
  const store = createConsentStore(() => window.localStorage);
  const panel = doc.querySelector('.panel')!;
  const stop = mountPrivacyNotice(panel as unknown as HTMLElement, store);
  const button = (label: string) => {const b = [...doc.querySelectorAll('button')].find(n => n.textContent === label); assert.ok(b, label); return b;};
  const open = () => openPrivacyDialog(doc as unknown as Document, button('Privacy') as unknown as HTMLElement, store);
  return {window, doc, store, button, open, panel, notice: () => doc.querySelector<HTMLDialogElement>('.privacy-notice'), close: () => {stop(); window.happyDOM.abort();}};
}

test('first-visit dialog opens; Accept enables analytics only and is remembered', () => {
  const s = setup(); try {
    assert.equal(s.notice()?.open, true);
    assert.deepEqual(s.store.get(), {analytics: false, recording: false});
    s.button('Accept').click();
    assert.deepEqual(s.store.get(), {analytics: true, recording: false}); assert.equal(s.notice(), null);
    assert.equal(createConsentStore(() => s.window.localStorage).hasChoice(), true);
    assert.equal(JSON.parse(s.window.localStorage.getItem(CONSENT_KEY)!).choiceMade, true);
  } finally {s.close();}
});

test('declining dismisses the notice and reopening supports independent recording choice and withdrawal', () => {
  const s = setup(); try {
    s.button('Decline').click(); assert.equal(s.notice(), null);
    s.open();
    const recording = s.doc.querySelector<HTMLInputElement>('input[name="recording"]')!;
    assert.equal(recording.checked, false); recording.checked = true;
    s.button('Save preferences').click();
    assert.deepEqual(s.store.get(), {analytics: false, recording: true});
    s.open(); assert.equal(s.doc.querySelector<HTMLInputElement>('input[name="recording"]')!.checked, true);
    const decline = [...s.doc.querySelectorAll('dialog button')].find(n => n.textContent === 'Decline optional collection')!;
    (decline as unknown as HTMLButtonElement).click();
    assert.deepEqual(s.store.get(), {analytics: false, recording: false}); assert.equal(s.notice(), null);
  } finally {s.close();}
});

test('Customize and Cancel do not save draft choices or dismiss the notice', () => {
  const s = setup(); try {
    s.button('Customize').click();
    s.doc.querySelector<HTMLInputElement>('input[name="analytics"]')!.checked = true;
    s.button('Cancel').click();
    assert.equal(s.store.hasChoice(), false); assert.equal(s.notice()?.open, true);
    assert.deepEqual(s.store.get(), {analytics: false, recording: false});
  } finally {s.close();}
});

test('storage failure shows a useful message and keeps both choices off', () => {
  const s = setup(); try {
    s.button('Decline').click();
    const broken = createConsentStore(() => {throw Error('Blocked');});
    openPrivacyDialog(s.doc as unknown as Document, s.button('Privacy') as unknown as HTMLElement, broken);
    s.doc.querySelector<HTMLInputElement>('input[name="analytics"]')!.checked = true;
    s.button('Save preferences').click();
    assert.match(s.doc.querySelector('dialog [role="alert"]')!.textContent ?? '', /could not save/);
    assert.equal(s.doc.querySelector<HTMLInputElement>('input[name="analytics"]')!.checked, false);
    assert.deepEqual(broken.get(), {analytics: false, recording: false});
  } finally {s.close();}
});

test('Close and Escape save OFF and do not prompt again after remounting', () => {
  for (const action of ['close', 'escape']) {
    const s = setup(); try {
      if (action === 'close') s.doc.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click();
      else s.notice()!.dispatchEvent(new s.window.Event('cancel', {cancelable: true}) as unknown as Event);
      assert.deepEqual(s.store.get(), {analytics: false, recording: false});
      assert.equal(s.store.hasChoice(), true); assert.equal(s.notice(), null);
      const restored = createConsentStore(() => s.window.localStorage);
      const stop = mountPrivacyNotice(s.panel as HTMLElement, restored);
      assert.equal(s.notice(), null); stop();
    } finally {s.close();}
  }
});
