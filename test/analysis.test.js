import assert from "node:assert/strict";
import test from "node:test";

import { buildReport, classifyReleaseLink, classifyReviewScope, deduplicateReviews } from "../src/index.js";

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
  const currentStability = report.versions.find((item) => item.version === "2.0").themeSignals.find((item) => item.id === "stability");
  const previousRequest = report.versions.find((item) => item.version === "1.9").themeSignals.find((item) => item.id === "feature-request");
  assert.equal(currentStability.intent, "problem");
  assert.equal(currentStability.complaintCount, 3);
  assert.equal(currentStability.complaintShare, 1);
  assert.equal(currentStability.requestOverlapCount, 0);
  assert.ok(currentStability.complaintEvidence.every((item) => item.rating <= 3));
  assert.equal(previousRequest.complaintCount, 0);
});

test("keeps explicit requests out of overlapping problem-theme gates", () => {
  const report = buildReport({
    reviews: [
      {
        ...base,
        reviewId: "request",
        body: "Bitte ergänzen Sie einen Offline-Modus.",
        rating: 2,
        appVersion: "2.0",
        language: "de",
        country: "DE",
        createdAt: "2026-08-20"
      },
      {
        ...base,
        reviewId: "mixed",
        body: "The app crashes every time. Would love better filters too.",
        rating: 1,
        appVersion: "2.0",
        createdAt: "2026-08-19"
      }
    ],
    source: { store: "google-play" },
    app: { id: base.appId, name: "Example", store: "google-play", url: "https://example.com" }
  });
  const signals = new Map(report.versions[0].themeSignals.map((item) => [item.id, item]));
  const themes = new Map(report.themes.map((item) => [item.id, item]));
  assert.equal(signals.get("sync").complaintCount, 0);
  assert.equal(signals.get("sync").requestOverlapCount, 1);
  assert.equal(signals.get("stability").complaintCount, 1);
  assert.equal(signals.get("stability").requestOverlapCount, 0);
  assert.equal(signals.get("feature-request").complaintCount, 2);
  assert.equal(themes.get("sync").complaintCount, 0);
  assert.equal(themes.get("sync").requestOverlapCount, 1);
  assert.equal(themes.get("stability").complaintCount, 1);
  assert.ok(themes.get("stability").complaintEvidence.every((item) => item.reviewId === "mixed"));
});

test("classifies common non-English review language", async () => {
  const { classifyReview } = await import("../src/index.js");
  const matches = classifyReview({ title: "", body: "アップデート後にクラッシュしてログインできない" });
  assert.ok(matches.some((match) => match.id === "stability"));
  assert.ok(matches.some((match) => match.id === "account"));
});

test("classifies German complaint language without broad substring matches", async () => {
  const { classifyReview } = await import("../src/index.js");
  const complaint = classifyReview({
    title: "",
    body: "Seit dem Update hängt sich die App auf, die Anmeldung funktioniert nicht und Benachrichtigungen kommen nicht an."
  });
  assert.deepEqual(new Set(complaint.map((match) => match.id)), new Set(["stability", "account", "notifications"]));
  assert.equal(classifyReview({ title: "", body: "Die Gestaltung ist klar und angenehm." }).length, 0);
});

test("matches common inflections without substring false positives", async () => {
  const { classifyReview } = await import("../src/index.js");
  assert.ok(classifyReview({ title: "", body: "It crashes and freezes while syncing." }).some((match) => match.id === "stability"));
  assert.ok(classifyReview({ title: "", body: "It crashes and freezes while syncing." }).some((match) => match.id === "sync"));
  assert.equal(classifyReview({ title: "", body: "A carefully built writing tool." }).length, 0);
});

test("orders numeric versions instead of treating a late old-version review as current", () => {
  const reviews = [
    { ...base, reviewId: "new", body: "Works", rating: 5, appVersion: "2.1.0", createdAt: "2026-08-18" },
    { ...base, reviewId: "old", body: "Still installed", rating: 3, appVersion: "1.9.9", createdAt: "2026-08-22" }
  ];
  const report = buildReport({
    reviews,
    source: { store: "google-play" },
    app: { id: base.appId, name: "Example", store: "google-play", url: "https://example.com" }
  });
  assert.deepEqual(report.versions.map((item) => item.version), ["2.1.0", "1.9.9"]);
});

test("separates explicit release links from broader temporal changes", () => {
  assert.equal(classifyReleaseLink({ body: "The app crashes after the latest update." }).kind, "explicit");
  assert.equal(classifyReleaseLink({ body: "Since 4.8.0 the app crashes every time." }).kind, "explicit");
  assert.equal(classifyReleaseLink({ body: "I can no longer sign in." }).kind, "change");
  assert.equal(classifyReleaseLink({ body: "The mobile version is slow." }).kind, "none");
  assert.equal(classifyReleaseLink({ body: "Please update my payment method." }).kind, "none");
});

test("reports release-link coverage without excluding unlinked low ratings", () => {
  const report = buildReport({
    reviews: [
      { ...base, reviewId: "explicit", body: "Crashes after the latest update.", rating: 1, appVersion: "2.0", createdAt: "2026-08-20" },
      { ...base, reviewId: "change", body: "I can no longer sign in.", rating: 2, appVersion: "2.0", createdAt: "2026-08-19" },
      { ...base, reviewId: "unlinked", body: "Terrible experience.", rating: 1, appVersion: "2.0", createdAt: "2026-08-18" },
      { ...base, reviewId: "positive", body: "Works well after the latest update.", rating: 5, appVersion: "2.0", createdAt: "2026-08-17" }
    ],
    source: { store: "google-play" },
    app: { id: base.appId, name: "Example", store: "google-play", url: "https://example.com" }
  });

  assert.equal(report.versions[0].count, 4);
  assert.deepEqual(report.versions[0].releaseLinkEvidence, {
    level: "supported",
    lowRatingReviewCount: 3,
    explicitCount: 1,
    changeCount: 1,
    linkedCount: 2,
    linkedShare: 0.667,
    evidence: report.versions[0].releaseLinkEvidence.evidence
  });
  assert.deepEqual(report.versions[0].releaseLinkEvidence.evidence.map((item) => item.releaseLink.kind), ["explicit", "change"]);
});

test("separates software failures from policy, community, support, and unclear feedback", () => {
  assert.equal(classifyReviewScope({ body: "The app crashes whenever I sign in." }).primary, "software");
  assert.equal(classifyReviewScope({ body: "The subscription price is unfair and the new layout is confusing." }).primary, "product-policy");
  assert.equal(classifyReviewScope({ body: "The service is full of scammers and fake profiles." }).primary, "community");
  assert.equal(classifyReviewScope({ body: "Customer support never responded to my ticket." }).primary, "support");
  assert.equal(classifyReviewScope({ body: "Bad." }).primary, "unclear");
  assert.equal(classifyReviewScope({ body: "The app freezes after login and customer support never responds." }).primary, "software");
  assert.equal(classifyReviewScope({ body: "People use fake accounts and the moderators ignore reports." }).primary, "community");
});

test("groups repeated version-linked software symptoms without hiding other low ratings", () => {
  const report = buildReport({
    reviews: [
      { ...base, reviewId: "software-a", body: "The app crashes after the latest update.", rating: 1, appVersion: "2.0", createdAt: "2026-08-20" },
      { ...base, reviewId: "software-b", body: "Since the update it crashes whenever I open settings.", rating: 2, appVersion: "2.0", createdAt: "2026-08-19" },
      { ...base, reviewId: "community", body: "The service is full of scammers and fake profiles.", rating: 1, appVersion: "2.0", createdAt: "2026-08-18" },
      { ...base, reviewId: "policy", body: "The subscription is too expensive.", rating: 2, appVersion: "2.0", createdAt: "2026-08-17" },
      { ...base, reviewId: "support", body: "Customer support never responded to my ticket.", rating: 1, appVersion: "2.0", createdAt: "2026-08-16" },
      { ...base, reviewId: "unclear", body: "Bad.", rating: 1, appVersion: "2.0", createdAt: "2026-08-15" }
    ],
    source: { store: "google-play" },
    app: { id: base.appId, name: "Example", store: "google-play", url: "https://example.com" }
  });
  const actionability = report.versions[0].actionabilityEvidence;

  assert.deepEqual(actionability.counts, { software: 2, "product-policy": 1, community: 1, support: 1, unclear: 1 });
  assert.equal(actionability.softwareShare, 0.333);
  assert.equal(actionability.releaseLinkedSoftwareCount, 2);
  assert.equal(actionability.explicitReleaseSoftwareCount, 2);
  assert.equal(actionability.actionableIssues[0].id, "software-stability");
  assert.equal(actionability.actionableIssues[0].supported, true);
});
