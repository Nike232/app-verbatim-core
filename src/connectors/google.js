import { createClient, sort } from "@mradex77/google-play-scraper";

import { normalizeReview } from "../analysis.js";
import { defineConnector } from "../connector-registry.js";
import { ConnectorError } from "./errors.js";

export const googlePlayConnector = defineConnector({
  id: "google-play",
  name: "Google Play public reviews",
  version: "1",
  supports: (source) => source?.store === "google-play",
  fetch: fetchGoogleReviews
});

export async function fetchGoogleReviews(source, options = {}) {
  const country = (options.country ?? source.country ?? "US").toLowerCase();
  const language = normalizeLanguage(options.language ?? source.language ?? "en");
  const limit = clamp(options.limit ?? 300, 1, 2_000);
  const client = createClient({ country, lang: language, throttle: clamp(options.throttle ?? 2, 0, 20) });

  try {
    const app = await client.app({ appId: source.appId, requestOptions: { signal: options.signal } });
    const result = await client.reviews({
      appId: source.appId,
      sort: sort.NEWEST,
      num: limit,
      requestOptions: { signal: options.signal }
    });
    return {
      app: {
        id: source.appId,
        name: app.title,
        icon: app.icon ?? null,
        developer: app.developer ?? null,
        url: app.url ?? source.canonicalUrl,
        store: "google-play"
      },
      reviews: result.data.map((review) => normalizeGoogleReview(review, source, { country, language })),
      metadata: {
        connector: googlePlayConnector.id,
        connectorVersion: googlePlayConnector.version,
        country: country.toUpperCase(),
        language,
        hasNextPage: Boolean(result.nextPaginationToken),
        package: "@mradex77/google-play-scraper"
      }
    };
  } catch (error) {
    if (error instanceof ConnectorError) throw error;
    if (error?.name === "NotFoundError") throw new ConnectorError("google-play", "Google Play application not found.", { status: 404, cause: error });
    if (error?.name === "RateLimitError" || error?.name === "BlockedError") {
      throw new ConnectorError("google-play", "Google Play temporarily limited the request. Retry later.", { status: 429, retryable: true, cause: error });
    }
    const aborted = options.signal?.aborted || error?.name === "AbortError" || error?.name === "TimeoutError";
    throw new ConnectorError("google-play", aborted ? "Google Play request was aborted." : `Google Play request failed: ${error instanceof Error ? error.message : String(error)}`, {
      retryable: !aborted,
      cause: error
    });
  }
}

export function normalizeGoogleReview(review, source, { country = "us", language = "en" } = {}) {
  return normalizeReview({
    source: "google-play",
    appId: source.appId,
    reviewId: review.id,
    title: review.title,
    body: review.text,
    rating: review.score,
    language,
    country: country.toUpperCase(),
    appVersion: review.version,
    author: review.userName,
    helpfulCount: review.thumbsUp,
    reply: review.replyText ? { body: review.replyText, createdAt: review.replyDate ?? null } : null,
    sourceUrl: source.canonicalUrl,
    createdAt: review.date,
    updatedAt: review.date
  });
}

function normalizeLanguage(value) {
  return String(value).toLowerCase().split(/[-_]/)[0] || "en";
}

function clamp(value, min, max) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : min;
}
