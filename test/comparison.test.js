import assert from "node:assert/strict";
import test from "node:test";

import { buildComparison, buildReport } from "../src/index.js";

function report(name, appId, reviews) {
  return buildReport({
    app: { id: appId, name, store: "google-play", url: `https://example.com/${appId}` },
    source: { store: "google-play", appId },
    reviews: reviews.map((review, index) => ({
      source: "google-play", appId, reviewId: `${appId}-${index}`, author: "User", country: "US", language: "en",
      createdAt: `2026-08-${String(20 - index).padStart(2, "0")}`, ...review
    }))
  });
}

test("finds competitor pain gaps with direct evidence", () => {
  const primary = report("Primary", "primary", [{ body: "Works well", rating: 5 }, { body: "Please add export", rating: 4 }]);
  const competitor = report("Competitor", "competitor", [
    { body: "Subscription is too expensive", rating: 1 },
    { body: "The pricing and paywall are awful", rating: 1 },
    { body: "Charged after the trial", rating: 2 }
  ]);
  const comparison = buildComparison(primary, competitor);
  assert.ok(comparison.opportunities.some((item) => item.evidence.length > 0));
  assert.equal(comparison.competitor.name, "Competitor");
});
