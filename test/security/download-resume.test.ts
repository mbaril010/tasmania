import test from 'node:test';
import assert from 'node:assert/strict';
import { decideResumeBehavior } from '../../src/main/security/download-utils.ts';

test('restarts from zero when server ignores Range and returns 200', () => {
  const result = decideResumeBehavior(1024, 200);
  assert.equal(result.startByte, 0);
  assert.equal(result.writeFlag, 'w');
  assert.equal(result.restartedFromZero, true);
});

test('keeps append behavior when server honors Range with 206', () => {
  const result = decideResumeBehavior(1024, 206);
  assert.equal(result.startByte, 1024);
  assert.equal(result.writeFlag, 'a');
  assert.equal(result.restartedFromZero, false);
});

test('starts new file when no partial bytes exist', () => {
  const result = decideResumeBehavior(0, 200);
  assert.equal(result.startByte, 0);
  assert.equal(result.writeFlag, 'w');
  assert.equal(result.restartedFromZero, false);
});
