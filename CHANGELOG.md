# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [Unreleased]

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
