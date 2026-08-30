# Deterministic classifier benchmarks

`theme-eval.jsonl` is a small, hand-authored regression set for the built-in deterministic taxonomy. It currently contains English, Simplified Chinese, German, Spanish, French, and Japanese examples, including multi-label and no-label cases. German has 43 focused examples because the live storefront matrix identified it as the weakest supported locale.

Run it with:

```bash
npm run check:eval
```

The script reports micro precision, recall, F1, exact-match accuracy, per-label counts, and per-language metrics. Thresholds live in `theme-eval-policy.json`: overall precision must be at least `0.90`, recall at least `0.85`, and exact match at least `0.80`; German additionally requires at least 40 examples, `0.90` precision and recall, and `0.85` exact match.

This is a transparent software regression test, not evidence of performance on representative production traffic. It is intentionally committed in readable form so contributors can challenge examples, add adversarial cases, and see exactly what a score means. Production decisions should validate the engine against a labeled sample from the target app, language, and storefront.

`release-link-eval.jsonl` separately covers explicit update/version references, direct numeric version identifiers, broader before-and-after change language, and hard negatives that contain words such as “version” or “update” without linking a complaint to a release. It contains hand-authored examples across the same six languages and is protected by `release-link-eval-policy.json`.

`actionability-eval.jsonl` contains 60 balanced, hand-authored or paraphrased examples across five primary scopes: software failures, product policy and pricing, community or content governance, support, and unclear low-information feedback. It includes paraphrased edge cases derived from the Bitwarden, Signal, Notion, and Discord live calibration without committing fetched review text. `actionability-eval-policy.json` requires overall and per-category precision and recall gates. `npm run check:eval` evaluates all three deterministic classifiers.

These benchmarks are transparent regression sets, not claims of representative production accuracy or causal proof. The actionability layer is intentionally conservative: it changes the routing label only after the raw outcome gate fails, repeated software symptoms are present, and version-link evidence meets its threshold.

Release-policy validation against changing public data is documented separately in [RELEASE_COHORT.md](RELEASE_COHORT.md). The [cross-storefront matrix](STOREFRONT_MATRIX.md) adds paired Apple and Google cases in US English and German storefronts. Their manifests and aggregate conclusions are committed, but fetched review content is not.
