# App Verbatim Core

[![CI](https://github.com/Nike232/app-verbatim-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Nike232/app-verbatim-core/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0--or--later-1f6f50.svg)](LICENSE)
[![Node.js 22.12+](https://img.shields.io/badge/node-%3E%3D22.12-43853d.svg)](package.json)

Evidence-backed App Store and Google Play review analysis for the command line and Node.js.

App Verbatim turns public app reviews into deterministic themes, version signals, competitor gaps, and recommendations that retain the source reviews behind each claim. It runs locally and does not require an AI key.

> Status: `0.1.x` is the compatibility baseline. Report schema v1 is stable within the `0.1` release line; connector endpoints can change upstream.

[简体中文](README.zh-CN.md) · [Connector API](docs/CONNECTOR_API.md) · [Report schema](docs/REPORT_SCHEMA.md) · [Core/Pro boundary](docs/CORE_PRO_BOUNDARY.md)

## Why it is useful

- Evidence first: every surfaced signal includes representative source reviews.
- Reproducible: counts and themes are deterministic; datasets receive SHA-256 provenance hashes.
- Local by default: no account, database, or model provider is required.
- Extensible: register another review source without changing the analysis engine.
- Scriptable: use the CLI or import the same API from Node.js.

## Quick start

Requires Node.js 22.12 or newer.

```bash
git clone https://github.com/Nike232/app-verbatim-core.git
cd app-verbatim-core
npm ci
npm run start -- demo --compare --output report.html
```

Open `report.html` in a browser. This command is fully offline and uses synthetic reviews.

Analyze a public listing:

```bash
npm run start -- analyze "https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281" --limit 200 --output notion.html

npm run start -- analyze "https://play.google.com/store/apps/details?id=notion.id" \
  --compare "https://play.google.com/store/apps/details?id=com.evernote" \
  --country US --language en --limit 300 --output comparison.json
```

The output format is inferred from `.json`, `.csv`, `.md`, or `.html`. Use `--format` when writing to stdout.

After an npm release, the same CLI is designed to work as:

```bash
npx app-verbatim demo --compare --output report.html
```

The package has not been published to npm yet; clone installation is the supported `0.1.0` path.

## Node.js API

```js
import { analyze } from "app-verbatim";

const { report, datasets } = await analyze(
  "https://play.google.com/store/apps/details?id=notion.id",
  { country: "US", language: "en", limit: 200 }
);

console.log(report.insights);
console.log(report.provenance.datasets[0].contentHash);
console.log(datasets.primary.reviews.length);
```

A custom connector is a small object with `supports()` and `fetch()` functions:

```js
import { analyze, ConnectorRegistry, defineConnector } from "app-verbatim";

const connector = defineConnector({
  id: "example",
  name: "Example source",
  version: "1",
  supports: (source) => source.store === "example",
  async fetch(source) {
    return {
      app: { id: source.appId, name: "Example", store: "example" },
      reviews: [/* normalized review objects */],
      metadata: { connector: "example", connectorVersion: "1" }
    };
  }
});

const registry = new ConnectorRegistry([connector]);
const result = await analyze({ store: "example", appId: "demo" }, { registry });
```

See [`examples/custom-connector.mjs`](examples/custom-connector.mjs) for a runnable example.

## CLI reference

```text
app-verbatim analyze <url> [--compare <url>] [--country US]
  [--language en] [--limit 300] [--format json|csv|md|html]
  [--output report.ext] [--force]

app-verbatim demo [--compare] [--limit 96] [--format ...] [--output ...]
app-verbatim inspect <url>
app-verbatim connectors
app-verbatim doctor
```

An existing output file is never overwritten unless `--force` is present. CSV output guards cells that spreadsheet programs could interpret as formulas.

## Verification

```bash
npm ci
npm run check
```

`npm run check` runs syntax checks, offline unit and CLI tests, an offline demo smoke test, and an npm package-content audit. Live connector contracts run separately because stores can rate-limit CI:

```bash
APP_VERBATIM_LIVE_TESTS=1 npm run test:live
```

## Data and platform notice

The bundled connectors read public store data and do not request App Store Connect or Google Play Console credentials. Google Play does not offer a general official API for this public research workflow, so that connector depends on public page behavior and may require maintenance. Use conservative limits and confirm that your use complies with platform terms and applicable law.

## Scope

This repository is the public, reusable Core: connectors, normalized models, deterministic analysis, evidence, exporters, CLI, extension API, fixtures, and tests. It intentionally excludes hosted scheduling, alerts, team administration, private owner APIs, and commercial operations. Pro is developed in a separate private codebase; no hidden Pro branch will be placed in this repository.

The existing product application is also kept separate while Core stabilizes.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities through the private channel described in [SECURITY.md](SECURITY.md), not a public issue.

## License

GNU AGPL-3.0-or-later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md). The project name and branding are not licensed as trademarks.
