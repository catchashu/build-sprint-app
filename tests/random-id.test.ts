import test from 'node:test';
import assert from 'node:assert/strict';
import { randomId } from '../src/randomId';

test('local HTTP preview creates secure UUIDs when randomUUID is unavailable', () => {
  let calls = 0;
  const source = { getRandomValues: (bytes: Uint8Array<ArrayBuffer>) => { calls++; bytes.fill(255); return bytes; } };
  assert.equal(randomId(source), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  assert.equal(calls, 1);
});

test('HTTPS keeps using the browser UUID implementation', () => {
  const id = '12345678-1234-4234-8234-123456789abc';
  assert.equal(randomId({randomUUID: () => id, getRandomValues: () => { throw Error('Unexpected fallback'); }}), id);
});

