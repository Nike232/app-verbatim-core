# Releasing Core

Maintainers only.

1. Confirm the working tree is clean and CI is green.
2. Run `npm ci`, `npm run check`, and the opt-in live connector test.
3. Confirm `CHANGELOG.md`, `package.json`, `src/index.js`, and the git tag use the same version.
4. Inspect `npm pack --dry-run`; no product, Pro, fixture secrets, local reports, or environment files may appear.
5. Create an annotated `vX.Y.Z` tag (signed when maintainer signing is configured) and push it.
6. The release workflow verifies the package, creates a GitHub Release containing the npm tarball and checksums, and advances the moving `v0` tag only after the release succeeds.
7. npm publishing remains a separate explicit approval step until package ownership, 2FA, provenance, and recovery access are configured.

Never publish from a dirty worktree or directly from a developer laptop with an unreviewed package payload.
