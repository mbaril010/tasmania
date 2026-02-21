# Security Release Checklist

## Required Before Release
- Run `npm run security:check`.
- Run `npm run package`.
- Run `npm run verify`.
- Confirm binary checksums pass with:
  - `bash scripts/download-llama.sh --verify-only`
  - `bash scripts/download-sd.sh --verify-only`
- Confirm CI workflow `Security Audit` is green.

## Accepted Risks
- Terminal auto-launch currently uses `claude --dangerously-skip-permissions` by explicit product decision.
- This behavior is intentional and must not be silently reused in other features.
- Any change to this decision requires explicit review and release-note mention.
