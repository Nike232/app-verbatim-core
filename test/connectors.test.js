import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAppleEntry } from "../src/connectors/apple.js";
import { normalizeGoogleReview } from "../src/connectors/google.js";

test("normalizes an Apple RSS review fixture", () => {
  const review = normalizeAppleEntry({
    id: { label: "12345" },
    title: { label: "Needs work" },
    content: { label: "Crashes after the update" },
    "im:rating": { label: "1" },
    "im:version": { label: "4.8.0" },
    author: { name: { label: "Ada" }, uri: { label: "https://example.com/review" } },
    updated: { label: "2026-08-22T11:20:00-07:00" }
  }, { appId: "123", canonicalUrl: "https://apps.apple.com/app/id123" }, "us");
  assert.deepEqual({ id: review.reviewId, rating: review.rating, version: review.appVersion, country: review.country }, { id: "12345", rating: 1, version: "4.8.0", country: "US" });
});

test("normalizes a Google Play review fixture including developer reply", () => {
  const review = normalizeGoogleReview({
    id: "gp:abc",
    userName: "Grace",
    date: "2026-08-22T11:20:00.000Z",
    score: 2,
    title: null,
    text: "Sync is broken",
    thumbsUp: 9,
    version: "7.2.0",
    replyText: "We are investigating.",
    replyDate: "2026-08-23T10:00:00.000Z"
  }, { appId: "com.example", canonicalUrl: "https://play.google.com/store/apps/details?id=com.example" }, { country: "gb", language: "en" });
  assert.equal(review.country, "GB");
  assert.equal(review.helpfulCount, 9);
  assert.equal(review.reply.body, "We are investigating.");
});
