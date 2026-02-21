# Dependency Policy

## Goals
- Reduce known-vulnerability exposure in both desktop app and landing site.
- Keep binary and npm dependency updates deliberate, auditable, and reversible.

## Rules
- Use `npm ci --ignore-scripts` in CI for dependency audit steps.
- Run `npm audit --audit-level=moderate` for root and `landing/`.
- Treat pre-release runtime packages as explicit risk decisions and review quarterly.
- Pin binary checksums in `scripts/binary-manifest.json`; update only via reviewed PR.
- If a critical advisory is reported in runtime deps, ship a mitigation or upgrade before release.

## Release Gate
- `npm run security:check` must pass on default branch.
- CI security workflow must pass on PR before merge.
- Any accepted risk must be documented in `docs/security/release-checklist.md`.
