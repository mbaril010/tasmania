#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BINARIES_DIR="${ROOT_DIR}/binaries"
BINARY_PATH="${BINARIES_DIR}/sd-server"
MANIFEST_PATH="${ROOT_DIR}/scripts/binary-manifest.json"
VERIFY_ONLY="${1:-}"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "[download-sd] ERROR: Missing manifest: $MANIFEST_PATH"
  exit 1
fi

ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" && "$ARCH" != "x86_64" ]]; then
  echo "[download-sd] ERROR: Unsupported architecture: $ARCH"
  exit 1
fi

EXPECTED_SHA="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.stableDiffusion?.[process.argv[2]]?.binarySha256||'');" "$MANIFEST_PATH" "$ARCH")"
PINNED_TAG="$(node -e "const fs=require('fs');const m=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(m.stableDiffusion?.releaseTag||'');" "$MANIFEST_PATH")"

if [[ -z "$EXPECTED_SHA" ]]; then
  echo "[download-sd] ERROR: No pinned checksum for architecture: $ARCH"
  echo "[download-sd] Update scripts/binary-manifest.json before downloading."
  exit 1
fi

verify_checksum() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  if [[ "$actual" != "$expected" ]]; then
    echo "[download-sd] ERROR: SHA256 mismatch for $(basename "$file")"
    echo "  expected: $expected"
    echo "  actual:   $actual"
    return 1
  fi
  return 0
}

if [[ "$VERIFY_ONLY" == "--verify-only" ]]; then
  if [[ ! -f "$BINARY_PATH" ]]; then
    echo "[download-sd] ERROR: Binary not found at $BINARY_PATH"
    exit 1
  fi
  verify_checksum "$BINARY_PATH" "$EXPECTED_SHA"
  echo "[download-sd] OK: checksum verified for existing sd-server"
  exit 0
fi

if [[ -f "$BINARY_PATH" ]]; then
  if verify_checksum "$BINARY_PATH" "$EXPECTED_SHA"; then
    echo "[download-sd] sd-server already exists and checksum is valid, skipping."
    exit 0
  fi
  echo "[download-sd] ERROR: Existing sd-server failed checksum verification."
  exit 1
fi

if [[ -n "$PINNED_TAG" ]]; then
  echo "[download-sd] Fetching pinned stable-diffusion.cpp release info for tag $PINNED_TAG..."
  RELEASE_JSON="$(curl -fsS "https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/tags/${PINNED_TAG}")"
  TAG="$PINNED_TAG"
else
  echo "[download-sd] Fetching latest stable-diffusion.cpp release info..."
  RELEASE_JSON="$(curl -fsS https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest)"
  TAG="$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*: "//;s/".*//')"
fi

if [[ -z "$TAG" ]]; then
  echo "[download-sd] ERROR: Could not determine release tag."
  exit 1
fi

if [[ "$ARCH" == "arm64" ]]; then
  ASSET_URL="$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -i 'darwin.*arm64' | head -1 | sed 's/.*: "//;s/".*//')"
else
  ASSET_URL="$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -i 'darwin.*x64\|darwin.*x86_64' | head -1 | sed 's/.*: "//;s/".*//')"
fi

if [[ -z "$ASSET_URL" ]]; then
  echo "[download-sd] ERROR: Could not find macOS $ARCH asset in release $TAG."
  echo "[download-sd] Available assets:"
  echo "$RELEASE_JSON" | grep '"browser_download_url"' | sed 's/.*: "//;s/".*//'
  exit 1
fi

ASSET_NAME="$(basename "$ASSET_URL")"
echo "[download-sd] Downloading $ASSET_NAME ($TAG)..."
mkdir -p "$BINARIES_DIR"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT
curl -fL --progress-bar -o "$TMPDIR/$ASSET_NAME" "$ASSET_URL"

echo "[download-sd] Extracting sd-server and libraries..."
case "$ASSET_NAME" in
  *.tar.gz) tar -xzf "$TMPDIR/$ASSET_NAME" -C "$TMPDIR" ;;
  *.zip)    unzip -q "$TMPDIR/$ASSET_NAME" -d "$TMPDIR" ;;
  *)        echo "[download-sd] ERROR: Unknown archive format: $ASSET_NAME"; exit 1 ;;
esac

EXTRACT_DIR="$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -type d | head -1)"
if [[ -z "$EXTRACT_DIR" ]]; then
  EXTRACT_DIR="$TMPDIR"
fi

FOUND="$(find "$EXTRACT_DIR" -name "sd-server" -type f | head -1)"
if [[ -z "$FOUND" ]]; then
  FOUND="$(find "$EXTRACT_DIR" -name "sd" -type f | head -1)"
fi
if [[ -z "$FOUND" ]]; then
  echo "[download-sd] ERROR: sd-server binary not found in archive."
  echo "[download-sd] Archive contents:"
  find "$EXTRACT_DIR" -type f
  exit 1
fi

cp "$FOUND" "$BINARY_PATH"
chmod +x "$BINARY_PATH"
verify_checksum "$BINARY_PATH" "$EXPECTED_SHA"

LIB_COUNT=0
while IFS= read -r lib; do
  [[ -f "$lib" ]] || continue
  cp "$lib" "$BINARIES_DIR/"
  LIB_COUNT=$((LIB_COUNT + 1))
done < <(find "$EXTRACT_DIR" -name "*.dylib" -type f)

for lib in "$TMPDIR"/*.dylib; do
  [[ -f "$lib" ]] || continue
  cp "$lib" "$BINARIES_DIR/"
  LIB_COUNT=$((LIB_COUNT + 1))
done
echo "[download-sd] Copied $LIB_COUNT shared libraries."

# Remove quarantine after checksum verification succeeds.
xattr -cr "$BINARIES_DIR" 2>/dev/null || true

echo "[download-sd] Done! sd-server ($TAG) installed at $BINARIES_DIR"
ls -lh "$BINARIES_DIR/sd-server" "$BINARIES_DIR"/*.dylib 2>/dev/null || true
