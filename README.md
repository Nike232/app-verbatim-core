# App Verbatim

[![CI](https://github.com/Nike232/app-verbatim-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Nike232/app-verbatim-core/actions/workflows/ci.yml)
[![Live connectors](https://github.com/Nike232/app-verbatim-core/actions/workflows/live-connectors.yml/badge.svg)](https://github.com/Nike232/app-verbatim-core/actions/workflows/live-connectors.yml)
[![Release](https://img.shields.io/github/v/release/Nike232/app-verbatim-core?display_name=tag)](https://github.com/Nike232/app-verbatim-core/releases)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--or--later-1f6f50.svg)](LICENSE)
[![Node.js 22.12+](https://img.shields.io/badge/node-%3E%3D22.12-43853d.svg)](package.json)

![App Verbatim turns app reviews into a release quality gate](docs/assets/app-verbatim-hero.png)

**Catch bad mobile releases from App Store and Google Play reviews—inside CI.**

App Verbatim compares review evidence between app versions, detects rating and complaint regressions, discovers repeated problems outside its built-in taxonomy, and can fail a GitHub workflow before a bad release becomes silent churn.

No dashboard. No AI key. No claim without source reviews.

[Sample evidence report](https://nike232.github.io/app-verbatim-core/) · [简体中文](README.zh-CN.md) · [GitHub Action reference](docs/GITHUB_ACTION.md) · [Report schema](docs/REPORT_SCHEMA.md)

## See the failure in 30 seconds

```bash
npx --yes github:Nike232/app-verbatim-core check --demo
```

The bundled scenario compares release `4.8.0` with `4.7.2` and exits with code `1`:

```text
❌ Pulse Notes review regression check

Current 4.8.0       Baseline 4.7.2       Change
1.97 stars          3.31 stars           -1.34
72% low ratings     28% low ratings       +44 pp

🔴 Average rating dropped by 1.34
🔴 Low-rating share increased by 44%
🟠 Stability and crashes complaints increased by 26%
🔴 New complaint fingerprint: camera uploads
```

Every signal carries the reviews that produced it. Try a public listing:

```bash
npx --yes github:Nike232/app-verbatim-core check \
  "https://play.google.com/store/apps/details?id=notion.id" \
  --country US --language en --limit 300
```

On a timestamped live check, that command flagged potential release regressions in Notion reviews on **both Google Play and the Apple App Store**. The transparent [real-world case study](docs/CASE_STUDY_NOTION.md) includes the sample sizes, exact thresholds, reproduction commands, and limitations.

## Add it to a repository in one command

Run this from your mobile app repository:

```bash
npx --yes github:Nike232/app-verbatim-core init \
  "https://play.google.com/store/apps/details?id=YOUR.APP.ID" \
  --observe-only \
  --create-issue
```

It validates and canonicalizes the store URL, then creates `.github/workflows/app-verbatim.yml` with a daily schedule, manual trigger, least-privilege permissions, the moving `v0` action tag, and one deduplicated regression issue. Existing files are never replaced without `--force`; use `--action-ref v0.5.6` to pin an immutable release.

The recommended command starts in observe-only mode: regressions and evidence still appear, but the workflow stays green while you learn the app's normal review volume. Remove the generated `fail-on-regression: false` line when the policy fits; omit `--observe-only` only when you intentionally want enforcement from the first run.

## Put app-review regressions in GitHub Actions

```yaml
name: App review regression

on:
  workflow_dispatch:
  schedule:
    - cron: "17 8 * * *"

permissions:
  contents: read
  issues: write

jobs:
  review-health:
    runs-on: ubuntu-latest
    steps:
      - uses: Nike232/app-verbatim-core@v0
        with:
          app-url: https://play.google.com/store/apps/details?id=YOUR.APP.ID
          create-issue: true
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

The action writes a rich job summary, emits machine-readable JSON, fails on configurable thresholds, and creates or updates one deduplicated issue instead of opening alert spam. See every input and output in the [Action reference](docs/GITHUB_ACTION.md).

## Give your coding agent direct access

App Verbatim also runs as a local MCP server. Add this command to any stdio-compatible MCP client:

```json
{
  "mcpServers": {
    "app-verbatim": {
      "command": "npx",
      "args": ["--yes", "github:Nike232/app-verbatim-core", "mcp"]
    }
  }
}
```

Agents receive three read-only tools:

- `check_release_regression` — ask “Did the newest release make reviews worse?”
- `analyze_app_reviews` — inspect themes, version signals, and newly discovered problems with evidence.
- `compare_app_reviews` — find concentrated pain gaps between two public app listings.

The server uses stdio, writes no local state, and requires no model-provider key. See [MCP setup and tool reference](docs/MCP.md).

## What is different

| Capability | What App Verbatim does |
| --- | --- |
| Release regression gate | Evaluates the actual newest version against a sufficiently sampled earlier baseline; under-sampled newest releases remain explicitly inconclusive, positive theme mentions cannot fail a release, and feature demand remains advisory. |
| Evidence, not summaries | Rating drops, low-rating spikes, and theme changes retain representative source reviews. |
| Unknown-problem discovery | Deterministic phrase mining surfaces repeated low-rating language not covered by predefined categories. |
| Reproducible runs | Normalized datasets receive SHA-256 content hashes; the default engine is local and deterministic, and partial upstream pages are rejected before they can change a release conclusion. |
| Developer- and agent-native delivery | CLI, Node.js API, reusable GitHub Action, local MCP server, JSON/Markdown/CSV/standalone HTML, and a connector SDK. |
| Two public ecosystems | Apple App Store and Google Play connectors with retry, timeout, normalization, and live contract tests. |

## Analyze and compare

Clone installation remains available when you want to inspect or modify the source:

```bash
git clone https://github.com/Nike232/app-verbatim-core.git
cd app-verbatim-core
npm ci

# Standalone HTML report
npm run start -- analyze \
  "https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281" \
  --limit 200 --output notion.html

# Evidence-backed competitor comparison
npm run start -- analyze \
  "https://play.google.com/store/apps/details?id=notion.id" \
  --compare "https://play.google.com/store/apps/details?id=com.evernote" \
  --country US --language en --limit 300 --output comparison.html
```

Output format is inferred from `.json`, `.csv`, `.md`, or `.html`. Existing files are never overwritten without `--force`.

## Release policy

Defaults are deliberately visible and configurable:

```text
minimum reviews per version       10
maximum average-rating drop       0.40 stars
maximum low-rating-share increase 15 percentage points
maximum low-rated problem-theme increase 18 percentage points
maximum new-issue share            5 percent
```

Use `app-verbatim check --help` for CLI flags or set the equivalent Action inputs. Insufficient evidence is reported separately and does not fail by default.

## Node.js API

```js
import { analyze, evaluateRegression } from "app-verbatim";

const { report } = await analyze(
  "https://play.google.com/store/apps/details?id=notion.id",
  { country: "US", language: "en", limit: 300 }
);

const check = evaluateRegression(report, { maxRatingDrop: 0.3 });
console.log(check.status, check.violations);
```

Custom review sources implement only `supports()` and `fetch()`. Start with the runnable [connector example](examples/custom-connector.mjs) and [Connector API](docs/CONNECTOR_API.md).

## Verifiable quality

```bash
npm run check
```

That command verifies syntax and public types, runs offline unit/CLI tests, executes the six-language theme benchmark, validates both live-cohort manifests without network access, performs a real MCP stdio handshake and tool call, generates the offline demo, smoke-tests the bundled GitHub Action, and installs the packed npm artifact into a clean consumer project.

The small benchmark is committed at [benchmarks/theme-eval.jsonl](benchmarks/theme-eval.jsonl); its scope and limitations are documented in [benchmarks/README.md](benchmarks/README.md). A separate [20-app real-store cohort](benchmarks/RELEASE_COHORT.md) measures whether the release policy can reach a decision, while the [40-case cross-storefront matrix](benchmarks/STOREFRONT_MATRIX.md) challenges Apple and Google behavior in US English and German storefronts. Both record aggregate-only human adjudication. Live store contracts run separately because upstream stores can rate-limit CI:

```bash
APP_VERBATIM_LIVE_TESTS=1 npm run test:live
```

## Data and platform notice

Bundled connectors read public store data and do not request App Store Connect or Google Play Console credentials. The Apple connector prefers the customer-review RSS feed and falls back to the reviews rendered on Apple's public App Store page when that feed is empty. The fallback currently exposes at most 10 visible reviews and does not include app-version fields, so version regression checks report insufficient evidence instead of guessing. A persistent empty later RSS page is also treated as a partial source, never as a trustworthy pass or fail. Google Play does not provide a general official API for this public research workflow, so both public connectors may require maintenance as store behavior changes. Use conservative limits and confirm that your use complies with platform terms and applicable law.

## Open Core and Pro

This repository is the complete public engine: connectors, normalized models, release checks, evidence, deterministic analysis and discovery, exporters, CLI, GitHub Action, MCP server, extension API, fixtures, benchmarks, and tests.

Hosted scheduling, long-term history, team administration, private owner APIs, managed notifications, and commercial operations belong to the separately developed private Pro product. There is no hidden Pro branch in this repository.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Usage questions belong in [GitHub Discussions](https://github.com/Nike232/app-verbatim-core/discussions); support boundaries are documented in [SUPPORT.md](SUPPORT.md). Report vulnerabilities through the private channel described in [SECURITY.md](SECURITY.md), not a public issue.

GNU AGPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md).
