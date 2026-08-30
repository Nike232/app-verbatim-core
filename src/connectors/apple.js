import { normalizeReview } from "../analysis.js";
import { defineConnector } from "../connector-registry.js";
import { VERSION } from "../version.js";
import { ConnectorError } from "./errors.js";

const MAX_RSS_PAGES = 10;
const PAGE_SIZE = 50;
const APP_STORE_PAGE_REVIEW_LIMIT = 10;
const EMPTY_PAGE_ATTEMPTS = 3;
const USER_AGENT = `AppVerbatim/${VERSION} (+https://github.com/Nike232/app-verbatim-core)`;

export const appleConnector = defineConnector({
  id: "apple-app-store",
  name: "Apple App Store public reviews",
  version: "3",
  supports: (source) => source?.store === "apple-app-store",
  fetch: fetchAppleReviews
});

export async function fetchAppleReviews(source, options = {}) {
  const country = (options.country ?? source.country ?? "US").toLowerCase();
  const limit = clamp(options.limit ?? 300, 1, MAX_RSS_PAGES * PAGE_SIZE);
  const app = await fetchApp(source.appId, country, options);
  const reviews = [];
  let pagesFetched = 0;
  let publicEndpoint = "iTunes Customer Reviews RSS";
  let fallbackUsed = false;
  let paginationComplete = false;
  let paginationStopReason = null;

  for (let page = 1; page <= Math.min(MAX_RSS_PAGES, Math.ceil(limit / PAGE_SIZE)); page += 1) {
    const url = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${source.appId}/sortby=mostrecent/json`;
    const entries = await fetchReviewEntries(url, options, EMPTY_PAGE_ATTEMPTS);
    if (!entries.length) {
      paginationStopReason = reviews.length ? "empty-page" : "empty-feed";
      break;
    }
    pagesFetched += 1;
    for (const entry of entries) {
      if (!entry["im:rating"]?.label || !entry.content?.label) continue;
      reviews.push(normalizeAppleEntry(entry, source, country));
      if (reviews.length >= limit) break;
    }
    if (reviews.length >= limit) {
      paginationComplete = true;
      paginationStopReason = "requested-limit";
      break;
    }
    if (entries.length < PAGE_SIZE) {
      paginationComplete = true;
      paginationStopReason = "end-of-feed";
      break;
    }
  }

  if (!reviews.length) {
    reviews.push(...await fetchAppleReviewPage(source, country, { ...options, limit }));
    pagesFetched = 1;
    publicEndpoint = "App Store public reviews page";
    fallbackUsed = true;
    paginationStopReason = "public-page-fallback";
  }

  return {
    app: {
      id: source.appId,
      name: app.trackName ?? `App ${source.appId}`,
      icon: app.artworkUrl100 ?? null,
      developer: app.artistName ?? null,
      url: app.trackViewUrl ?? source.canonicalUrl,
      store: "apple-app-store"
    },
    reviews,
    metadata: {
      connector: appleConnector.id,
      connectorVersion: appleConnector.version,
      country: country.toUpperCase(),
      pagesFetched,
      publicEndpoint,
      fallbackUsed,
      paginationComplete,
      paginationStopReason,
      partialResults: fallbackUsed || !paginationComplete,
      requestedLimit: limit,
      returnedReviews: reviews.length,
      versionDataAvailable: reviews.some((review) => Boolean(review.appVersion))
    }
  };
}

async function fetchReviewEntries(url, options, attempts) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchWithRetry(url, options);
    if (response.status === 404) return [];
    if (!response.ok) throw httpError("apple-app-store", "Apple review feed", response);
    const payload = await parseJson(response, "Apple review feed");
    const entries = Array.isArray(payload.feed?.entry) ? payload.feed.entry : [];
    if (entries.length || attempt === attempts) return entries;
    await delay(300 * attempt, options.signal);
  }
  return [];
}

export function normalizeAppleEntry(entry, source, country = "us") {
  return normalizeReview({
    source: "apple-app-store",
    appId: source.appId,
    reviewId: entry.id?.label,
    title: entry.title?.label,
    body: entry.content?.label,
    rating: entry["im:rating"]?.label,
    appVersion: entry["im:version"]?.label,
    author: entry.author?.name?.label,
    country: country.toUpperCase(),
    sourceUrl: source.canonicalUrl,
    createdAt: entry.updated?.label,
    updatedAt: entry.updated?.label
  });
}

export function normalizeApplePageReview(entry, source, country = "us", sourceUrl = source.canonicalUrl) {
  return normalizeReview({
    source: "apple-app-store",
    appId: source.appId,
    reviewId: entry.id,
    title: entry.title,
    body: entry.contents,
    rating: entry.rating,
    author: entry.reviewerName,
    country: country.toUpperCase(),
    sourceUrl,
    createdAt: entry.date,
    updatedAt: entry.date
  });
}

export function parseAppleReviewPage(html, source, country = "us", limit = APP_STORE_PAGE_REVIEW_LIMIT) {
  const match = String(html).match(/<script[^>]*\bid=(?:"|')?serialized-server-data(?:"|')?[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];

  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch (error) {
    throw new ConnectorError("apple-app-store", "Apple public reviews page returned invalid embedded data.", { cause: error, retryable: true });
  }

  const pageUrl = appleReviewPageUrl(source.appId, country);
  const reviews = [];
  const reviewIds = new Set();
  const queue = [payload];
  for (let cursor = 0; cursor < queue.length && reviews.length < limit; cursor += 1) {
    const value = queue[cursor];
    if (!value || typeof value !== "object") continue;
    if (value.$kind === "Review") {
      const id = String(value.id ?? "").trim();
      const rating = Number(value.rating);
      const body = String(value.contents ?? "").trim();
      if (id && body && rating >= 1 && rating <= 5 && !reviewIds.has(id)) {
        reviewIds.add(id);
        reviews.push(normalizeApplePageReview(value, source, country, pageUrl));
      }
    }
    queue.push(...(Array.isArray(value) ? value : Object.values(value)));
  }
  return reviews;
}

async function fetchAppleReviewPage(source, country, options) {
  const response = await fetchWithRetry(appleReviewPageUrl(source.appId, country), {
    ...options,
    accept: "text/html,application/xhtml+xml"
  });
  if (!response.ok) throw httpError("apple-app-store", "Apple public reviews page", response);
  const reviews = parseAppleReviewPage(await response.text(), source, country, Math.min(options.limit, APP_STORE_PAGE_REVIEW_LIMIT));
  if (!reviews.length) {
    throw new ConnectorError("apple-app-store", "Apple public review sources returned no reviews.", { status: 502, retryable: true });
  }
  return reviews;
}

function appleReviewPageUrl(appId, country) {
  return `https://apps.apple.com/${country}/app/${appId}?see-all=reviews&platform=iphone`;
}

async function fetchApp(appId, country, options) {
  const response = await fetchWithRetry(`https://itunes.apple.com/lookup?id=${appId}&country=${country}`, options);
  if (!response.ok) throw httpError("apple-app-store", "Apple app lookup", response);
  const payload = await parseJson(response, "Apple app lookup");
  if (!payload.results?.[0]) throw new ConnectorError("apple-app-store", "App Store application not found.", { status: 404 });
  return payload.results[0];
}

async function fetchWithRetry(url, options) {
  const attempts = clamp(options.attempts ?? 3, 1, 5);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const timeoutSignal = AbortSignal.timeout(clamp(options.timeoutMs ?? 20_000, 1_000, 60_000));
      const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
      const response = await (options.fetch ?? fetch)(url, {
        signal,
        headers: {
          accept: options.accept ?? "application/json",
          "cache-control": "no-cache",
          "user-agent": options.userAgent ?? USER_AGENT,
          ...options.headers
        }
      });
      if (!isRetryableStatus(response.status) || attempt === attempts) return response;
      await delay(retryDelay(response, attempt), options.signal);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastError = error;
      if (attempt === attempts) break;
      await delay(250 * 2 ** (attempt - 1), options.signal);
    }
  }
  throw new ConnectorError("apple-app-store", `Apple request failed: ${lastError?.message ?? "network error"}`, { retryable: true, cause: lastError });
}

function retryDelay(response, attempt) {
  const seconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
  return Number.isFinite(seconds) ? Math.min(seconds * 1_000, 10_000) : 250 * 2 ** (attempt - 1);
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Request aborted."));
    }, { once: true });
  });
}

function httpError(store, label, response) {
  return new ConnectorError(store, `${label} returned HTTP ${response.status}.`, {
    status: response.status,
    retryable: isRetryableStatus(response.status)
  });
}

async function parseJson(response, label) {
  try {
    return await response.json();
  } catch (error) {
    throw new ConnectorError("apple-app-store", `${label} returned invalid JSON.`, { cause: error });
  }
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function clamp(value, min, max) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) ? Math.min(max, Math.max(min, number)) : min;
}
