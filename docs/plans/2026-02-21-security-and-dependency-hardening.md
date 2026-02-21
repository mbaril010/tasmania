# Security And Dependency Hardening Implementation Plan

**Goal:** Eliminate high-risk security flaws, harden runtime boundaries, and establish reliable dependency hygiene for Tasmania.

**Architecture:** Apply defense-in-depth at trust boundaries (IPC, control API, URL fetchers, file paths), lock binary supply-chain inputs, and add regression tests around security-critical utilities. Keep changes localized to main-process services and scripts to avoid renderer churn.

**Tech Stack:** Electron, TypeScript, Node.js, shell scripts, npm lockfiles

---

### Task 1: Add Security Test Harness

**Files:**
- Create: `test/security/path-guards.test.ts`
- Create: `test/security/web-fetch-guards.test.ts`
- Create: `test/security/process-manager.test.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

**Step 1: Write failing tests for current vulnerable behavior**

```ts
it('rejects sibling-prefix paths', () => {
  expect(isPathInside('/a/models-evil/x', '/a/models')).toBe(false);
});
```

**Step 2: Run test command to confirm failures**

Run: `npm run test:security`
Expected: FAIL on prefix-bypass assertions.

**Step 3: Add minimal test command + config**

```json
{
  "scripts": {
    "test:security": "vitest run test/security"
  }
}
```

**Step 4: Re-run tests**

Run: `npm run test:security`
Expected: FAIL remains (baseline captured).

**Step 5: Commit**

```bash
git add package.json tsconfig.json test/security
git commit -m "test: add security harness and failing guard tests"
```

### Task 2: Fix Path Boundary Validation

**Files:**
- Create: `src/main/security/path-utils.ts`
- Modify: `src/main/ipc/backend-handlers.ts`
- Modify: `src/main/ipc/image-handlers.ts`
- Modify: `src/main/ipc/system-handlers.ts`
- Modify: `src/main/services/ModelService.ts`
- Modify: `src/main/mcp/control-api.ts`
- Test: `test/security/path-guards.test.ts`

**Step 1: Write failing test for each vulnerable callsite contract**

```ts
expect(assertInside('/tmp/models2/x', '/tmp/models')).toThrow();
```

**Step 2: Run targeted tests**

Run: `npm run test:security -- path-guards`
Expected: FAIL for sibling-prefix bypass.

**Step 3: Implement normalized boundary check utility**

```ts
const rel = path.relative(root, candidate);
if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('outside root');
```

**Step 4: Replace all `startsWith(path.resolve(...))` checks with shared utility**

Run: `rg -n "startsWith\\(path\\.resolve\\(|resolved\\.startsWith\\(" src/main`
Expected: zero vulnerable path checks in guarded flows.

**Step 5: Commit**

```bash
git add src/main/security/path-utils.ts src/main/ipc/backend-handlers.ts src/main/ipc/image-handlers.ts src/main/ipc/system-handlers.ts src/main/services/ModelService.ts src/main/mcp/control-api.ts test/security/path-guards.test.ts
git commit -m "fix(security): harden path boundary checks"
```

### Task 3: Accepted Risk (No Change) - Terminal Auto-Launch Mode

**Decision:**
- Keep `claude --dangerously-skip-permissions` as intentional product behavior.
- Do not include this item in mandatory remediation scope.

**Guardrail:**
- Add release note text in `docs/security/release-checklist.md` stating this is an explicit trust decision and must not be enabled silently in other surfaces.

### Task 4: Harden Web Fetch (SSRF + Memory Limits)

**Files:**
- Create: `src/main/security/url-utils.ts`
- Modify: `src/main/ipc/web-handlers.ts`
- Modify: `src/main/mcp/server.ts`
- Test: `test/security/web-fetch-guards.test.ts`

**Step 1: Write failing tests for blocked targets**

```ts
expect(validateFetchUrl('http://127.0.0.1:3999')).toThrow();
expect(validateFetchUrl('http://169.254.169.254')).toThrow();
```

**Step 2: Run tests to confirm current behavior is unsafe**

Run: `npm run test:security -- web-fetch-guards`
Expected: FAIL on localhost/private CIDR cases.

**Step 3: Add URL validator and streaming byte cap**

```ts
const MAX_BYTES = 1_000_000;
for await (const chunk of stream) { ... if (total > MAX_BYTES) throw ... }
```

**Step 4: Enforce protocol + host policy in both IPC and MCP paths**

Run: `npm run test:security -- web-fetch-guards`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/security/url-utils.ts src/main/ipc/web-handlers.ts src/main/mcp/server.ts test/security/web-fetch-guards.test.ts
git commit -m "fix(security): restrict web fetch targets and cap response size"
```

### Task 5: Lock Download Supply Chain

**Files:**
- Modify: `scripts/download-llama.sh`
- Modify: `scripts/download-sd.sh`
- Modify: `package.json`
- Create: `scripts/binary-manifest.json`

**Step 1: Write failing validation check**

```bash
bash scripts/download-llama.sh --verify-only
# expected failure when checksum/version not pinned
```

**Step 2: Implement pinned versions + SHA256 verification**

```bash
EXPECTED_SHA256="..."
echo "$EXPECTED_SHA256  $FILE" | shasum -a 256 -c -
```

**Step 3: Replace “latest release” resolution with manifest lookup**

Run: `bash scripts/download-llama.sh --verify-only`
Expected: PASS on known artifact hash.

**Step 4: Keep quarantine removal optional and post-verify only**

Run: `bash scripts/download-sd.sh --verify-only`
Expected: PASS.

**Step 5: Commit**

```bash
git add scripts/download-llama.sh scripts/download-sd.sh scripts/binary-manifest.json package.json
git commit -m "fix(supply-chain): pin and verify bundled binary artifacts"
```

### Task 6: Fix HuggingFace Resume Integrity

**Files:**
- Modify: `src/main/services/HuggingFaceService.ts`
- Test: `test/security/download-resume.test.ts`

**Step 1: Write failing test for `Range` ignored by server**

```ts
// if startByte > 0 and response.status === 200, file should restart from zero
```

**Step 2: Run test to validate current corruption path**

Run: `npm run test:security -- download-resume`
Expected: FAIL.

**Step 3: Implement safe resume logic**

```ts
if (startByte > 0 && response.status === 200) { truncatePartial(); startByte = 0; }
```

**Step 4: Add optional hash verification hook for known files**

Run: `npm run test:security -- download-resume`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/services/HuggingFaceService.ts test/security/download-resume.test.ts
git commit -m "fix(download): prevent corrupted resumes when range is unsupported"
```

### Task 7: Fix ProcessManager Logging + Listener Leaks

**Files:**
- Modify: `src/main/services/ProcessManager.ts`
- Modify: `src/main/services/LlamaCppBackend.ts`
- Modify: `src/main/services/StableDiffusionBackend.ts`
- Modify: `src/main/services/ComfyUIBackend.ts`
- Test: `test/security/process-manager.test.ts`

**Step 1: Write failing tests**

```ts
expect(error.message).toContain('recent log line');
expect(exitListenerCountAfterRestart).toBe(1);
```

**Step 2: Run tests**

Run: `npm run test:security -- process-manager`
Expected: FAIL.

**Step 3: Preserve logs until caller consumes them and use `.once('exit', ...)`**

```ts
proc.once('close', ...); // capture logs before cleanup
```

**Step 4: Re-run tests and lint**

Run: `npm run test:security -- process-manager && npm run lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/services/ProcessManager.ts src/main/services/LlamaCppBackend.ts src/main/services/StableDiffusionBackend.ts src/main/services/ComfyUIBackend.ts test/security/process-manager.test.ts
git commit -m "fix(runtime): prevent listener leaks and preserve startup logs"
```

### Task 8: Validate Settings Schema At IPC Boundary

**Files:**
- Create: `src/main/security/settings-schema.ts`
- Modify: `src/main/ipc/system-handlers.ts`
- Modify: `src/main/store/AppStore.ts`

**Step 1: Write failing tests for invalid settings payloads**

```ts
expect(() => validateSettings({ comfyui: { pythonPath: '' } })).toThrow();
```

**Step 2: Run tests**

Run: `npm run test:security -- settings`
Expected: FAIL.

**Step 3: Enforce schema validation for `modelsDir`, `outputDir`, ports, host, `pythonPath`**

```ts
if (!path.isAbsolute(modelsDir)) throw new Error('modelsDir must be absolute');
```

**Step 4: Re-run test suite**

Run: `npm run test:security`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/main/security/settings-schema.ts src/main/ipc/system-handlers.ts src/main/store/AppStore.ts
git commit -m "fix(security): validate settings payloads before persistence"
```

### Task 9: Tighten macOS Entitlements

**Files:**
- Modify: `entitlements/entitlements.mac.plist`
- Modify: `entitlements/entitlements.mac.inherit.plist`
- Modify: `scripts/verify-package.sh`

**Step 1: Add failing entitlement check to packaging verification**

```bash
plutil -extract com.apple.security.cs.disable-library-validation raw entitlements/entitlements.mac.plist
```

**Step 2: Remove `allow-unsigned-executable-memory` and `disable-library-validation` unless proven required**

Run: `npm run verify`
Expected: PASS, app still launches.

**Step 3: Re-test binary loading**

Run: `npm run package && npm run verify`
Expected: PASS without entitlement regressions.

**Step 4: Commit**

```bash
git add entitlements/entitlements.mac.plist entitlements/entitlements.mac.inherit.plist scripts/verify-package.sh
git commit -m "chore(security): reduce macOS entitlement attack surface"
```

### Task 10: Dependency Hygiene Pipeline

**Files:**
- Modify: `package.json`
- Modify: `landing/package.json`
- Create: `.github/workflows/security-audit.yml`
- Create: `docs/security/dependency-policy.md`

**Step 1: Add CI checks**

```yaml
- run: npm ci
- run: npm audit --audit-level=moderate
```

**Step 2: Add weekly update cadence and policy**

```md
Pin runtime-sensitive dependencies; review pre-release packages explicitly.
```

**Step 3: Add lockfile drift check in CI**

Run: `npm ci && npm run lint`
Expected: PASS.

**Step 4: Commit**

```bash
git add package.json landing/package.json .github/workflows/security-audit.yml docs/security/dependency-policy.md
git commit -m "chore(deps): add automated audit and dependency policy"
```

### Task 11: Final Verification And Release Gate

**Files:**
- Modify: `scripts/verify-package.sh`
- Create: `docs/security/release-checklist.md`

**Step 1: Expand verify script with security checks**

```bash
npm run lint
npm run test:security
bash scripts/verify-package.sh
```

**Step 2: Run end-to-end validation**

Run: `npm run lint && npm run test:security && npm run package && npm run verify`
Expected: PASS.

**Step 3: Commit**

```bash
git add scripts/verify-package.sh docs/security/release-checklist.md
git commit -m "chore(release): enforce security gate before shipping"
```
