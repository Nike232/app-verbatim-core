import { createHash } from "node:crypto";

import { buildComparison, buildReport, deduplicateReviews } from "./analysis.js";
import { createDefaultRegistry } from "./connectors/index.js";
import { parseSourceRef } from "./source-ref.js";

export async function analyze(input, options = {}) {
  const source = toSource(input);
  const registry = options.registry ?? createDefaultRegistry();
  const primary = await fetchDataset(registry, source, options);
  const competitorSource = options.competitor ? toSource(options.competitor) : null;
  if (competitorSource && sameSource(source, competitorSource)) throw new TypeError("Competitor must be different from the primary application.");
  const competitor = competitorSource ? await fetchDataset(registry, competitorSource, options) : null;
  return analyzeDataset(primary, {
    source,
    competitorDataset: competitor,
    competitorSource,
    generatedAt: options.generatedAt
  });
}

export function analyzeDataset(dataset, options = {}) {
  validateDataset(dataset, "primary");
  const source = options.source ?? inferSource(dataset);
  const reviews = deduplicateReviews(dataset.reviews);
  if (!reviews.length) throw new RangeError("The primary dataset contains no analyzable reviews.");

  let report = buildReport({ reviews, app: dataset.app, source, generatedAt: options.generatedAt });
  let competitor = null;
  let competitorReviews = [];
  if (options.competitorDataset) {
    validateDataset(options.competitorDataset, "competitor");
    competitor = options.competitorDataset;
    competitorReviews = deduplicateReviews(competitor.reviews);
    if (!competitorReviews.length) throw new RangeError("The competitor dataset contains no analyzable reviews.");
    const competitorReport = buildReport({
      reviews: competitorReviews,
      app: competitor.app,
      source: options.competitorSource ?? inferSource(competitor),
      generatedAt: options.generatedAt
    });
    report = { ...report, comparison: buildComparison(report, competitorReport) };
  }

  const generatedAt = report.generatedAt;
  report = {
    ...report,
    provenance: {
      generatedAt,
      datasets: [
        provenanceFor("primary", source, dataset, reviews),
        competitor ? provenanceFor("competitor", options.competitorSource ?? inferSource(competitor), competitor, competitorReviews) : null
      ].filter(Boolean)
    }
  };

  return {
    report,
    datasets: {
      primary: { ...dataset, reviews },
      competitor: competitor ? { ...competitor, reviews: competitorReviews } : null
    }
  };
}

async function fetchDataset(registry, source, options) {
  const connector = registry.resolve(source);
  const dataset = await connector.fetch(source, {
    country: options.country,
    language: options.language,
    limit: normalizeLimit(options.limit),
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    attempts: options.attempts,
    userAgent: options.userAgent,
    throttle: options.throttle
  });
  validateDataset(dataset, connector.id);
  return dataset;
}

function validateDataset(dataset, label) {
  if (!dataset || typeof dataset !== "object") throw new TypeError(`${label} connector returned no dataset.`);
  if (!dataset.app || typeof dataset.app.id !== "string" || typeof dataset.app.name !== "string") throw new TypeError(`${label} dataset has invalid app metadata.`);
  if (!Array.isArray(dataset.reviews)) throw new TypeError(`${label} dataset reviews must be an array.`);
}

function toSource(value) {
  if (typeof value === "string") return parseSourceRef(value);
  if (value && typeof value === "object" && typeof value.store === "string" && typeof value.appId === "string") return { ...value };
  throw new TypeError("Source must be an app-store URL or a source object with store and appId.");
}

function inferSource(dataset) {
  return { store: dataset.app.store, appId: dataset.app.id, canonicalUrl: dataset.app.url };
}

function provenanceFor(role, source, dataset, reviews) {
  return {
    role,
    source: source.store,
    appId: source.appId,
    reviewCount: reviews.length,
    contentHash: createHash("sha256").update(stableStringify(reviews)).digest("hex"),
    connector: dataset.metadata?.connector ?? source.store,
    connectorVersion: dataset.metadata?.connectorVersion ?? null,
    metadata: dataset.metadata ?? {}
  };
}

function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  return value;
}

function sameSource(left, right) {
  return left.store === right.store && left.appId === right.appId;
}

function normalizeLimit(value) {
  const number = Number.parseInt(value ?? "300", 10);
  return Number.isInteger(number) ? Math.min(2_000, Math.max(1, number)) : 300;
}
