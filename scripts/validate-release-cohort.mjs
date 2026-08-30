import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { analyze, DEFAULT_POLICY } from "../src/index.js";
import { buildCohortResult, expandCohortManifest, summarizeCohort } from "./lib/cohort.mjs";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = resolveManifestPath(option("--manifest"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const allCases = expandCohortManifest(manifest);
const validateOnly = process.argv.includes("--validate-only");
const selectedSlug = option("--app");
const defaultOutput = path.join("reports", `${path.basename(manifestPath, ".json")}.json`);
const outputPath = path.resolve(root, option("--output") ?? defaultOutput);

if (validateOnly) {
  console.log(`Cohort manifest is valid (${manifest.apps.length} apps, ${allCases.length} cases).`);
  process.exit(0);
}

const cases = selectedSlug
  ? allCases.filter((item) => item.appSlug === selectedSlug || item.slug === selectedSlug)
  : allCases;
if (!cases.length) throw new RangeError(`Unknown cohort app or case: ${selectedSlug}`);

const startedAt = new Date().toISOString();
const results = [];
for (const [index, cohortCase] of cases.entries()) {
  process.stderr.write(`[${index + 1}/${cases.length}] ${cohortCase.name} · ${cohortCase.store} · ${cohortCase.storefront}... `);
  try {
    const analysis = await analyze(cohortCase.url, {
      country: cohortCase.country,
      language: cohortCase.language,
      limit: manifest.limit,
      timeoutMs: 30_000,
      attempts: 3,
      throttle: 250
    });
    const result = buildCohortResult(cohortCase, analysis);
    results.push(result);
    process.stderr.write(`${result.status}\n`);
  } catch (error) {
    results.push({
      ...pickCase(cohortCase),
      status: "error",
      error: error instanceof Error ? error.message : String(error)
    });
    process.stderr.write("error\n");
  }
  if (index < cases.length - 1) await delay(750);
}

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  startedAt,
  cohort: {
    manifest: path.relative(root, manifestPath).replaceAll("\\", "/"),
    requestedReviewLimit: manifest.limit,
    policy: DEFAULT_POLICY,
    selectedApp: selectedSlug ?? null
  },
  summary: summarizeCohort(results),
  cases: results
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report.summary, null, 2));
console.log(`Aggregate-only report: ${path.relative(root, outputPath).replaceAll("\\", "/")}`);

function resolveManifestPath(value) {
  const benchmarkRoot = path.join(root, "benchmarks");
  const candidate = path.resolve(root, value ?? path.join("benchmarks", "release-cohort.json"));
  const relative = path.relative(benchmarkRoot, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new RangeError("Cohort manifests must be inside benchmarks/.");
  return candidate;
}

function pickCase(value) {
  return {
    slug: value.slug,
    appSlug: value.appSlug,
    name: value.name,
    category: value.category,
    store: value.store,
    storefront: value.storefront,
    country: value.country,
    language: value.language,
    url: value.url
  };
}

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new TypeError(`${name} requires a value.`);
  return value;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
