# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [Unreleased]

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
