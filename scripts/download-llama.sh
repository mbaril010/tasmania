#!/bin/bash
set -e

BINARIES_DIR="$(cd "$(dirname "$0")/.." && pwd)/binaries"
BINARY_PATH="$BINARIES_DIR/llama-server"

# Skip if binary already exists
if [ -f "$BINARY_PATH" ]; then
  echo "[download-llama] llama-server already exists at $BINARY_PATH, skipping."
  exit 0
fi

echo "[download-llama] Fetching latest llama.cpp release info..."
RELEASE_JSON=$(curl -s https://api.github.com/repos/ggml-org/llama.cpp/releases/latest)
TAG=$(echo "$RELEASE_JSON" | grep '"tag_name"' | head -1 | sed 's/.*: "//;s/".*//')

if [ -z "$TAG" ]; then
  echo "[download-llama] ERROR: Could not determine latest release tag."
  exit 1
fi

# Determine platform
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  ASSET_NAME="llama-${TAG}-bin-macos-arm64.tar.gz"
elif [ "$ARCH" = "x86_64" ]; then
  ASSET_NAME="llama-${TAG}-bin-macos-x64.tar.gz"
else
  echo "[download-llama] ERROR: Unsupported architecture: $ARCH"
  exit 1
fi

DOWNLOAD_URL="https://github.com/ggml-org/llama.cpp/releases/download/${TAG}/${ASSET_NAME}"

echo "[download-llama] Downloading $ASSET_NAME ($TAG)..."
mkdir -p "$BINARIES_DIR"

TMPDIR=$(mktemp -d)
curl -L --progress-bar -o "$TMPDIR/$ASSET_NAME" "$DOWNLOAD_URL"

echo "[download-llama] Extracting llama-server and libraries..."
tar -xzf "$TMPDIR/$ASSET_NAME" -C "$TMPDIR"

# Find the extraction directory
EXTRACT_DIR=$(find "$TMPDIR" -mindepth 1 -maxdepth 1 -type d | head -1)
if [ -z "$EXTRACT_DIR" ]; then
  EXTRACT_DIR="$TMPDIR"
fi

# Copy llama-server binary
FOUND=$(find "$EXTRACT_DIR" -name "llama-server" -type f | head -1)
if [ -z "$FOUND" ]; then
  echo "[download-llama] ERROR: llama-server not found in archive."
  rm -rf "$TMPDIR"
  exit 1
fi
cp "$FOUND" "$BINARY_PATH"
chmod +x "$BINARY_PATH"

# Copy all shared libraries (.dylib) — required for llama-server to run
LIB_COUNT=0
for lib in "$EXTRACT_DIR"/*.dylib; do
  [ -f "$lib" ] || continue
  cp "$lib" "$BINARIES_DIR/"
  LIB_COUNT=$((LIB_COUNT + 1))
done
echo "[download-llama] Copied $LIB_COUNT shared libraries."

# Remove quarantine attribute on all binaries (macOS blocks downloaded binaries)
xattr -cr "$BINARIES_DIR" 2>/dev/null || true

rm -rf "$TMPDIR"

echo "[download-llama] Done! llama-server ($TAG) installed at $BINARIES_DIR"
ls -lh "$BINARIES_DIR"
"$BINARY_PATH" --version 2>/dev/null || true
