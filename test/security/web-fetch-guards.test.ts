import assert from 'node:assert/strict';
import test from 'node:test';
import { assertSafeHttpUrl } from '../../src/main/security/url-utils.ts';

test('rejects non-http schemes', async () => {
  await assert.rejects(() => assertSafeHttpUrl('file:///etc/passwd'), /http/);
});

test('rejects localhost and private addresses', async () => {
  await assert.rejects(() => assertSafeHttpUrl('http://localhost:3999'), /blocked/i);
  await assert.rejects(() => assertSafeHttpUrl('http://127.0.0.1:8080'), /blocked/i);
  await assert.rejects(() => assertSafeHttpUrl('http://192.168.1.2'), /blocked/i);
});

test('allows public literal IP targets', async () => {
  const parsed = await assertSafeHttpUrl('https://8.8.8.8');
  assert.equal(parsed.hostname, '8.8.8.8');
  assert.equal(parsed.protocol, 'https:');
});
