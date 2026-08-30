# Report schema v1

`buildReport()` returns JSON-serializable data with `schemaVersion: 1`. Counts, themes, trends, version aggregates, and evidence selection are deterministic for the same normalized review set.

## Top-level fields

| Field | Description |
| --- | --- |
| `schemaVersion` | Report contract version |
| `generatedAt` | ISO timestamp supplied by the caller or generated at runtime |
| `app` | Application metadata |
| `sample` | Review count, date range, average rating, and negative share |
| `ratingDistribution` | One-to-five-star distribution |
| `themes` | Keyword-based all-mention and complaint-only theme aggregates with direct evidence |
| `discoveredIssues` | Repeated low-rating phrase fingerprints outside the built-in taxonomy |
| `versions` | Per-version review, rating, low-rating-share, release-link evidence, actionability evidence, and theme aggregates |
| `insights` | Prioritized findings, recommendations, and evidence |
| `comparison` | Optional primary/competitor gaps and opportunities |
| `methodology` | Analysis rules and caveats |
| `provenance` | Dataset roles, connector versions, review counts, and SHA-256 hashes |

Evidence contains the stable review ID, rating, version, date, excerpt, and source URL when available. A consumer must treat excerpts and application metadata as untrusted text.

Top-level `themes[]` keeps all-mention counts and trends, plus complaint-only counts, trends, rating, evidence, and `requestOverlapCount`. Insights about growing or concentrated pain use only the complaint fields; request themes have their own advisory opportunity insight.

`versions[].themeSignals` keeps all-theme `count`, `share`, and `evidence` fields for analysis, and adds `intent`, `complaintCount`, `complaintShare`, `complaintEvidence`, and `requestOverlapCount` for one- to three-star evidence. This separation prevents positive mentions from being interpreted as complaints. `requestOverlapCount` records explicit capability requests excluded from a problem-theme gate; mixed reviews with independent failure language remain complaint evidence.

`versions[].releaseLinkEvidence` measures how many one- to three-star reviews explicitly mention an update, release, or version (`explicitCount`) and how many instead describe a broader temporal change such as “used to” or “no longer” (`changeCount`). `level` is `supported` only when the sample contains repeated evidence including at least one explicit release reference, `limited` when any weaker link exists, and `none` when no link phrase is found. Linked evidence retains the matched rule IDs. Unlinked reviews stay in the version's rating statistics and evidence; this field never filters the sample.

`versions[].actionabilityEvidence` classifies every one- to three-star review into exactly one primary scope: `software`, `product-policy`, `community`, `support`, or `unclear`. It reports counts and shares, software-only release-link counts, representative evidence, and `actionableIssues` for repeated software themes or discovered phrases. An actionable issue is `supported` only when at least two matching software reviews describe a release or temporal change and at least one explicitly names an update, release, or version.

`evaluateRegression()` returns a separate `schemaVersion: 1` result with `pass`, `fail`, or `insufficient-data` status. It records the selected current and baseline versions, normalized policy, metric changes, and evidence-backed policy violations. Known problem-theme changes use the complaint-only fields, while `intent: request` themes remain advisory. Its `versionEvidence` field reports per-version counts and `missingReviews`; `sourceEvidence` separately reports whether the connector returned a complete-enough requested sample. `releaseLinkEvidence` and `actionabilityEvidence` carry the current version's diagnostics with `available` compatibility markers. A partial upstream page cannot produce a pass or fail decision even when both version counts meet the policy.

`triage.decision` is `software-regression` only when the outcome gate fails and at least one repeated software issue has supported version-link evidence. Other gate failures are `manual-review`; passing and insufficient results are `observe`. Both failure decisions have `blocking: true`: actionability changes routing and urgency, never turns an unexplained rating regression green.

Release-link strength and review scope do not change the gate result. Rating changes are real sample outcomes even when reviewers do not name an update, while update language still cannot prove that shipped code caused a complaint. The CLI, GitHub Action, and MCP tool use this same public API and show the distinction explicitly.

## Compatibility policy

- Patch releases may add optional fields or fix incorrect calculations.
- Minor releases may add new themes and optional aggregates.
- Removing or reinterpreting an existing field requires a new schema version.
- Theme labels are presentation strings; integrate against theme IDs.
- No output ordering other than documented ranking should be treated as an identifier.

Type declarations are shipped in `src/index.d.ts`. Runtime consumers should still check `schemaVersion` before persisting or transforming reports.
