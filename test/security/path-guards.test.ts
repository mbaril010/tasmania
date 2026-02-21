import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPathInside, isPathInside } from '../../src/main/security/path-utils.ts';

test('isPathInside allows children and blocks sibling-prefix escapes', () => {
  assert.equal(isPathInside('/tmp/models', '/tmp/models/llama.gguf'), true);
  assert.equal(isPathInside('/tmp/models', '/tmp/models-evil/llama.gguf'), false);
  assert.equal(isPathInside('/tmp/models', '/tmp/models/../models-evil/llama.gguf'), false);
});

test('assertPathInside throws for paths outside root', () => {
  assert.throws(
    () => assertPathInside('/tmp/models', '/tmp/models-evil/llama.gguf'),
    /outside|within/i,
  );
});
