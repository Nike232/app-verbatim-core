import assert from "node:assert/strict";
import test from "node:test";

import { buildReport, discoverIssues } from "../src/index.js";

const base = {
  source: "google-play",
  appId: "com.example.camera",
  language: "en",
  country: "US",
  author: "Tester",
  helpfulCount: 0,
  appVersion: "3.0"
};

test("discovers repeated low-rating language outside the fixed taxonomy", () => {
  const reviews = [
    review("a", "Camera uploads rotate every portrait photo sideways after saving.", 1),
    review("b", "Every camera upload rotates my portrait photo sideways.", 2),
    review("c", "A saved portrait photo is sideways after camera upload.", 2),
    review("d", "Enjoying the new colors.", 5)
  ];
  const issues = discoverIssues(reviews, { totalReviews: reviews.length });
  assert.ok(issues.length > 0);
  assert.ok(issues.some((issue) => /camera|portrait|sideways|upload/i.test(issue.label)));
  assert.ok(issues.every((issue) => issue.evidence.length >= 2));
});

test("adds discovered issues to an evidence report", () => {
  const reviews = [
    review("a", "Camera uploads rotate every portrait photo sideways after saving.", 1),
    review("b", "Every camera upload rotates my portrait photo sideways.", 2),
    review("c", "A saved portrait photo is sideways after camera upload.", 2)
  ];
  const report = buildReport({
    reviews,
    source: { store: "google-play", appId: base.appId },
    app: { id: base.appId, name: "Camera", store: "google-play", url: "https://example.com" }
  });
  assert.ok(report.discoveredIssues.length > 0);
  assert.equal(report.methodology.discovery, "deterministic-phrase-mining-v1");
});

function review(reviewId, body, rating) {
  return { ...base, reviewId, body, rating, createdAt: `2026-08-${20 - reviewId.charCodeAt(0) + 97}T00:00:00Z` };
}
