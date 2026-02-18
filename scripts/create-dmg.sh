#!/bin/bash
set -euo pipefail

# Build a DMG installer for Tasmania using macOS-native hdiutil.
# Usage: bash scripts/create-dmg.sh

APP_NAME="Tasmania"
APP_PATH="out/${APP_NAME}-darwin-arm64/${APP_NAME}.app"
DMG_NAME="${APP_NAME}-$(node -p "require('./package.json').version")-arm64"
DMG_DIR="out/make"
DMG_PATH="${DMG_DIR}/${DMG_NAME}.dmg"
STAGING_DIR=$(mktemp -d)

echo "── Creating DMG: ${DMG_NAME}.dmg ──"

# Ensure the packaged app exists
if [ ! -d "$APP_PATH" ]; then
  echo "Error: $APP_PATH not found. Run 'npx electron-forge package' first."
  exit 1
fi

# Prepare staging directory
echo "→ Staging app..."
cp -R "$APP_PATH" "${STAGING_DIR}/${APP_NAME}.app"
ln -s /Applications "${STAGING_DIR}/Applications"

# Create DMG
mkdir -p "$DMG_DIR"
rm -f "$DMG_PATH"

echo "→ Creating DMG..."
hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING_DIR" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

# Clean up
rm -rf "$STAGING_DIR"

# Sign the DMG
echo "→ Signing DMG..."
codesign --sign "Developer ID Application: Mathieu Baril (SBQZY8LF6G)" "$DMG_PATH"

# Notarize the DMG
if [[ -n "${APPLE_ID:-}" && -n "${APPLE_ID_PASSWORD:-}" ]]; then
  echo "→ Submitting DMG for notarization..."
  xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_ID_PASSWORD" \
    --team-id "SBQZY8LF6G" \
    --wait

  echo "→ Stapling notarization ticket..."
  xcrun stapler staple "$DMG_PATH"
else
  echo "⚠ APPLE_ID / APPLE_ID_PASSWORD not set — skipping notarization."
  echo "  Set them to notarize: export APPLE_ID=you@example.com APPLE_ID_PASSWORD=xxxx-xxxx-xxxx-xxxx"
fi

echo ""
echo "✔ DMG created: $DMG_PATH"
echo "  Size: $(du -sh "$DMG_PATH" | cut -f1)"
