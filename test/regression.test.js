import assert from "node:assert/strict";
import test from "node:test";

import { analyzeDataset, createDemoDataset, evaluateRegression, regressionToMarkdown } from "../src/index.js";

test("fails a release check when the newest version regresses", () => {
  const { report } = analyzeDataset(createDemoDataset(96), {
    source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" },
    generatedAt: "2026-08-24T00:00:00.000Z"
  });
  const result = evaluateRegression(report);
  assert.equal(result.status, "fail");
  assert.equal(result.currentVersion, "4.8.0");
  assert.equal(result.baselineVersion, "4.7.2");
  assert.ok(result.violations.some((item) => item.id === "rating-drop"));
  assert.ok(result.violations.some((item) => item.id.startsWith("discovered-")));
  assert.ok(result.violations.every((item) => item.evidence.length > 0));
  assert.match(regressionToMarkdown(result), /Regression signals/);
});

test("passes when the release is within a relaxed policy", () => {
  const { report } = analyzeDataset(createDemoDataset(96), {
    source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" }
  });
  const result = evaluateRegression(report, {
    maxRatingDrop: 4,
    maxNegativeShareIncrease: 1,
    maxThemeShareIncrease: 1,
    maxDiscoveredIssueShare: 1
  });
  assert.equal(result.status, "pass");
  assert.equal(result.violations.length, 0);
});

test("reports insufficient version evidence without guessing", () => {
  const { report } = analyzeDataset(createDemoDataset(4), {
    source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" }
  });
  const result = evaluateRegression(report);
  assert.equal(result.status, "insufficient-data");
  assert.equal(result.metrics, null);
});

test("does not skip an under-sampled newest release to compare older versions", () => {
  const result = evaluateRegression({
    app: { id: "example", name: "Example", store: "google-play" },
    source: { store: "google-play", appId: "example" },
    generatedAt: "2026-08-30T00:00:00.000Z",
    versions: [
      { version: "3.0.0", count: 4, averageRating: 1, negativeShare: 1 },
      { version: "2.0.0", count: 30, averageRating: 2, negativeShare: 0.8 },
      { version: "1.0.0", count: 30, averageRating: 5, negativeShare: 0 }
    ],
    discoveredIssues: []
  });

  assert.equal(result.status, "insufficient-data");
  assert.equal(result.currentVersion, "3.0.0");
  assert.equal(result.baselineVersion, null);
  assert.match(result.summary, /Newest version 3\.0\.0 has 4 reviews/);
});

test("neutralizes mentions and HTML from untrusted review text", () => {
  const markdown = regressionToMarkdown({
    status: "fail",
    app: { name: "<Unsafe>", id: "one", store: "demo" },
    summary: "Found @team",
    currentVersion: "2",
    baselineVersion: "1",
    policy: { maxRatingDrop: 0.4, maxNegativeShareIncrease: 0.15 },
    metrics: {
      current: { averageRating: 1, negativeShare: 1 },
      baseline: { averageRating: 5, negativeShare: 0 },
      ratingDrop: 4,
      negativeShareIncrease: 1
    },
    violations: [{ severity: "high", title: "Bad", message: "<b>@team</b>", evidence: [] }]
  });
  assert.doesNotMatch(markdown, /<Unsafe>|@team/);
  assert.match(markdown, /&lt;Unsafe&gt;/);
});
