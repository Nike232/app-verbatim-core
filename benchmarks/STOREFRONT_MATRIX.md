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
