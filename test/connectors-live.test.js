import assert from "node:assert/strict";
import test from "node:test";

import { fetchAppleReviews } from "../src/connectors/apple.js";
import { fetchGoogleReviews } from "../src/connectors/google.js";

const live = process.env.APP_VERBATIM_LIVE_TESTS === "1";

test("Apple public review contract", { skip: !live }, async () => {
  const result = await fetchAppleReviews({
    store: "apple-app-store",
    appId: "1232780281",
    country: "US",
    canonicalUrl: "https://apps.apple.com/us/app/notion-notes-docs-tasks/id1232780281"
  }, { limit: 10, country: "US" });
  assert.equal(result.app.store, "apple-app-store");
  assert.ok(result.reviews.length > 0);
  assert.ok(result.reviews.every((review) => review.reviewId && review.body && review.rating >= 1));
});

test("Google Play public review contract", { skip: !live }, async () => {
  const result = await fetchGoogleReviews({
    store: "google-play",
    appId: "notion.id",
    country: "US",
    language: "en",
    canonicalUrl: "https://play.google.com/store/apps/details?id=notion.id"
  }, { limit: 10, country: "US", language: "en" });
  assert.equal(result.app.store, "google-play");
  assert.ok(result.reviews.length > 0);
  assert.ok(result.reviews.every((review) => review.reviewId && review.body && review.rating >= 1));
});
