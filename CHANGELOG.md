# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [Unreleased]

## [0.5.4] - 2026-08-30

### Fixed

- Corrected stale security-support, release-process, README, and Action-output documentation so it matches the actual newest-release behavior and version source.

### Changed

- Hardened GitHub workflows with immutable action SHAs, explicit timeouts and concurrency, production-dependency auditing, and one stable required quality gate.
- Release automation now rejects tag/package/changelog version mismatches and creates a build-provenance attestation for the package artifact.
- Added explicit support routing and code ownership for contributor, workflow, and security-sensitive changes.

## [0.5.3] - 2026-08-30

### Fixed

- Stopped release checks from skipping an under-sampled newest version and silently comparing two older releases; the result now reports insufficient evidence for the actual newest release.

### Changed

- Raised the default minimum sample from 5 to 10 reviews per version after real-project validation showed that smaller samples produced noisy gates.

## [0.5.2] - 2026-08-30

### Fixed

- Made the CLI, MCP server, connector user agent, and public API share one version module, with smoke tests that verify it against package metadata so release identity cannot drift silently again.

### Changed

- Made `init` state its enforcement and Issue modes after scaffolding, and warn Apple users when public fallback data cannot support version attribution.

## [0.5.1] - 2026-08-30

### Fixed

- Restored Apple App Store analysis when the legacy customer-review RSS feed returns an empty result by falling back to the reviews rendered on Apple's public App Store page.
- Made fallback provenance explicit, deduplicated embedded review objects, and reported when public fallback reviews do not contain app-version data.

## [0.5.0] - 2026-08-24

### Added

- Non-blocking `init --observe-only` onboarding mode so teams can calibrate regression thresholds before enforcing the quality gate.

## [0.4.0] - 2026-08-24

### Added

- One-command `init` workflow scaffolding with store URL validation, canonical URLs, storefront defaults, optional deduplicated issues, safe overwrite protection, and action-ref pinning.
- Timestamped real-world Notion review snapshot across Google Play and the Apple App Store, with reproduction commands and explicit limitations.
- Share-ready project artwork for the README and GitHub social preview.

## [0.3.0] - 2026-08-24

### Added

- Local stdio MCP server for agent-native review analysis without an additional AI key.
- Read-only `check_release_regression`, `analyze_app_reviews`, and `compare_app_reviews` MCP tools.
- Protocol-level MCP smoke test covering initialization, discovery, structured tool output, and clean shutdown.
- Packed-package MCP verification and client-agnostic configuration documentation.

## [0.2.0] - 2026-08-24

### Added

- Evidence-backed release regression policy engine and failing `check` CLI command.
- Reusable bundled GitHub Action with job summaries, JSON artifacts, configurable gates, and deduplicated regression issues.
- Deterministic discovery of repeated low-rating language outside the built-in theme taxonomy.
- Per-version theme evidence for rating, low-rating-share, and complaint-share comparisons.
- Transparent six-language taxonomy benchmark and bundled Action smoke test.

### Changed

- Repositioned the project around developer-native mobile release health.
- Tightened Latin-keyword matching to token boundaries and expanded report exports with discovered issues.
- Retried transient empty first-page responses from the Apple public review feed.

## [0.1.0] - 2026-08-24

### Added

- App Store and Google Play public-review connectors.
- Deterministic review normalization, deduplication, themes, trends, version signals, and competitor gaps.
- Evidence citations and provenance hashes.
- JSON, CSV, Markdown, and standalone HTML export.
- CLI commands for live analysis, URL inspection, runtime diagnostics, connector discovery, and an offline demo.
- Connector registry and documented third-party connector contract.
