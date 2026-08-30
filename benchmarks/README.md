# Theme benchmark

`theme-eval.jsonl` is a small, hand-authored regression set for the built-in deterministic taxonomy. It currently contains English, Simplified Chinese, German, Spanish, French, and Japanese examples, including multi-label and no-label cases.

Run it with:

```bash
npm run check:eval
```

The script reports micro precision, recall, F1, exact-match accuracy, and per-label counts. CI currently requires micro-F1 of at least `0.85` and exact match of at least `0.75`.

This is a transparent software regression test, not evidence of performance on representative production traffic. It is intentionally committed in readable form so contributors can challenge examples, add adversarial cases, and see exactly what a score means. Production decisions should validate the engine against a labeled sample from the target app, language, and storefront.

Release-policy validation against changing public data is documented separately in [RELEASE_COHORT.md](RELEASE_COHORT.md). Its manifest is committed, but fetched review content is not.
