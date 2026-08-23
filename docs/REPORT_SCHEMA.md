# Report schema v1

`buildReport()` returns JSON-serializable data with `schemaVersion: 1`. Counts, themes, trends, version aggregates, and evidence selection are deterministic for the same normalized review set.

## Top-level fields

| Field | Description |
| --- | --- |
| `schemaVersion` | Report contract version |
| `generatedAt` | ISO timestamp supplied by the caller or generated at runtime |
| `app` | Application metadata |
| `sample` | Review count, date range, average rating, and negative share |
| `ratings` | One-to-five-star distribution |
| `themes` | Keyword-based theme aggregates with direct evidence |
| `versions` | Per-version review and rating aggregates |
| `insights` | Prioritized findings, recommendations, and evidence |
| `comparison` | Optional primary/competitor gaps and opportunities |
| `methodology` | Analysis rules and caveats |
| `provenance` | Dataset roles, connector versions, review counts, and SHA-256 hashes |

Evidence contains the stable review ID, rating, version, date, excerpt, and source URL when available. A consumer must treat excerpts and application metadata as untrusted text.

## Compatibility policy

- Patch releases may add optional fields or fix incorrect calculations.
- Minor releases may add new themes and optional aggregates.
- Removing or reinterpreting an existing field requires a new schema version.
- Theme labels are presentation strings; integrate against theme IDs.
- No output ordering other than documented ranking should be treated as an identifier.

Type declarations are shipped in `src/index.d.ts`. Runtime consumers should still check `schemaVersion` before persisting or transforming reports.
