import { classifyReview, evaluateRegression, parseSourceRef } from "../../src/index.js";

const STORES = new Set(["apple-app-store", "google-play"]);

export function expandCohortManifest(value) {
  validateCommon(value);
  return Array.isArray(value.storefronts) ? expandMatrix(value) : expandFlat(value);
}

export function buildCohortResult(cohortCase, analysis) {
  const regression = evaluateRegression(analysis.report);
  const metadata = analysis.report.provenance?.datasets?.[0]?.metadata ?? {};
  const currentComplaintThemeCoverage = complaintThemeCoverage(analysis.datasets.primary.reviews, regression.currentVersion);
  return {
    slug: cohortCase.slug,
    appSlug: cohortCase.appSlug,
    name: cohortCase.name,
    category: cohortCase.category,
    store: cohortCase.store,
    storefront: cohortCase.storefront,
    country: cohortCase.country,
    language: cohortCase.language,
    url: cohortCase.url,
    status: regression.status,
    fetchedReviews: analysis.report.sample.total,
    currentVersion: regression.currentVersion,
    baselineVersion: regression.baselineVersion,
    versionEvidence: regression.versionEvidence,
    sourceEvidence: regression.sourceEvidence,
    currentReviews: regression.metrics?.current.count ?? analysis.report.versions[0]?.count ?? 0,
    baselineReviews: regression.metrics?.baseline.count ?? null,
    ratingDrop: regression.metrics?.ratingDrop ?? null,
    negativeShareIncrease: regression.metrics?.negativeShareIncrease ?? null,
    currentComplaintThemeCoverage,
    sourceHealth: {
      connector: metadata.connector ?? cohortCase.store,
      connectorVersion: metadata.connectorVersion ?? null,
      publicEndpoint: metadata.publicEndpoint ?? null,
      pagesFetched: metadata.pagesFetched ?? null,
      fallbackUsed: metadata.fallbackUsed ?? false,
      versionDataAvailable: metadata.versionDataAvailable ?? analysis.datasets.primary.reviews.some((review) => Boolean(review.appVersion))
    },
    violations: regression.violations.map((violation) => ({
      id: violation.id,
      severity: violation.severity,
      value: violation.value,
      threshold: violation.threshold
    })),
    summary: regression.summary
  };
}

export function summarizeCohort(results) {
  const summary = summarizeGroup(results);
  return {
    ...summary,
    byStore: groupSummary(results, (item) => item.store),
    byStorefront: groupSummary(results, (item) => item.storefront),
    insufficientReasons: countInsufficientReasons(results),
    sourceHealth: {
      fallbackCases: results.filter((item) => item.sourceHealth?.fallbackUsed).length,
      versionUnavailableCases: results.filter((item) => item.status !== "error" && !item.sourceHealth?.versionDataAvailable).length
    },
    currentComplaintThemeCoverage: combineThemeCoverage(results),
    violationCounts: countViolations(results)
  };
}

function validateCommon(value) {
  if (value?.schemaVersion !== 1) throw new TypeError("Cohort schemaVersion must be 1.");
  if (!Array.isArray(value.apps) || !value.apps.length) throw new TypeError("Cohort must contain applications.");
  if (!Number.isInteger(value.limit) || value.limit < 20 || value.limit > 2_000) {
    throw new TypeError("Cohort limit must be an integer from 20 to 2000.");
  }
  if (value.minimumApps != null && (!Number.isInteger(value.minimumApps) || value.apps.length < value.minimumApps)) {
    throw new TypeError(`Cohort must contain at least ${value.minimumApps} applications.`);
  }
  const slugs = new Set();
  for (const app of value.apps) {
    validateApp(app);
    if (slugs.has(app.slug)) throw new TypeError(`Duplicate cohort app slug: ${app.slug}`);
    slugs.add(app.slug);
  }
}

function expandFlat(value) {
  if (value.apps.length < 20) throw new TypeError("Release cohort must contain at least 20 applications.");
  const country = validateCountry(value.country);
  const language = validateLanguage(value.language);
  return value.apps.map((app) => {
    if (typeof app.url !== "string") throw new TypeError(`Cohort app needs a URL: ${app.slug}`);
    const source = parseSourceRef(app.url);
    return {
      slug: app.slug,
      appSlug: app.slug,
      name: app.name,
      category: app.category,
      store: source.store,
      storefront: `${country.toLowerCase()}-${language}`,
      country,
      language,
      url: app.url
    };
  });
}

function expandMatrix(value) {
  if (value.storefronts.length < 2) throw new TypeError("Storefront matrix must contain at least two storefronts.");
  const storefronts = value.storefronts.map((storefront) => ({
    slug: validateSlug(storefront?.slug, "storefront"),
    country: validateCountry(storefront?.country),
    language: validateLanguage(storefront?.language)
  }));
  if (new Set(storefronts.map((item) => item.slug)).size !== storefronts.length) throw new TypeError("Storefront slugs must be unique.");

  const cases = [];
  for (const app of value.apps) {
    if (!Array.isArray(app.sources) || app.sources.length < 2) throw new TypeError(`Matrix app needs at least two sources: ${app.slug}`);
    const sourceStores = new Set();
    for (const sourceEntry of app.sources) {
      if (typeof sourceEntry?.url !== "string") throw new TypeError(`Matrix source needs a URL: ${app.slug}`);
      const source = parseSourceRef(sourceEntry.url);
      if (!STORES.has(source.store) || sourceEntry.store !== source.store) throw new TypeError(`Matrix source store does not match its URL: ${app.slug}`);
      if (sourceStores.has(source.store)) throw new TypeError(`Duplicate matrix source store for ${app.slug}: ${source.store}`);
      sourceStores.add(source.store);
      for (const storefront of storefronts) {
        cases.push({
          slug: `${app.slug}-${source.store}-${storefront.slug}`,
          appSlug: app.slug,
          name: app.name,
          category: app.category,
          store: source.store,
          storefront: storefront.slug,
          country: storefront.country,
          language: storefront.language,
          url: sourceEntry.url
        });
      }
    }
  }
  if (value.expectedCases != null && cases.length !== value.expectedCases) {
    throw new TypeError(`Storefront matrix must expand to exactly ${value.expectedCases} cases; found ${cases.length}.`);
  }
  return cases;
}

function validateApp(app) {
  validateSlug(app?.slug, "app");
  if (typeof app?.name !== "string" || !app.name.trim() || typeof app?.category !== "string" || !app.category.trim()) {
    throw new TypeError("Every cohort app needs a slug, name, and category.");
  }
}

function validateSlug(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9-]+$/.test(value)) throw new TypeError(`Invalid cohort ${label} slug.`);
  return value;
}

function validateCountry(value) {
  const country = String(value ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new TypeError("Cohort country must be a two-letter code.");
  return country;
}

function validateLanguage(value) {
  const language = String(value ?? "").toLowerCase();
  if (!/^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/.test(language)) throw new TypeError("Cohort language must be a valid short language code.");
  return language;
}

function complaintThemeCoverage(reviews, currentVersion) {
  if (!currentVersion) return { complaintReviews: 0, matchedComplaintReviews: 0, rate: null };
  const complaints = reviews.filter((review) => review.appVersion === currentVersion && review.rating <= 3);
  const matched = complaints.filter((review) => classifyReview(review).length > 0).length;
  return {
    complaintReviews: complaints.length,
    matchedComplaintReviews: matched,
    rate: complaints.length ? round(matched / complaints.length) : null
  };
}

function summarizeGroup(results) {
  const statuses = { pass: 0, fail: 0, "insufficient-data": 0, error: 0 };
  for (const result of results) statuses[result.status] += 1;
  const completed = results.length - statuses.error;
  const decidable = statuses.pass + statuses.fail;
  return {
    total: results.length,
    completed,
    decidable,
    decidableRate: completed ? round(decidable / completed) : 0,
    statuses
  };
}

function groupSummary(results, keyFor) {
  const groups = new Map();
  for (const item of results) {
    const key = keyFor(item) ?? "unknown";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Object.fromEntries([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, items]) => [key, {
    ...summarizeGroup(items),
    currentComplaintThemeCoverage: combineThemeCoverage(items)
  }]));
}

function combineThemeCoverage(results) {
  const counts = results.reduce((total, item) => ({
    complaintReviews: total.complaintReviews + (item.currentComplaintThemeCoverage?.complaintReviews ?? 0),
    matchedComplaintReviews: total.matchedComplaintReviews + (item.currentComplaintThemeCoverage?.matchedComplaintReviews ?? 0)
  }), { complaintReviews: 0, matchedComplaintReviews: 0 });
  return {
    ...counts,
    rate: counts.complaintReviews ? round(counts.matchedComplaintReviews / counts.complaintReviews) : null
  };
}

function countInsufficientReasons(results) {
  const counts = { current: 0, baseline: 0, unavailable: 0, source: 0 };
  for (const result of results.filter((item) => item.status === "insufficient-data")) {
    if (result.sourceEvidence?.ready === false) counts.source += 1;
    else if (!result.versionEvidence?.current.version) counts.unavailable += 1;
    else if (result.versionEvidence.current.missingReviews > 0) counts.current += 1;
    else if (result.versionEvidence.baseline.missingReviews > 0) counts.baseline += 1;
    else counts.unavailable += 1;
  }
  return counts;
}

function countViolations(results) {
  const counts = {};
  for (const result of results) {
    for (const violation of result.violations ?? []) counts[violation.id] = (counts[violation.id] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}
