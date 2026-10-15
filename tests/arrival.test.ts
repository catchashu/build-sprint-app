import test from 'node:test';
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';
import { arriveReady } from '../src/arrival';
import { createRestingStage } from '../src/restingStage';
import { characterAnimations } from '../src/characterAnimations';
import { canvasMode } from '../src/canvasLayout';

test('resting arrival completes without waiting for playback, and stale arrivals cancel', async () => {
  const results: string[] = [];
  const cancel = arriveReady('Original offering', () => results.push('stale'), () => results.push('missing'));
  cancel();
  arriveReady('Original offering', () => results.push('website'), () => results.push('missing'));
  assert.deepEqual(results, []);
  await Promise.resolve();
  assert.deepEqual(results, ['website']);
  assert.equal(canvasMode('arrival'), 'arrival');
});

test('missing arrival context recovers instead of opening an empty website step', async () => {
  let missing = false;
  arriveReady('  ', () => assert.fail('must recover'), () => { missing = true; });
  await Promise.resolve();
  assert.equal(missing, true);
});

test('state selection preserves the resting player and reduced motion never blocks arrival', async () => {
  const w = new Window();
  const previous = { document: globalThis.document, matchMedia: globalThis.matchMedia };
  const media = new w.EventTarget(); Object.assign(media, { matches: true });
  Object.assign(globalThis, { document: w.document, matchMedia: () => media });
  try {
    const player = createRestingStage();
    const video = player.stage.querySelector('video')!;
    video.currentTime = 4;
    player.select('arrival'); player.select('context'); player.select('landing');
    assert.equal(player.stage.querySelector('video'), video);
    assert.equal(video.currentTime, 4);
    assert.equal(video.getAttribute('src'), characterAnimations.landing.src);
    assert.equal(video.paused, true);
    assert.equal(player.stage.querySelector('button'), null);
    let ready = false;
    arriveReady('Saved offering', () => { ready = true; }, () => assert.fail());
    await Promise.resolve(); assert.equal(ready, true);
    video.dispatchEvent(new w.Event('error') as unknown as Event);
    assert.equal(video.hidden, true);
    assert.equal(player.stage.querySelector('img')!.hidden, false);
    player.stop();
  } finally { Object.assign(globalThis, previous); }
});
