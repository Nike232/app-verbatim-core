#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { analyze, analyzeDataset } from "./run-analysis.js";
import { createDemoCompetitorDataset, createDemoDataset } from "./connectors/demo.js";
import { createDefaultRegistry } from "./connectors/index.js";
import { exportReport, resolveExportFormat } from "./exporters.js";
import { parseSourceRef } from "./source-ref.js";
import { VERSION } from "./index.js";

const HELP = `App Verbatim ${VERSION}

Evidence-backed App Store and Google Play review analysis.

Usage:
  app-verbatim <command> [options]

Commands:
  analyze <url>       Fetch and analyze public reviews
  demo                Generate a deterministic offline report
  inspect <url>       Parse and normalize an app-store URL
  connectors          List bundled connectors
  doctor              Check the local runtime

Analyze options:
  --compare <url>     Compare with another application
  --country <code>    Storefront country, for example US
  --language <code>   Review language, for example en
  --limit <number>    Reviews per application (1-2000, default 300)
  --format <format>   json, csv, md, or html
  -o, --output <file> Write to a file instead of stdout
  --force             Replace an existing output file

Demo options:
  --compare           Include the bundled competitor fixture
  --limit <number>    Reviews in the fixture
  --format <format>   json, csv, md, or html
  -o, --output <file> Write to a file instead of stdout
  --force             Replace an existing output file

Global options:
  -h, --help          Show help
  -v, --version       Show version`;

async function main(argv) {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) return console.log(HELP);
  if (argv.includes("--version") || argv.includes("-v")) return console.log(VERSION);
  const [command, ...values] = argv;

  if (command === "doctor") return doctor();
  if (command === "connectors") return printJson(createDefaultRegistry().list());
  if (command === "inspect") {
    if (values.length !== 1 || values[0].startsWith("-")) throw new UsageError("Usage: app-verbatim inspect <app-store-url>");
    return printJson(parseSourceRef(values[0]));
  }
  if (command === "analyze") return analyzeCommand(values);
  if (command === "demo") return demoCommand(values);
  throw new UsageError(`Unknown command: ${command}. Run app-verbatim --help.`);
}

async function analyzeCommand(values) {
  const { positional, options } = parseArgs(values, new Set(["compare", "country", "language", "limit", "format", "output", "force"]));
  if (positional.length !== 1) throw new UsageError("Usage: app-verbatim analyze <app-store-url> [options]");
  const result = await analyze(positional[0], {
    competitor: stringOption(options, "compare"),
    country: stringOption(options, "country"),
    language: stringOption(options, "language"),
    limit: integerOption(options, "limit", 300, 1, 2_000)
  });
  return writeResult(result, options);
}

async function demoCommand(values) {
  const { positional, options } = parseArgs(values, new Set(["compare", "limit", "format", "output", "force"]), new Set(["compare", "force"]));
  if (positional.length) throw new UsageError("Usage: app-verbatim demo [options]");
  const limit = integerOption(options, "limit", 96, 1, 500);
  const result = analyzeDataset(createDemoDataset(limit), {
    source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" },
    competitorDataset: options.compare ? createDemoCompetitorDataset(Math.min(limit, 84)) : null,
    competitorSource: options.compare ? { store: "demo", appId: "competitor", canonicalUrl: "demo://competitor" } : null
  });
  return writeResult(result, options);
}

async function writeResult(result, options) {
  const output = stringOption(options, "output");
  const format = resolveExportFormat(stringOption(options, "format"), output);
  const reviews = [result.datasets.primary, result.datasets.competitor].filter(Boolean).flatMap((dataset) => dataset.reviews);
  const content = exportReport(result.report, format, { reviews });
  if (!output) return process.stdout.write(content);
  const file = path.resolve(output);
  if (!options.force && await exists(file)) throw new UsageError(`Output already exists: ${file}. Use --force to replace it.`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  console.error(`Wrote ${format.toUpperCase()} report to ${file}`);
}

function doctor() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const supported = major > 22 || (major === 22 && minor >= 12);
  const result = { ok: supported && typeof fetch === "function", version: VERSION, node: process.version, platform: process.platform, architecture: process.arch, fetch: typeof fetch === "function" };
  printJson(result);
  if (!result.ok) process.exitCode = 1;
}

function parseArgs(values, allowed, booleans = new Set(["force"])) {
  const positional = [];
  const options = {};
  const aliases = { o: "output" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--") {
      positional.push(...values.slice(index + 1));
      break;
    }
    if (!value.startsWith("-")) {
      positional.push(value);
      continue;
    }
    const match = value.match(/^--([^=]+)(?:=(.*))?$/);
    const short = value.match(/^-([a-zA-Z])$/);
    const key = match?.[1] ?? aliases[short?.[1]];
    if (!key || !allowed.has(key)) throw new UsageError(`Unknown option: ${value}`);
    if (booleans.has(key)) {
      if (match?.[2] != null) throw new UsageError(`Option --${key} does not accept a value.`);
      options[key] = true;
      continue;
    }
    const inline = match?.[2];
    const next = inline ?? values[index + 1];
    if (!next || (inline == null && next.startsWith("-"))) throw new UsageError(`Missing value for --${key}.`);
    options[key] = next;
    if (inline == null) index += 1;
  }
  return { positional, options };
}

function stringOption(options, key) {
  return typeof options[key] === "string" ? options[key] : undefined;
}

function integerOption(options, key, fallback, min, max) {
  if (options[key] == null) return fallback;
  if (!/^\d+$/.test(options[key])) throw new UsageError(`--${key} must be an integer.`);
  const value = Number(options[key]);
  if (value < min || value > max) throw new UsageError(`--${key} must be between ${min} and ${max}.`);
  return value;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "UsageError";
  }
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`app-verbatim: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = error instanceof UsageError ? 2 : 1;
});
