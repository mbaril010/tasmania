#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BINARIES_DIR="${ROOT_DIR}/binaries"
BINARY_PATH="${BINARIES_DIR}/llama-server"
MANIFEST_PATH="${ROOT_DIR}/scripts/binary-manifest.json"
VERIFY_ONLY="${1:-}"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "[download-llama] ERROR: Missing manifest: $MANIFEST_PATH"
  exit 1
fi

ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" && "$ARCH" != "x86_64" ]]; then
  echo "[download-llama] ERROR: Unsupported architecture: $ARCH"
  exit 1
fi

EXPECTED_SHA="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.llama?.[process.argv[2]]?.binarySha256||'');" "$MANIFEST_PATH" "$ARCH")"
PINNED_TAG="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.llama?.releaseTag||'');" "$MANIFEST_PATH")"

if [[ -z "$EXPECTED_SHA" ]]; then
  echo "[download-llama] ERROR: No pinned checksum for architecture: $ARCH"
  echo "[download-llama] Update scripts/binary-manifest.json before downloading."
  exit 1
fi

verify_checksum() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "[download-llama] ERROR: SHA256 mismatch for $(basename "$file")"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    return 1
  fi
  return 0
}

if [[ "$VERIFY_ONLY" == "--verify-only" ]]; then
  if [[ ! -f "$BINARY_PATH" ]]; then
    echo "[download-llama] ERROR: Binary not found at $BINARY_PATH"
    exit 1
  fi
  verify_checksum "$BINARY_PATH" "$EXPECTED_SHA"
  echo "[download-llama] OK: checksum verified for existing llama-server"
  exit 0
fi

if [[ -f "$BINARY_PATH" ]]; then
  if verify_checksum "$BINARY_PATH" "$EXPECTED_SHA"; then
    echo "[download-llama] llama-server already exists and checksum is valid, skipping."
    exit 0
  fi
  echo "[download-llama] ERROR: Existing llama-server failed checksum verification."
  exit 1
fi

if [[ -n "$PINNED_TAG" ]]; then
  echo "[download-llama] Fetching pinned llama.cpp release info for tag $PINNED_TAG..."
  RELEASE_JSON="$(curl -fsS "https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/${PINNED_TAG}")"
  TAG="$PINNED_TAG"
else
  echo "[download-llama] Fetching latest llama.cpp release info..."
  RELEASE_JSON="$(curl -fsS https://api.github.com/repos/ggml-org/llama.cpp/releases/latest)"
  TAG="$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*: "//;s/".*//')"
fi

if [[ -z "$TAG" ]]; then
  echo "[download-llama] ERROR: Could not determine release tag."
  exit 1
fi

if [[ "$ARCH" == "arm64" ]]; then
  ASSET_NAME="llama-${TAG}-bin-macos-arm64.tar.gz"
else
  ASSET_NAME="llama-${TAG}-bin-macos-x64.tar.gz"
fi

DOWNLOAD_URL="https://github.com/ggml-org/llama.cpp/releases/download/${TAG}/${ASSET_NAME}"

echo "[download-llama] Downloading $ASSET_NAME ($TAG)..."
mkdir -p "$BINARIES_DIR"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
curl -fL --progress-bar -o "$TMPDIR/$ASSET_NAME" "$DOWNLOAD_URL"

echo "[download-llama] Extracting llama-server and libraries..."
tar -xzf "$TMPDIR/$ASSET_NAME" -C "$TMPDIR"

EXTRACT_DIR="$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -type d | head -1)"
if [[ -z "$EXTRACT_DIR" ]]; then
  EXTRACT_DIR="$TMPDIR"
fi

FOUND="$(find "$EXTRACT_DIR" -name "llama-server" -type f | head -1)"
if [[ -z "$FOUND" ]]; then
  echo "[download-llama] ERROR: llama-server not found in archive."
  exit 1
fi

cp "$FOUND" "$BINARY_PATH"
chmod +x "$BINARY_PATH"
verify_checksum "$BINARY_PATH" "$EXPECTED_SHA"

LIB_COUNT=0
for lib in "$EXTRACT_DIR"/*.dylib; do
  [[ -f "$lib" ]] || continue
  cp "$lib" "$BINARIES_DIR/"
  LIB_COUNT=$((LIB_COUNT + 1))
done
echo "[download-llama] Copied $LIB_COUNT shared libraries."

# Remove quarantine after checksum verification succeeds.
xattr -cr "$BINARIES_DIR" 2>/dev/null || true

echo "[download-llama] Done! llama-server ($TAG) installed at $BINARIES_DIR"
ls -lh "$BINARIES_DIR"
"$BINARY_PATH" --version 2>/dev/null || true
