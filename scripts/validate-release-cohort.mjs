import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { analyze, DEFAULT_POLICY, evaluateRegression, parseSourceRef } from "../src/index.js";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "benchmarks", "release-cohort.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const validateOnly = process.argv.includes("--validate-only");
const selectedSlug = option("--app");
const outputPath = path.resolve(root, option("--output") ?? path.join("reports", "release-cohort.json"));

validateManifest(manifest);
if (validateOnly) {
  console.log(`Release cohort manifest is valid (${manifest.apps.length} apps).`);
  process.exit(0);
}

const apps = selectedSlug ? manifest.apps.filter((app) => app.slug === selectedSlug) : manifest.apps;
if (!apps.length) throw new RangeError(`Unknown cohort app: ${selectedSlug}`);

const startedAt = new Date().toISOString();
const results = [];
for (const [index, app] of apps.entries()) {
  process.stderr.write(`[${index + 1}/${apps.length}] ${app.name}... `);
  try {
    const analysis = await analyze(app.url, {
      country: manifest.country,
      language: manifest.language,
      limit: manifest.limit,
      timeoutMs: 30_000,
      attempts: 3,
      throttle: 250
    });
    const regression = evaluateRegression(analysis.report);
    results.push(toAggregateResult(app, analysis.report, regression));
    process.stderr.write(`${regression.status}\n`);
  } catch (error) {
    results.push({
      slug: app.slug,
      name: app.name,
      category: app.category,
      url: app.url,
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    });
    process.stderr.write("error\n");
  }
  if (index < apps.length - 1) await delay(750);
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  startedAt,
  cohort: {
    manifest: path.relative(root, manifestPath).replaceAll("\\", "/"),
    store: "google-play",
    country: manifest.country,
    language: manifest.language,
    requestedReviewLimit: manifest.limit,
    policy: DEFAULT_POLICY,
    selectedApp: selectedSlug ?? null
  },
  summary: summarize(results),
  apps: results
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Aggregate-only report: ${path.relative(root, outputPath).replaceAll("\\", "/")}`);

function validateManifest(value) {
  if (value?.schemaVersion !== 1) throw new TypeError("Release cohort schemaVersion must be 1.");
  if (!Array.isArray(value.apps) || value.apps.length < 20) throw new TypeError("Release cohort must contain at least 20 apps.");
  if (!Number.isInteger(value.limit) || value.limit < 20 || value.limit > 2_000) throw new TypeError("Release cohort limit must be an integer from 20 to 2000.");
  const slugs = new Set();
  for (const app of value.apps) {
    if (!app || !/^[a-z0-9-]+$/.test(app.slug) || typeof app.name !== "string" || typeof app.category !== "string") {
      throw new TypeError("Every release cohort app needs a slug, name, and category.");
    }
    if (slugs.has(app.slug)) throw new TypeError(`Duplicate release cohort slug: ${app.slug}`);
    slugs.add(app.slug);
    const source = parseSourceRef(app.url);
    if (source.store !== "google-play") throw new TypeError(`Release cohort app must use Google Play: ${app.slug}`);
  }
}

function toAggregateResult(app, report, regression) {
  return {
    slug: app.slug,
    name: app.name,
    category: app.category,
    url: app.url,
    status: regression.status,
    fetchedReviews: report.sample.total,
    currentVersion: regression.currentVersion,
    baselineVersion: regression.baselineVersion,
    versionEvidence: regression.versionEvidence,
    currentReviews: regression.metrics?.current.count ?? report.versions[0]?.count ?? 0,
    baselineReviews: regression.metrics?.baseline.count ?? null,
    ratingDrop: regression.metrics?.ratingDrop ?? null,
    negativeShareIncrease: regression.metrics?.negativeShareIncrease ?? null,
    violations: regression.violations.map((violation) => ({
      id: violation.id,
      severity: violation.severity,
      value: violation.value,
      threshold: violation.threshold
    })),
    summary: regression.summary
  };
}

function summarize(results) {
  const statuses = { pass: 0, fail: 0, "insufficient-data": 0, error: 0 };
  for (const result of results) statuses[result.status] += 1;
  const completed = results.length - statuses.error;
  const decidable = statuses.pass + statuses.fail;
  return {
    total: results.length,
    completed,
    decidable,
    decidableRate: completed ? round(decidable / completed) : 0,
    statuses,
    insufficientReasons: countInsufficientReasons(results),
    violationCounts: countViolations(results)
  };
}

function countInsufficientReasons(results) {
  const counts = { current: 0, baseline: 0, unavailable: 0 };
  for (const result of results.filter((item) => item.status === "insufficient-data")) {
    if (!result.versionEvidence?.current.version) counts.unavailable += 1;
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

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new TypeError(`${name} requires a value.`);
  return value;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
