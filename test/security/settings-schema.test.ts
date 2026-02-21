import assert from 'node:assert/strict';
import test from 'node:test';
import { validateSettingsPartial } from '../../src/main/security/settings-schema.ts';

test('rejects invalid exo hostnames', () => {
  assert.throws(
    () => validateSettingsPartial({ exo: { host: 'bad host', port: 52415, autoConnect: false } }),
    /host/i,
  );
});

test('normalizes absolute paths in settings updates', () => {
  const validated = validateSettingsPartial({
    modelsDir: './models',
    imageOutput: { autoSave: true, outputDir: './output' },
  });
  assert.ok(validated.modelsDir?.startsWith('/'));
  assert.ok(validated.imageOutput?.outputDir.startsWith('/'));
});
