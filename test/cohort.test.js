import assert from "node:assert/strict";
import test from "node:test";

import { expandCohortManifest, summarizeCohort } from "../scripts/lib/cohort.mjs";

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
});

function result(store, storefront, status, complaintReviews, matchedComplaintReviews, { currentMissing = 0 } = {}) {
  return {
    store,
    storefront,
    status,
    currentComplaintThemeCoverage: { complaintReviews, matchedComplaintReviews },
    sourceHealth: { fallbackUsed: false, versionDataAvailable: true },
    sourceEvidence: { ready: true, connector: store, reason: null },
    versionEvidence: {
      current: { version: "2", missingReviews: currentMissing },
      baseline: { version: "1", missingReviews: 0 }
    },
    violations: []
  };
}
