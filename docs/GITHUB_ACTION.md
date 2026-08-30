# GitHub Action reference

App Verbatim's action evaluates the actual newest app version against the newest sufficiently sampled earlier baseline. It refuses to decide when version evidence is too small or the public connector reports a partial source sample. Its summary separately labels release-link evidence and classifies low-rating review scope. A failed gate becomes `software-regression` only with repeated version-linked software symptoms; otherwise it becomes `manual-review` and remains blocking. It writes a Markdown job summary and two JSON files, and can fail the job or maintain one deduplicated regression issue.

## Minimal workflow

```yaml
permissions:
  contents: read

steps:
  - uses: Nike232/app-verbatim-core@v0
    with:
      app-url: https://apps.apple.com/us/app/example/id123456789
```

To create or update a regression issue, grant `issues: write`, set `create-issue: true`, and pass `${{ secrets.GITHUB_TOKEN }}` as `github-token`.

## Observe before enforcing

New adopters can keep the workflow non-blocking while calibrating thresholds:

```yaml
- uses: Nike232/app-verbatim-core@v0
  with:
    app-url: https://play.google.com/store/apps/details?id=YOUR.APP.ID
    fail-on-regression: false
```

The result still reports `fail`, writes evidence and can maintain the deduplicated issue; only the workflow conclusion stays green. Remove `fail-on-regression: false` when the policy fits the app's review volume.

## Inputs

| Input | Default | Meaning |
| --- | --- | --- |
| `app-url` | — | Public Apple App Store or Google Play listing URL. |
| `country` | `US` | Storefront country. |
| `language` | `en` | Review language used by supported connectors. |
| `limit` | `300` | Maximum reviews to evaluate. |
| `min-version-reviews` | `10` | Required sample for both versions. |
| `max-rating-drop` | `0.4` | Allowed average-rating drop in stars. |
| `max-negative-increase` | `0.15` | Allowed increase in one- and two-star share. |
| `max-theme-increase` | `0.18` | Allowed increase in a one- to three-star known problem theme. Positive mentions and feature-request themes never fail the gate. |
| `max-discovered-share` | `0.05` | Allowed share for a newly discovered issue fingerprint. |
| `min-theme-reviews` | `3` | Required current-version evidence for a theme or new issue. |
| `create-issue` | `false` | Create or update one issue when the result fails. |
| `github-token` | — | Token used for issue creation. |
| `fail-on-regression` | `true` | Return a failing Action status on regression. |
| `fail-on-insufficient-data` | `false` | Fail when the actual newest version or an earlier baseline lacks enough evidence. |
| `output` | `app-verbatim-regression.json` | Regression-result path. |
| `report-output` | `app-verbatim-report.json` | Full evidence-report path. |

## Outputs

`status`, `current-version`, `baseline-version`, `release-link-level`, `triage-decision`, `violations`, `result-file`, `report-file`, and `issue-url` are available to later steps. `release-link-level` is `supported`, `limited`, or `none`; it is empty only when an older report producer did not supply the diagnostic. `triage-decision` is `software-regression`, `manual-review`, or `observe`. A `manual-review` result still has `status: fail` and fails the Action when `fail-on-regression` is enabled.

## Upload the evidence

```yaml
- id: reviews
  uses: Nike232/app-verbatim-core@v0
  with:
    app-url: https://play.google.com/store/apps/details?id=YOUR.APP.ID

- uses: actions/upload-artifact@v6
  if: always()
  with:
    name: app-review-evidence
    path: |
      ${{ steps.reviews.outputs.result-file }}
      ${{ steps.reviews.outputs.report-file }}
```

Pin a full release tag such as `v0.5.9` when your security policy does not permit moving major tags.
