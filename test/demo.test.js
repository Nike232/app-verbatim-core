import assert from "node:assert/strict";
import test from "node:test";

import { analyzeDataset, createDemoCompetitorDataset, createDemoDataset } from "../src/index.js";

test("builds an offline comparison with provenance", () => {
  const result = analyzeDataset(createDemoDataset(48), {
    source: { store: "demo", appId: "primary" },
    competitorDataset: createDemoCompetitorDataset(42),
    competitorSource: { store: "demo", appId: "competitor" },
    generatedAt: "2026-08-24T00:00:00.000Z"
  });
  assert.equal(result.report.sample.total, 48);
  assert.equal(result.report.provenance.datasets.length, 2);
  assert.ok(result.report.comparison.opportunities.length > 0);
});

test("produces stable content hashes for the same dataset", () => {
  const dataset = createDemoDataset(12);
  const first = analyzeDataset(dataset, { source: { store: "demo", appId: "primary" }, generatedAt: "2026-08-24T00:00:00.000Z" });
  const second = analyzeDataset(dataset, { source: { store: "demo", appId: "primary" }, generatedAt: "2026-08-25T00:00:00.000Z" });
  assert.equal(first.report.provenance.datasets[0].contentHash, second.report.provenance.datasets[0].contentHash);
});
