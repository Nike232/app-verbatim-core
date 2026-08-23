const APPLE_HOSTS = new Set(["apps.apple.com", "itunes.apple.com"]);
const GOOGLE_HOSTS = new Set(["play.google.com"]);

export class UnsupportedStoreUrlError extends Error {
  constructor(input) {
    super(`Unsupported App Store or Google Play URL: ${input}`);
    this.name = "UnsupportedStoreUrlError";
    this.input = input;
  }
}

export function parseSourceRef(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new UnsupportedStoreUrlError(input);
  }

  if (!["http:", "https:"].includes(url.protocol)) throw new UnsupportedStoreUrlError(input);
  const host = url.hostname.toLowerCase();

  if (APPLE_HOSTS.has(host)) {
    const match = url.pathname.match(/\/id(\d+)(?:\/|$)/i);
    if (!match) throw new UnsupportedStoreUrlError(input);
    return {
      store: "apple-app-store",
      appId: match[1],
      country: getAppleCountry(url),
      canonicalUrl: `https://apps.apple.com/app/id${match[1]}`
    };
  }

  if (GOOGLE_HOSTS.has(host) && url.pathname.replace(/\/$/, "") === "/store/apps/details") {
    const appId = url.searchParams.get("id")?.trim();
    if (!appId) throw new UnsupportedStoreUrlError(input);
    return {
      store: "google-play",
      appId,
      country: url.searchParams.get("gl")?.toUpperCase() ?? null,
      language: url.searchParams.get("hl") ?? null,
      canonicalUrl: `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`
    };
  }

  throw new UnsupportedStoreUrlError(input);
}

function getAppleCountry(url) {
  const firstSegment = url.pathname.split("/").filter(Boolean)[0];
  return firstSegment && /^[a-z]{2}$/i.test(firstSegment) ? firstSegment.toUpperCase() : null;
}
