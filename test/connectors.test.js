import assert from "node:assert/strict";
import test from "node:test";

import { fetchAppleReviews, normalizeAppleEntry, parseAppleReviewPage } from "../src/connectors/apple.js";
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

test("parses and deduplicates reviews embedded in the App Store public page", () => {
  const review = {
    $kind: "Review",
    id: "web-123",
    title: "Much better",
    contents: "The latest update fixed sync for me.",
    rating: 4,
    reviewerName: "Lin",
    date: "2026-08-29T10:00:00.000Z"
  };
  const html = `<script type="application/json" id="serialized-server-data">${JSON.stringify({ data: [{ items: [review] }, { duplicate: review }] })}</script>`;
  const reviews = parseAppleReviewPage(html, { appId: "123", canonicalUrl: "https://apps.apple.com/us/app/id123" }, "us", 10);
  assert.equal(reviews.length, 1);
  assert.deepEqual(
    { id: reviews[0].reviewId, body: reviews[0].body, rating: reviews[0].rating, author: reviews[0].author, version: reviews[0].appVersion },
    { id: "web-123", body: "The latest update fixed sync for me.", rating: 4, author: "Lin", version: null }
  );
});

test("falls back to the public App Store page when the RSS feed is empty", async () => {
  const review = {
    $kind: "Review",
    id: "web-fallback-123",
    contents: "Reliable again after the update.",
    rating: 5,
    reviewerName: "Mina",
    date: "2026-08-30T10:00:00.000Z"
  };
  let rssRequests = 0;
  const fetch = async (url) => {
    if (url.includes("/lookup?")) {
      return Response.json({ results: [{ trackName: "Example", artistName: "Example Inc." }] });
    }
    if (url.includes("/rss/customerreviews/")) {
      rssRequests += 1;
      return Response.json({ feed: { entry: [] } });
    }
    if (url.includes("apps.apple.com")) {
      return new Response(`<script id="serialized-server-data" type="application/json">${JSON.stringify({ page: { review } })}</script>`, {
        headers: { "content-type": "text/html" }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await fetchAppleReviews({
    store: "apple-app-store",
    appId: "123",
    canonicalUrl: "https://apps.apple.com/us/app/id123"
  }, { country: "US", limit: 10, fetch });

  assert.equal(rssRequests, 3);
  assert.equal(result.reviews.length, 1);
  assert.deepEqual(
    {
      fallbackUsed: result.metadata.fallbackUsed,
      endpoint: result.metadata.publicEndpoint,
      connectorVersion: result.metadata.connectorVersion,
      versionDataAvailable: result.metadata.versionDataAvailable,
      partialResults: result.metadata.partialResults
    },
    {
      fallbackUsed: true,
      endpoint: "App Store public reviews page",
      connectorVersion: "3",
      versionDataAvailable: false,
      partialResults: true
    }
  );
});

test("retries a transient empty Apple RSS page after the first page", async () => {
  const requests = new Map();
  const fetch = async (url) => {
    if (url.includes("/lookup?")) return Response.json({ results: [{ trackName: "Example", artistName: "Example Inc." }] });
    const page = Number(url.match(/page=(\d+)/)?.[1]);
    requests.set(page, (requests.get(page) ?? 0) + 1);
    if (page === 2 && requests.get(page) === 1) return Response.json({ feed: { entry: [] } });
    return Response.json({ feed: { entry: Array.from({ length: 50 }, (_, index) => appleEntry(`${page}-${index}`)) } });
  };

  const result = await fetchAppleReviews({
    store: "apple-app-store",
    appId: "123",
    canonicalUrl: "https://apps.apple.com/us/app/id123"
  }, { country: "US", limit: 100, fetch });

  assert.equal(result.reviews.length, 100);
  assert.equal(result.metadata.pagesFetched, 2);
  assert.equal(result.metadata.paginationComplete, true);
  assert.equal(result.metadata.partialResults, false);
  assert.equal(requests.get(1), 1);
  assert.equal(requests.get(2), 2);
});

test("marks a persistently empty later Apple RSS page as partial", async () => {
  const fetch = async (url) => {
    if (url.includes("/lookup?")) return Response.json({ results: [{ trackName: "Example", artistName: "Example Inc." }] });
    const page = Number(url.match(/page=(\d+)/)?.[1]);
    return Response.json({ feed: { entry: page === 1 ? Array.from({ length: 50 }, (_, index) => appleEntry(`1-${index}`)) : [] } });
  };

  const result = await fetchAppleReviews({
    store: "apple-app-store",
    appId: "123",
    canonicalUrl: "https://apps.apple.com/us/app/id123"
  }, { country: "US", limit: 100, fetch });

  assert.equal(result.reviews.length, 50);
  assert.equal(result.metadata.paginationComplete, false);
  assert.equal(result.metadata.paginationStopReason, "empty-page");
  assert.equal(result.metadata.partialResults, true);
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

function appleEntry(id) {
  return {
    id: { label: id },
    title: { label: "Review" },
    content: { label: `Review ${id}` },
    "im:rating": { label: "4" },
    "im:version": { label: "2.0.0" },
    author: { name: { label: "Tester" } },
    updated: { label: "2026-08-30T10:00:00.000Z" }
  };
}
