#!/bin/bash
set -e

BINARIES_DIR="$(cd "$(dirname "$0")/.." && pwd)/binaries"
BINARY_PATH="$BINARIES_DIR/sd-server"

# Skip if binary already exists
if [ -f "$BINARY_PATH" ]; then
  echo "[download-sd] sd-server already exists at $BINARY_PATH, skipping."
  exit 0
fi

echo "[download-sd] Fetching latest stable-diffusion.cpp release info..."
RELEASE_JSON=$(curl -s https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest)
TAG=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*: "//;s/".*//')

if [ -z "$TAG" ]; then
  echo "[download-sd] ERROR: Could not determine latest release tag."
  exit 1
fi

# Determine platform — look for macOS ARM asset
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86_64" ]; then
  echo "[download-sd] ERROR: Unsupported architecture: $ARCH"
  exit 1
fi

# Asset naming is irregular — grep for matching asset URL from release JSON
if [ "$ARCH" = "arm64" ]; then
  ASSET_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -i 'darwin.*arm64' | head -1 | sed 's/.*: "//;s/".*//')
else
  ASSET_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep -i 'darwin.*x64\|darwin.*x86_64' | head -1 | sed 's/.*: "//;s/".*//')
fi

if [ -z "$ASSET_URL" ]; then
  echo "[download-sd] ERROR: Could not find macOS $ARCH asset in release $TAG."
  echo "[download-sd] Available assets:"
  echo "$RELEASE_JSON" | grep '"browser_download_url"' | sed 's/.*: "//;s/".*//'
  exit 1
fi

ASSET_NAME=$(basename "$ASSET_URL")
echo "[download-sd] Downloading $ASSET_NAME ($TAG)..."
mkdir -p "$BINARIES_DIR"

TMPDIR=$(mktemp -d)
curl -L --progress-bar -o "$TMPDIR/$ASSET_NAME" "$ASSET_URL"

echo "[download-sd] Extracting sd-server and libraries..."

# Handle both .zip and .tar.gz archives
case "$ASSET_NAME" in
  *.tar.gz) tar -xzf "$TMPDIR/$ASSET_NAME" -C "$TMPDIR" ;;
  *.zip)    unzip -q "$TMPDIR/$ASSET_NAME" -d "$TMPDIR" ;;
  *)        echo "[download-sd] ERROR: Unknown archive format: $ASSET_NAME"; rm -rf "$TMPDIR"; exit 1 ;;
esac

# Find the extraction directory
EXTRACT_DIR=$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -type d | head -1)
if [ -z "$EXTRACT_DIR" ]; then
  EXTRACT_DIR="$TMPDIR"
fi

# Copy sd-server binary (might be named sd or sd-server)
FOUND=$(find "$EXTRACT_DIR" -name "sd-server" -type f | head -1)
if [ -z "$FOUND" ]; then
  # Fallback: look for 'sd' binary
  FOUND=$(find "$EXTRACT_DIR" -name "sd" -type f | head -1)
fi
if [ -z "$FOUND" ]; then
  echo "[download-sd] ERROR: sd-server binary not found in archive."
  echo "[download-sd] Archive contents:"
  find "$EXTRACT_DIR" -type f
  rm -rf "$TMPDIR"
  exit 1
fi
cp "$FOUND" "$BINARY_PATH"
chmod +x "$BINARY_PATH"

# Copy all shared libraries (.dylib) — required for sd-server to run
LIB_COUNT=0
while IFS= read -r lib; do
  [ -f "$lib" ] || continue
  cp "$lib" "$BINARIES_DIR/"
  LIB_COUNT=$((LIB_COUNT + 1))
done < <(find "$EXTRACT_DIR" -name "*.dylib" -type f)

# Also check top-level TMPDIR for dylibs
for lib in "$TMPDIR"/*.dylib; do
  [ -f "$lib" ] || continue
  cp "$lib" "$BINARIES_DIR/"
  LIB_COUNT=$((LIB_COUNT + 1))
done
echo "[download-sd] Copied $LIB_COUNT shared libraries."

# Remove quarantine attribute on all binaries (macOS blocks downloaded binaries)
xattr -cr "$BINARIES_DIR" 2>/dev/null || true

rm -rf "$TMPDIR"

echo "[download-sd] Done! sd-server ($TAG) installed at $BINARIES_DIR"
ls -lh "$BINARIES_DIR/sd-server" "$BINARIES_DIR"/*.dylib 2>/dev/null || true
