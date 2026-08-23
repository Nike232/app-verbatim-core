import assert from "node:assert/strict";
import test from "node:test";

import { buildReport, deduplicateReviews } from "../src/index.js";

const base = {
  source: "google-play",
  appId: "com.example.app",
  language: "en",
  country: "US",
  author: "Tester",
  helpfulCount: 0
};

test("deduplicates reviews and keeps the latest update", () => {
  const reviews = deduplicateReviews([
    { ...base, reviewId: "one", body: "old", rating: 2, createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    { ...base, reviewId: "one", body: "new", rating: 1, createdAt: "2026-01-01", updatedAt: "2026-01-02" }
  ]);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].body, "new");
});

test("builds evidence-backed themes and insights", () => {
  const reviews = [
    { ...base, reviewId: "a", body: "Crashes every time I open settings", rating: 1, appVersion: "2.0", createdAt: "2026-08-20" },
    { ...base, reviewId: "b", body: "The app keeps crashing after the update", rating: 1, appVersion: "2.0", createdAt: "2026-08-19" },
    { ...base, reviewId: "c", body: "Crash on launch, please fix", rating: 2, appVersion: "2.0", createdAt: "2026-08-18" },
    { ...base, reviewId: "d", body: "Please add CSV export", rating: 4, appVersion: "1.9", createdAt: "2026-08-17" }
  ];
  const report = buildReport({
    reviews,
    source: { store: "google-play" },
    app: { id: base.appId, name: "Example", store: "google-play", url: "https://example.com" }
  });
  assert.equal(report.sample.total, 4);
  assert.equal(report.themes[0].id, "stability");
  assert.ok(report.insights.some((item) => item.evidence.length > 0));
  assert.ok(report.versions.some((item) => item.version === "2.0"));
});

test("classifies common non-English review language", async () => {
  const { classifyReview } = await import("../src/index.js");
  const matches = classifyReview({ title: "", body: "アップデート後にクラッシュしてログインできない" });
  assert.ok(matches.some((match) => match.id === "stability"));
  assert.ok(matches.some((match) => match.id === "account"));
});
