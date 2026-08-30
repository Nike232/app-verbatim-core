import assert from "node:assert/strict";
import test from "node:test";

import { buildCohortResult, expandCohortManifest, summarizeCohort } from "../scripts/lib/cohort.mjs";

test("expands paired apps across stores and storefronts", () => {
  const cases = expandCohortManifest({
    schemaVersion: 1,
    minimumApps: 1,
    expectedCases: 4,
    limit: 300,
    storefronts: [
      { slug: "us-en", country: "US", language: "en" },
      { slug: "de-de", country: "DE", language: "de" }
    ],
    apps: [{
      slug: "notion",
      name: "Notion",
      category: "productivity",
      sources: [
        { store: "google-play", url: "https://play.google.com/store/apps/details?id=notion.id" },
        { store: "apple-app-store", url: "https://apps.apple.com/app/id1232780281" }
      ]
    }]
  });

  assert.equal(cases.length, 4);
  assert.deepEqual(new Set(cases.map((item) => item.store)), new Set(["google-play", "apple-app-store"]));
  assert.deepEqual(new Set(cases.map((item) => item.storefront)), new Set(["us-en", "de-de"]));
  assert.equal(cases[0].appSlug, "notion");
});

test("rejects a matrix source whose declared store does not match its URL", () => {
  assert.throws(() => expandCohortManifest({
    schemaVersion: 1,
    limit: 300,
    storefronts: [
      { slug: "us-en", country: "US", language: "en" },
      { slug: "de-de", country: "DE", language: "de" }
    ],
    apps: [{
      slug: "notion",
      name: "Notion",
      category: "productivity",
      sources: [
        { store: "apple-app-store", url: "https://play.google.com/store/apps/details?id=notion.id" },
        { store: "google-play", url: "https://apps.apple.com/app/id1232780281" }
      ]
    }]
  }), /does not match/);
});

test("summarizes decision and theme coverage by store and storefront", () => {
  const results = [
    result("google-play", "us-en", "pass", 4, 3),
    result("google-play", "de-de", "insufficient-data", 2, 1, { currentMissing: 5 }),
    result("apple-app-store", "us-en", "fail", 6, 2),
    { ...result("apple-app-store", "de-de", "error", 0, 0), sourceHealth: undefined }
  ];
  const summary = summarizeCohort(results);

  assert.equal(summary.total, 4);
  assert.equal(summary.completed, 3);
  assert.equal(summary.decidable, 2);
  assert.equal(summary.byStore["google-play"].decidableRate, 0.5);
  assert.equal(summary.byStorefront["us-en"].decidableRate, 1);
  assert.deepEqual(summary.currentComplaintThemeCoverage, { complaintReviews: 12, matchedComplaintReviews: 6, rate: 0.5 });
  assert.equal(summary.insufficientReasons.current, 1);
  assert.equal(summary.insufficientReasons.source, 0);
  assert.deepEqual(summary.releaseLinkEvidenceLevels, { supported: 0, limited: 0, none: 0, unknown: 3 });
  assert.deepEqual(summary.reviewScopeCounts, { software: 12, "product-policy": 0, community: 0, support: 0, unclear: 0 });
  assert.deepEqual(summary.triageDecisions, { "software-regression": 0, "manual-review": 1, observe: 2 });
});

test("keeps release-link review text out of aggregate cohort reports", () => {
  const output = buildCohortResult({
    slug: "example-google-play-us-en",
    appSlug: "example",
    name: "Example",
    category: "test",
    store: "google-play",
    storefront: "us-en",
    country: "US",
    language: "en",
    url: "https://play.google.com/store/apps/details?id=com.example"
  }, {
    report: {
      app: { id: "com.example", name: "Example", store: "google-play" },
      source: { store: "google-play", appId: "com.example" },
      generatedAt: "2026-08-31T00:00:00.000Z",
      sample: { total: 20 },
      versions: [
        {
          version: "2",
          count: 10,
          averageRating: 4,
          negativeShare: 0.1,
          themeSignals: [],
          releaseLinkEvidence: releaseLink("secret review text"),
          actionabilityEvidence: actionability("secret scope text", "secret symptom label")
        },
        { version: "1", count: 10, averageRating: 4, negativeShare: 0.1, themeSignals: [], releaseLinkEvidence: releaseLink("older text") }
      ],
      discoveredIssues: []
    },
    datasets: { primary: { reviews: [] } }
  });

  assert.equal(output.releaseLinkEvidence.level, "limited");
  assert.equal("evidence" in output.releaseLinkEvidence, false);
  assert.equal(output.actionabilityEvidence.actionableIssues[0].id, "software-stability");
  assert.equal("evidence" in output.actionabilityEvidence, false);
  assert.equal("label" in output.actionabilityEvidence.actionableIssues[0], false);
  assert.doesNotMatch(JSON.stringify(output), /secret review text/);
  assert.doesNotMatch(JSON.stringify(output), /secret scope text|secret symptom label/);
});

function result(store, storefront, status, complaintReviews, matchedComplaintReviews, { currentMissing = 0 } = {}) {
  return {
    store,
    storefront,
    status,
    currentComplaintThemeCoverage: { complaintReviews, matchedComplaintReviews },
    sourceHealth: { fallbackUsed: false, versionDataAvailable: true },
    sourceEvidence: { ready: true, connector: store, reason: null },
    releaseLinkEvidence: { available: false, level: "unknown" },
    actionabilityEvidence: {
      available: true,
      counts: { software: complaintReviews, "product-policy": 0, community: 0, support: 0, unclear: 0 }
    },
    triage: { decision: status === "fail" ? "manual-review" : "observe", blocking: status === "fail", issues: [] },
    versionEvidence: {
      current: { version: "2", missingReviews: currentMissing },
      baseline: { version: "1", missingReviews: 0 }
    },
    violations: []
  };
}

function releaseLink(excerpt) {
  return {
    level: "limited",
    lowRatingReviewCount: 2,
    explicitCount: 0,
    changeCount: 1,
    linkedCount: 1,
    linkedShare: 0.5,
    evidence: [{ excerpt }]
  };
}

function actionability(excerpt, label) {
  return {
    lowRatingReviewCount: 2,
    counts: { software: 2, "product-policy": 0, community: 0, support: 0, unclear: 0 },
    shares: { software: 1, "product-policy": 0, community: 0, support: 0, unclear: 0 },
    softwareCount: 2,
    softwareShare: 1,
    releaseLinkedSoftwareCount: 2,
    explicitReleaseSoftwareCount: 1,
    actionableIssues: [{
      id: "software-stability",
      kind: "known-theme",
      label,
      count: 2,
      share: 1,
      releaseLinkedCount: 2,
      explicitReleaseCount: 1,
      supported: true,
      evidence: [{ excerpt }]
    }],
    evidence: { software: [{ excerpt }], "product-policy": [], community: [], support: [], unclear: [] }
  };
}
