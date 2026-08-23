# Real-world check: Notion on two stores

On 2026-08-23 at approximately 20:12 UTC, App Verbatim ran its default release policy against public Notion reviews from [Google Play](https://play.google.com/store/apps/details?id=notion.id) and the [US Apple App Store](https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281).

This is a timestamped product check, not a claim about Notion's overall quality. Store reviews are mutable samples, version sample sizes are small, and rerunning the commands can produce different results.

## Result

| Store | Current version | Baseline | Current sample | Baseline sample | Rating change | Low-rating change | Gate |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Google Play | `0.6.4080` | `0.6.4068` | 8 | 58 | **−1.08** | **+27.6 pp** | **Fail — 2 signals** |
| Apple App Store | `1.7.328` | `1.7.327` | 10 | 12 | **−0.45** | 0 pp | **Fail — 3 signals** |

The Android check crossed the default rating-drop and low-rating-share thresholds. The iOS check crossed the rating-drop threshold and found 21.7 percentage-point increases in both stability and feature-request language, each supported by three current-version reviews.

App Verbatim returned exit code `1` for both commands. The same result in GitHub Actions produces a failed check, an evidence-rich job summary, machine-readable JSON, and—when enabled—one deduplicated issue.

## Reproduce it

```bash
npx --yes github:Nike232/app-verbatim-core check \
  "https://play.google.com/store/apps/details?id=notion.id" \
  --country US --language en --limit 300

npx --yes github:Nike232/app-verbatim-core check \
  "https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281" \
  --country US --language en --limit 300
```

The default policy requires at least five reviews for both versions, allows a rating drop of at most 0.40 stars, a low-rating-share increase of at most 15 percentage points, and a known complaint-theme increase of at most 18 percentage points with at least three current-version reviews.

## What this proves—and what it does not

It proves that the public connectors, version selection, policy engine, evidence chain, and CI exit behavior work against live listings on both supported stores. It does not prove the detected change was caused by a specific release, that the review sample represents every user, or that every future store response will contain enough version-labelled evidence. The gate reports `insufficient-data` separately when the evidence is too thin.

