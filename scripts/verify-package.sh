#!/usr/bin/env bash
# verify-package.sh — Pre-release verification for Tasmania.app
# Ensures the packaged Electron app has all required resources
# and can launch without crashing on missing native modules.

set -euo pipefail

APP_NAME="Tasmania"
ARCH="arm64"
PACKAGE_DIR="out/${APP_NAME}-darwin-${ARCH}"
APP_BUNDLE="${PACKAGE_DIR}/${APP_NAME}.app"
RESOURCES="${APP_BUNDLE}/Contents/Resources"
PASS=0
FAIL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

pass() { ((PASS++)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { ((FAIL++)); echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "${BOLD}$1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠${NC} $1"; }

# ─── Build if needed ────────────────────────────────────────────────
if [[ "${1:-}" == "--build" ]]; then
  info "Building package..."
  npx electron-forge package
  echo ""
fi

# ─── Check app bundle exists ────────────────────────────────────────
info "Verifying ${APP_NAME}.app bundle..."

if [[ ! -d "$APP_BUNDLE" ]]; then
  echo -e "${RED}ERROR: ${APP_BUNDLE} not found.${NC}"
  echo "Run 'npm run package' first, or use: bash scripts/verify-package.sh --build"
  exit 1
fi
pass "App bundle exists at ${APP_BUNDLE}"

# ─── Check main executable ──────────────────────────────────────────
MAIN_EXEC="${APP_BUNDLE}/Contents/MacOS/${APP_NAME}"
if [[ -x "$MAIN_EXEC" ]]; then
  pass "Main executable exists and is executable"
else
  fail "Main executable missing or not executable: ${MAIN_EXEC}"
fi

# ─── Check asar ─────────────────────────────────────────────────────
if [[ -f "${RESOURCES}/app.asar" ]]; then
  pass "app.asar exists"
else
  fail "app.asar missing — build may be broken"
fi

# ─── Check native module: node-pty ──────────────────────────────────
info ""
info "Checking native modules..."

PTY_DIR="${RESOURCES}/node-pty-darwin-arm64"
if [[ -d "$PTY_DIR" ]]; then
  pass "node-pty-darwin-arm64 directory present in Resources"
else
  fail "node-pty-darwin-arm64 MISSING from Resources — terminal will crash!"
fi

PTY_INDEX="${PTY_DIR}/lib/index.js"
if [[ -f "$PTY_INDEX" ]]; then
  pass "node-pty-darwin-arm64/lib/index.js exists"
else
  fail "node-pty-darwin-arm64/lib/index.js missing — require() will fail"
fi

# @lydell/node-pty uses prebuilds/ layout, not build/Release/
PTY_NODE=$(find "$PTY_DIR" -name "pty.node" 2>/dev/null | head -1)
if [[ -n "$PTY_NODE" ]]; then
  pass "node-pty native binary found: ${PTY_NODE#${RESOURCES}/}"
else
  fail "node-pty native binary (pty.node) missing — PTY will not work"
fi

# ─── Check binaries: llama-server ────────────────────────────────────
info ""
info "Checking bundled binaries..."

BINARIES_DIR="${RESOURCES}/binaries"
if [[ -d "$BINARIES_DIR" ]]; then
  pass "binaries/ directory present in Resources"
else
  fail "binaries/ directory MISSING from Resources — llama-server unavailable"
fi

LLAMA_SERVER="${BINARIES_DIR}/llama-server"
if [[ -x "$LLAMA_SERVER" ]]; then
  pass "llama-server exists and is executable"
else
  fail "llama-server missing or not executable"
fi

# Check key dylibs
REQUIRED_DYLIBS=("libllama.dylib" "libggml-base.dylib" "libggml-metal.dylib" "libggml-cpu.dylib")
for dylib in "${REQUIRED_DYLIBS[@]}"; do
  if [[ -f "${BINARIES_DIR}/${dylib}" ]]; then
    pass "${dylib} present"
  else
    fail "${dylib} MISSING"
  fi
done

# ─── Smoke test: launch app and check for crash ─────────────────────
info ""
info "Smoke test: launching app for 5 seconds..."

CRASH_LOG=$(mktemp)
# Launch the app in the background, capture stderr
"$MAIN_EXEC" 2>"$CRASH_LOG" &
APP_PID=$!

# Wait up to 5 seconds
sleep 5

# Check if it's still running
if kill -0 "$APP_PID" 2>/dev/null; then
  pass "App launched and stayed alive for 5 seconds"
  # Gracefully kill
  kill "$APP_PID" 2>/dev/null || true
  # Give it a moment to exit
  sleep 1
  kill -9 "$APP_PID" 2>/dev/null || true
else
  fail "App crashed within 5 seconds!"
  if [[ -s "$CRASH_LOG" ]]; then
    echo -e "  ${RED}Crash output:${NC}"
    head -20 "$CRASH_LOG" | sed 's/^/    /'
  fi
fi

# Check crash log for known errors even if app survived
if grep -qi "Cannot find module" "$CRASH_LOG" 2>/dev/null; then
  fail "Crash log contains 'Cannot find module' error"
  grep -i "Cannot find module" "$CRASH_LOG" | head -5 | sed 's/^/    /'
fi

if grep -qi "MODULE_NOT_FOUND" "$CRASH_LOG" 2>/dev/null; then
  fail "Crash log contains MODULE_NOT_FOUND error"
  grep -i "MODULE_NOT_FOUND" "$CRASH_LOG" | head -5 | sed 's/^/    /'
fi

rm -f "$CRASH_LOG"

# ─── Summary ─────────────────────────────────────────────────────────
info ""
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}Passed: ${PASS}${NC}  ${RED}Failed: ${FAIL}${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "  ${RED}${BOLD}VERIFICATION FAILED${NC} — Do NOT release this build!"
  info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
else
  echo -e "  ${GREEN}${BOLD}ALL CHECKS PASSED${NC} — Safe to release."
  info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
fi
