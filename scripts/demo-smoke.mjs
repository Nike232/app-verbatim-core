import assert from "node:assert/strict";

import { analyzeDataset, createDemoCompetitorDataset, createDemoDataset, exportReport } from "../src/index.js";

const result = analyzeDataset(createDemoDataset(96), {
  source: { store: "demo", appId: "primary" },
  competitorDataset: createDemoCompetitorDataset(84),
  competitorSource: { store: "demo", appId: "competitor" }
});

assert.equal(result.report.schemaVersion, 1);
assert.equal(result.report.sample.total, 96);
assert.ok(result.report.comparison.opportunities.length > 0);
assert.match(exportReport(result.report, "html"), /<!doctype html>/);

console.log("Offline demo smoke test passed.");
