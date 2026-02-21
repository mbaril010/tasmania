import assert from 'node:assert/strict';
import test from 'node:test';
import { ProcessManager } from '../../src/main/services/ProcessManager.ts';

test('start failure includes recent logs from early-exit process', async () => {
  const manager = new ProcessManager();
  await assert.rejects(
    () =>
      manager.start(
        process.execPath,
        ['-e', 'console.error("boom-log"); process.exit(1);'],
        { readyPattern: /this-will-never-match/, timeoutMs: 1_500 },
      ),
    /boom-log/,
  );
});

test('logs remain available after stop for diagnostics', async () => {
  const manager = new ProcessManager();
  await manager.start(
    process.execPath,
    ['-e', 'console.log("ready-now"); setInterval(() => {}, 1000);'],
    { readyPattern: /ready-now/, timeoutMs: 2_000 },
  );
  await manager.stop();

  const logs = manager.getLogs().join('\n');
  assert.match(logs, /ready-now/);
});
