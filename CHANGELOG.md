# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and Semantic Versioning.

## [Unreleased]

## [0.5.9] - 2026-08-31

### Added

- Added deterministic low-rating review triage across software failures, product policy and pricing, community or content governance, support, and unclear feedback, with per-version counts, shares, and source evidence.
- Added repeated version-linked software issue detection and `software-regression`, `manual-review`, or `observe` routing across the public API, CLI, GitHub Action, and MCP tool.
- Added a balanced 60-example, six-language actionability benchmark with overall and per-category quality gates.

### Changed

- Failed review-outcome gates remain blocking, but now distinguish engineering-ready repeated software regressions from failures whose causality needs manual review.
- Numeric version references such as `version 4.8.0` now count as explicit release-link evidence, and actionable issue evidence prioritizes release-linked reviews.

### Validated

- Live calibration separated Discord's repeated version-linked software symptoms (`software-regression`) from Bitwarden, Signal, and Notion outcome regressions that lacked a repeated supported software cluster (`manual-review`) without changing any raw pass/fail decision.

## [0.5.8] - 2026-08-31

### Added

- Added deterministic release-link evidence for every version and regression result, separating explicit update/version references from broader before-and-after language across English, German, Simplified Chinese, Japanese, Spanish, and French.
- Added a transparent 40-example release-link benchmark with committed precision, recall, and exact-match gates, including hard negatives that mention “update” or “version” without linking a complaint to a release.

### Changed

- GitHub Action, CLI, MCP, public types, and aggregate live-cohort reports now expose whether causal release evidence is supported, limited, absent, or unavailable. This diagnostic does not filter review outcomes or weaken the rating-based gate.

### Validated

- A final 40-case Apple/Google × US/German matrix run completed with zero connector errors, 16 decisions, and the same four rating-plus-low-rating-share failures seen in two preceding runs. Release-link evidence separated Discord and Notion (`supported`) from Bitwarden (`limited`) and Signal (`none`) without changing any gate result.

## [0.5.7] - 2026-08-30

### Added

- Added high-precision German complaint vocabulary and German stop words for both fixed themes and unknown-problem phrase discovery.
- Expanded the transparent benchmark to 43 German examples and added a committed per-language quality policy that prevents global scores from hiding German regressions.
- Added request-overlap accounting so an explicit request for a requestable capability such as offline mode stays advisory while a real failure mentioned alongside a separate request remains blocking evidence. Complaint insights and evidence selection now use the same distinction as release gates.

### Changed

- Theme matches now expose their `intent`, and per-version theme signals report `requestOverlapCount` alongside complaint-only evidence.
- Clarified the presentation labels for stability, monetization, and privacy/security themes without changing their stable theme IDs.

### Validated

- Replayed the old and new classifiers over the same 44-review live German current-version sample: matched complaint coverage increased from 9 reviews (`20.5%`) to 17 (`38.6%`). Two subsequent 40-case matrix runs were identical, with German coverage close to US English (`41.2%`) and no theme-only release failure.

## [0.5.6] - 2026-08-30

### Added

- Added an aggregate-only 40-case cross-storefront validation matrix pairing 10 applications across Apple App Store and Google Play listings in US English and German storefronts.
- Added per-version `complaintCount`, `complaintShare`, and complaint-only evidence alongside the existing all-rating theme aggregates.

### Fixed

- Stopped positive four- and five-star theme mentions from being counted as release-blocking complaints.
- Kept feature-request themes visible for product discovery without allowing feature demand alone to fail a release gate.
- Retried transient empty Apple RSS responses on every requested page and marked persistent later-page gaps as partial, preventing a truncated upstream sample from producing a pass or fail decision.
- Added structured `sourceEvidence` readiness to regression results so connector completeness is independent from per-version sample counts.

### Validated

- Two consecutive pre-fix matrix runs exposed two theme-only false blocks and intermittent Apple later-page truncation; corrected runs produced no pass/fail contradictions, preserved the same two rating-plus-low-rating-share failures, and converted incomplete Apple sources to explicit insufficient results.

## [0.5.5] - 2026-08-30

### Added

- Added a 20-app, aggregate-only live cohort harness for measuring release-policy decisiveness and identifying cases that need human evidence review without committing review content.
- Added structured `versionEvidence` counts to regression results so agents and CI can tell exactly which version is under-sampled and how many reviews are missing.

### Validated

- Ran the default policy twice across a 20-app public Google Play cohort with identical results: 11 decidable, 9 safely inconclusive, 0 connector errors, and all 4 failures supported by actionable source evidence.

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
