# Theme benchmark

`theme-eval.jsonl` is a small, hand-authored regression set for the built-in deterministic taxonomy. It currently contains English, Simplified Chinese, German, Spanish, French, and Japanese examples, including multi-label and no-label cases. German has 43 focused examples because the live storefront matrix identified it as the weakest supported locale.

Run it with:

```bash
npm run check:eval
```

The script reports micro precision, recall, F1, exact-match accuracy, per-label counts, and per-language metrics. Thresholds live in `theme-eval-policy.json`: overall precision must be at least `0.90`, recall at least `0.85`, and exact match at least `0.80`; German additionally requires at least 40 examples, `0.90` precision and recall, and `0.85` exact match.

This is a transparent software regression test, not evidence of performance on representative production traffic. It is intentionally committed in readable form so contributors can challenge examples, add adversarial cases, and see exactly what a score means. Production decisions should validate the engine against a labeled sample from the target app, language, and storefront.

Release-policy validation against changing public data is documented separately in [RELEASE_COHORT.md](RELEASE_COHORT.md). The [cross-storefront matrix](STOREFRONT_MATRIX.md) adds paired Apple and Google cases in US English and German storefronts. Their manifests and aggregate conclusions are committed, but fetched review content is not.
