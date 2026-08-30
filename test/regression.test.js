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
  assert.equal(result.versionEvidence.ready, true);
  assert.equal(result.versionEvidence.current.missingReviews, 0);
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
  assert.equal(result.versionEvidence.ready, false);
  assert.ok(result.versionEvidence.current.missingReviews > 0);
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
  assert.deepEqual(result.versionEvidence, {
    ready: false,
    requiredPerVersion: 10,
    current: { version: "3.0.0", count: 4, missingReviews: 6 },
    baseline: { version: "2.0.0", count: 30, missingReviews: 0 }
  });
  assert.match(result.summary, /Newest version 3\.0\.0 has 4 reviews/);
});

test("reports the closest under-sampled baseline in structured evidence", () => {
  const result = evaluateRegression({
    app: { id: "example", name: "Example", store: "google-play" },
    source: { store: "google-play", appId: "example" },
    generatedAt: "2026-08-30T00:00:00.000Z",
    versions: [
      { version: "3.0.0", count: 20, averageRating: 4, negativeShare: 0.1 },
      { version: "2.0.0", count: 1, averageRating: 1, negativeShare: 1 }
    ],
    discoveredIssues: []
  });

  assert.equal(result.status, "insufficient-data");
  assert.equal(result.baselineVersion, null);
  assert.deepEqual(result.versionEvidence.baseline, { version: "2.0.0", count: 1, missingReviews: 9 });
  assert.match(result.summary, /Earlier version 2\.0\.0 has 1 review;/);
});

test("refuses a release decision from a partial public review sample", () => {
  const report = themeReport({
    intent: "problem",
    count: 0,
    share: 0,
    complaintCount: 0,
    complaintShare: 0,
    complaintEvidence: []
  });
  report.provenance = {
    datasets: [{
      role: "primary",
      connector: "apple-app-store",
      metadata: { connector: "apple-app-store", partialResults: true, paginationStopReason: "empty-page" }
    }]
  };

  const result = evaluateRegression(report, quietPolicy());

  assert.equal(result.status, "insufficient-data");
  assert.equal(result.versionEvidence.ready, true);
  assert.deepEqual(result.sourceEvidence, { ready: false, connector: "apple-app-store", reason: "empty-page" });
  assert.match(result.summary, /partial sample/);
});

test("does not treat positive theme mentions as release complaints", () => {
  const result = evaluateRegression(themeReport({
    intent: "problem",
    count: 10,
    share: 1,
    complaintCount: 0,
    complaintShare: 0,
    evidence: [{ rating: 5, excerpt: "Sync is excellent." }],
    complaintEvidence: []
  }), quietPolicy());

  assert.equal(result.status, "pass");
  assert.equal(result.metrics.themeChanges[0].count, 0);
});

test("keeps feature demand visible without blocking a release", () => {
  const result = evaluateRegression(themeReport({
    intent: "request",
    count: 4,
    share: 0.4,
    complaintCount: 4,
    complaintShare: 0.4,
    complaintEvidence: [{ rating: 2, excerpt: "Please add offline mode." }]
  }), quietPolicy());

  assert.equal(result.status, "pass");
  assert.equal(result.metrics.themeChanges[0].intent, "request");
});

test("surfaces release-link strength as a diagnostic without weakening the gate", () => {
  const report = themeReport({
    intent: "problem",
    count: 0,
    share: 0,
    complaintCount: 0,
    complaintShare: 0,
    complaintEvidence: []
  });
  report.versions[0].averageRating = 3;
  report.versions[0].negativeShare = 0.5;
  report.versions[0].releaseLinkEvidence = {
    level: "limited",
    lowRatingReviewCount: 5,
    explicitCount: 0,
    changeCount: 1,
    linkedCount: 1,
    linkedShare: 0.2,
    evidence: []
  };

  const result = evaluateRegression(report);

  assert.equal(result.status, "fail");
  assert.equal(result.releaseLinkEvidence.available, true);
  assert.equal(result.releaseLinkEvidence.level, "limited");
  assert.match(regressionToMarkdown(result), /Release-link evidence:\*\* LIMITED/);
  assert.match(regressionToMarkdown(result), /correlation, not proof/);
});

test("marks release-link diagnostics unavailable for older report producers", () => {
  const result = evaluateRegression(themeReport({
    intent: "problem",
    count: 0,
    share: 0,
    complaintCount: 0,
    complaintShare: 0,
    complaintEvidence: []
  }), quietPolicy());

  assert.equal(result.releaseLinkEvidence.available, false);
  assert.equal(result.releaseLinkEvidence.level, "unknown");
});

test("fails on a concentrated low-rated problem theme with complaint-only evidence", () => {
  const evidence = [
    { rating: 1, excerpt: "Crashes on launch." },
    { rating: 2, excerpt: "Still crashes." },
    { rating: 3, excerpt: "Crash needs fixing." }
  ];
  const result = evaluateRegression(themeReport({
    intent: "problem",
    count: 5,
    share: 0.5,
    complaintCount: 3,
    complaintShare: 0.3,
    complaintEvidence: evidence
  }), quietPolicy());

  assert.equal(result.status, "fail");
  assert.equal(result.violations[0].id, "theme-stability");
  assert.deepEqual(result.violations[0].evidence, evidence);
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

function themeReport(currentTheme) {
  return {
    app: { id: "example", name: "Example", store: "google-play" },
    source: { store: "google-play", appId: "example" },
    generatedAt: "2026-08-30T00:00:00.000Z",
    versions: [
      { version: "2.0.0", count: 10, averageRating: 4.5, negativeShare: 0.1, themeSignals: [{ id: "stability", label: "Stability and crashes", ...currentTheme }] },
      { version: "1.0.0", count: 10, averageRating: 4.5, negativeShare: 0.1, themeSignals: [] }
    ],
    discoveredIssues: []
  };
}

function quietPolicy() {
  return {
    maxRatingDrop: 4,
    maxNegativeShareIncrease: 1,
    maxThemeShareIncrease: 0.18,
    maxDiscoveredIssueShare: 1,
    minThemeReviews: 3
  };
}
