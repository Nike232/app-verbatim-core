# Core and Pro boundary

## Public Core

Core is useful on its own and contains the quality-critical path:

- public-store connectors and normalized review model;
- deterministic deduplication, aggregation, themes, unknown-issue discovery, trends, versions, and competitor comparison;
- evidence citations and provenance hashes;
- release-regression policy engine, CLI, Node.js API, and reusable GitHub Action;
- JSON, CSV, Markdown, and standalone HTML exporters;
- connector extension API, transparent benchmarks, fixtures, tests, and compatibility policy.

Core must never intentionally return weaker evidence or incorrect counts to create a paywall.

## Private Pro

Pro may build operational capabilities around Core:

- scheduled collection, durable history, and backfills;
- retries, proxy pools, quotas, and source-health operations;
- alerts, digests, workspaces, roles, audit events, and integrations;
- official owner APIs and private enterprise connectors;
- managed deployment, support, SLA, and commercial controls.

Pro lives in a separate private repository. It is not a hidden branch, encrypted archive, git submodule, or ignored directory inside Core. Core must not contain Pro credentials, customer data, private fixtures, deployment addresses, or generated Pro bundles.

## Existing product

The current product application is developed separately and is not modified as part of Core stabilization. Core changes may be integrated later through a versioned package boundary after Core passes its compatibility gates.
