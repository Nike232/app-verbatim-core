# Cross-storefront validation matrix

`storefront-matrix.json` pairs 10 established applications across Apple App Store and Google Play listings, then evaluates each listing in the US English and German storefronts. The resulting 40 cases measure whether public connectors return usable version evidence and whether deterministic complaint themes still cover low-rating reviews outside the original US English cohort.

Run the matrix with:

```bash
npm run validate:matrix
```

The command writes `reports/storefront-matrix.json`. Like the release cohort, the report is aggregate-only: it contains application identifiers, storefront settings, counts, version evidence, policy metrics, signal identifiers, and connector health. It excludes review text, authors, and review identifiers, and `reports/` remains gitignored.

Use `npm run validate:matrix -- --app notion` to run all four Notion cases, or pass a fully expanded case slug such as `notion-apple-app-store-de-de`. The committed manifest is validated offline during `npm run check`.

## Interpretation limits

- Apple review feeds are selected by country; the `language` value describes the intended locale but does not force Apple to return only that language.
- Google Play receives both the country and language settings.
- Apple and Android releases have different version histories, so matching pass/fail statuses across stores is not an accuracy target.
- Decision coverage, connector errors, fallback use, missing version evidence, and weighted known-theme coverage among one- to three-star current-version reviews are comparable operational measures.
- Live store data changes. Timestamped conclusions must record aggregate results and manually adjudicate observed failures without committing review content.

## Snapshot: 2026-08-30

The first two complete matrix runs returned the same 15 decisions, 25 insufficient results, and zero connector errors. They exposed two unsafe theme-only failures:

- Firefox on the US Apple storefront failed because four- and five-star praise for synchronization was counted as a complaint increase.
- DuckDuckGo on the US Apple storefront failed only on the feature-request theme even though its low-rating share improved.

The runs also showed that Apple's public RSS pagination could return different total sample sizes while leaving the newest-version counts unchanged. One later run truncated DuckDuckGo from 150 fetched reviews to 50 and moved its sampled rating drop across the configured threshold.

Those findings produced three narrow corrections: per-version theme gates now use only one- to three-star evidence, request-intent themes remain advisory, and persistent empty later Apple pages mark the source sample incomplete. A partial source now returns `insufficient-data` through structured `sourceEvidence` instead of guessing.

Two final full runs after the corrections produced:

| Measure | Run A | Run B |
| --- | ---: | ---: |
| Completed cases | 40 | 40 |
| Decidable | 12 | 11 |
| Pass | 10 | 9 |
| Fail | 2 | 2 |
| Insufficient data | 28 | 29 |
| Connector errors | 0 | 0 |
| Source-incomplete cases | 5 | 6 |

Both failures were identical in both runs: Bitwarden and Discord on Google Play's US English storefront, each backed by simultaneous rating-drop and low-rating-share violations. Eleven decisions were identical across both runs. There were no pass/fail contradictions; the only status transition was DuckDuckGo on the US Apple storefront moving from `pass` to `insufficient-data` when the second run detected an incomplete upstream page.

Known-theme coverage among current-version one- to three-star reviews was `38.1%` and `37.2%` overall. US English coverage was `40.4%` and `39.4%`, while German coverage was `20.9%` in both runs. This is a lower-bound coverage measure for the fixed taxonomy; repeated phrases outside it can still appear under discovered issues. The language gap is evidence for future taxonomy work, not a reason to weaken the release thresholds.

The lower final decision rate is deliberate: uncertain Apple samples are now rejected instead of being allowed to produce unstable release conclusions.

## German calibration follow-up: 2026-08-30

The German gap above was addressed with high-precision German complaint phrases, German stop words for unknown-issue discovery, and a 43-example German benchmark protected by committed per-language precision, recall, and exact-match thresholds. Explicit requests for requestable capabilities are now excluded from overlapping problem-theme gates, while mixed reviews that independently describe a failure remain complaint evidence.

A same-sample shadow comparison over 44 current-version German complaints matched 9 reviews (`20.5%`) with the v0.5.6 rules and 17 (`38.6%`) with the calibrated rules. Broad phrases that produced ambiguous matches during manual review, including generic equivalents of “does not go” and “unusable,” were removed before the final runs.

Two consecutive full matrix runs then produced identical results:

| Measure | Run A | Run B |
| --- | ---: | ---: |
| Completed cases | 40 | 40 |
| Decidable | 15 | 15 |
| Pass | 12 | 12 |
| Fail | 3 | 3 |
| Insufficient data | 25 | 25 |
| German complaint-theme coverage | 17 / 44 (`38.6%`) | 17 / 44 (`38.6%`) |
| US English complaint-theme coverage | 134 / 325 (`41.2%`) | 134 / 325 (`41.2%`) |

The same three cases failed in both runs: Bitwarden on Google Play US, Signal on Apple US, and Discord on Google Play US. Every failure was backed by both rating-drop and low-rating-share signals; no known-theme or discovered-issue rule created a new failure. Signal's current-version evidence was manually checked and contained low-rating reports about data loss and account-safety concerns, but store reviews still show correlation rather than proving that a specific release caused those reports.

All 40 cases completed without connector errors or partial-source decisions in these two runs. That improved source availability is an upstream snapshot, not a guarantee that Apple pagination will remain complete; the fail-safe source check remains necessary.

## Release-link evidence follow-up: 2026-08-31

Version metadata can correlate a low rating with a release, but it cannot show whether the reviewer is actually describing a shipped change. A new diagnostic layer therefore separates explicit update/version references from broader temporal-change language. It never removes a review from the rating sample and never changes the gate result.

The final 40-case run completed without connector errors or partial sources:

| Measure | Result |
| --- | ---: |
| Completed cases | 40 |
| Decidable | 16 |
| Pass | 12 |
| Fail | 4 |
| Insufficient data | 24 |
| Release link supported | 2 |
| Release link limited | 9 |
| No release-link phrase found | 29 |

All four failures still contained both a rating drop and a low-rating-share increase. The new evidence layer made their causal support visibly different:

| Failed case | Diagnostic | Explicit update/version | Temporal change | One- to three-star reviews |
| --- | --- | ---: | ---: | ---: |
| Bitwarden · Google Play · US | limited | 0 | 2 | 9 |
| Signal · Apple · US | none | 0 | 0 | 7 |
| Notion · Google Play · US | supported | 1 | 2 | 6 |
| Discord · Google Play · US | supported | 7 | 5 | 85 |

Manual review agreed with the distinctions. Discord contained repeated references to the newest or recent updates. Notion included an “update required” loop with no update available, alongside changed behavior and worsening experience. Bitwarden described recent or no-longer-working behavior without naming a release. Signal's low ratings described data loss, scams, account safety, and moderation concerns but did not connect those complaints to an update; the rating regression remains visible while its release causality is explicitly unsupported by the retrieved text.

Two preceding full runs produced the same pass/fail/insufficient statuses and aggregate counts. The final rule refinement added the Notion update loop and changed-behavior wording to the transparent benchmark before this recorded run. The committed live report remains aggregate-only and excludes review text, authors, and review identifiers.

## Actionability triage follow-up: 2026-08-31

Release-link evidence says whether reviewers connect a complaint to change, but it does not tell an engineering team whether the complaint is a software failure, a product-policy objection, a community-governance problem, a support complaint, or too vague to route. The actionability layer assigns every current-version one- to three-star review to one of those five scopes while preserving the existing outcome gate.

The final 40-case run produced:

| Measure | Result |
| --- | ---: |
| Completed cases | 40 |
| Decidable | 16 |
| Pass | 12 |
| Fail | 4 |
| Insufficient data | 24 |
| Connector errors | 0 |
| Software regression | 1 |
| Manual review | 3 |
| Observe | 36 |

Across 375 current-version low-rating reviews, the primary scopes were 83 software, 51 product policy, 12 community, 3 support, and 226 unclear. These are routing counts from a deterministic taxonomy, not prevalence estimates for either store.

The same four US failures remained backed by rating-drop and low-rating-share signals. Triage separated them without changing their blocking status:

| Failed case | Triage | Why |
| --- | --- | --- |
| Bitwarden · Google Play · US | `manual-review` | Repeated account symptoms had temporal-change language but no explicit update or version reference. |
| Signal · Apple · US | `manual-review` | Most classified evidence concerned community governance, with no release-link phrase and no repeated software cluster. |
| Notion · Google Play · US | `manual-review` | Release-link evidence was supported, but the software symptoms did not repeat as one supported cluster. |
| Discord · Google Play · US | `software-regression` | Repeated account, stability, and notification symptoms each met the release-link rule, including explicit update evidence. |

This is deliberately asymmetric. A failure needs both a failed outcome gate and a repeated version-linked software issue before it receives the engineering-ready label. Everything else remains a blocking `manual-review`; uncertain causality never converts a bad outcome into a pass. The aggregate report excludes review text, issue labels, authors, and review identifiers.
