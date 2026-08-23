#!/usr/bin/env node

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { analyze, analyzeDataset } from "./run-analysis.js";
import { createDemoCompetitorDataset, createDemoDataset } from "./connectors/demo.js";
import { createDefaultRegistry } from "./connectors/index.js";
import { exportReport, resolveExportFormat } from "./exporters.js";
import { evaluateRegression, regressionToMarkdown } from "./regression.js";
import { parseSourceRef } from "./source-ref.js";
import { VERSION } from "./index.js";

const HELP = `App Verbatim ${VERSION}

Evidence-backed App Store and Google Play review analysis.

Usage:
  app-verbatim <command> [options]

Commands:
  analyze <url>       Fetch and analyze public reviews
  check <url>         Fail when a release regression crosses policy
  init <url>          Add the review-regression workflow to a repository
  mcp                 Start the local MCP server over stdio
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

Check options:
  --demo              Run the offline 4.8.0 regression scenario
  --country <code>    Storefront country, for example US
  --language <code>   Review language, for example en
  --limit <number>    Reviews to evaluate (1-2000, default 300)
  --min-version-reviews <n>  Required sample for each version (default 5)
  --max-rating-drop <n>      Allowed star-rating drop (default 0.4)
  --max-negative-increase <n> Allowed low-rating share increase (default 0.15)
  --max-theme-increase <n>   Allowed complaint-theme increase (default 0.18)
  --max-discovered-share <n> Allowed new issue-fingerprint share (default 0.05)
  --format <format>   md or json (default md)
  -o, --output <file> Write the check result to a file
  --force             Replace an existing output file
  --fail-on-insufficient-data  Treat a small version sample as failure

Init options:
  --create-issue      Create or update one issue when a regression is found
  --action-ref <ref>  Action version to use (default v0)
  -o, --output <file> Workflow path (default .github/workflows/app-verbatim.yml)
  --force             Replace an existing workflow file

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
  if (command === "check") return checkCommand(values);
  if (command === "init") return initCommand(values);
  if (command === "mcp") {
    if (values.length) throw new UsageError("Usage: app-verbatim mcp");
    const { startMcpServer } = await import("./mcp.js");
    return startMcpServer();
  }
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

async function checkCommand(values) {
  const allowed = new Set([
    "demo", "country", "language", "limit", "min-version-reviews", "max-rating-drop",
    "max-negative-increase", "max-theme-increase", "max-discovered-share", "min-theme-reviews", "format", "output",
    "force", "fail-on-insufficient-data"
  ]);
  const booleans = new Set(["demo", "force", "fail-on-insufficient-data"]);
  const { positional, options } = parseArgs(values, allowed, booleans);
  if ((options.demo && positional.length) || (!options.demo && positional.length !== 1)) {
    throw new UsageError("Usage: app-verbatim check <app-store-url> [options], or app-verbatim check --demo");
  }
  const analysis = options.demo
    ? analyzeDataset(createDemoDataset(integerOption(options, "limit", 96, 1, 500)), {
      source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" }
    })
    : await analyze(positional[0], {
      country: stringOption(options, "country"),
      language: stringOption(options, "language"),
      limit: integerOption(options, "limit", 300, 1, 2_000)
    });
  const result = evaluateRegression(analysis.report, {
    minVersionReviews: integerOption(options, "min-version-reviews", 5, 1, 2_000),
    maxRatingDrop: decimalOption(options, "max-rating-drop", 0.4, 0, 4),
    maxNegativeShareIncrease: decimalOption(options, "max-negative-increase", 0.15, 0, 1),
    maxThemeShareIncrease: decimalOption(options, "max-theme-increase", 0.18, 0, 1),
    maxDiscoveredIssueShare: decimalOption(options, "max-discovered-share", 0.05, 0, 1),
    minThemeReviews: integerOption(options, "min-theme-reviews", 3, 1, 2_000)
  });
  const format = (stringOption(options, "format") ?? inferCheckFormat(stringOption(options, "output"))).toLowerCase();
  if (!new Set(["md", "markdown", "json"]).has(format)) throw new UsageError("Check format must be md or json.");
  const content = format === "json" ? `${JSON.stringify(result, null, 2)}\n` : regressionToMarkdown(result);
  await writeContent(content, stringOption(options, "output"), options.force, format === "json" ? "JSON" : "Markdown");
  if (result.status === "fail" || (result.status === "insufficient-data" && options["fail-on-insufficient-data"])) process.exitCode = 1;
}

async function initCommand(values) {
  const allowed = new Set(["create-issue", "action-ref", "output", "force"]);
  const booleans = new Set(["create-issue", "force"]);
  const { positional, options } = parseArgs(values, allowed, booleans);
  if (positional.length !== 1) throw new UsageError("Usage: app-verbatim init <app-store-url> [options]");

  const source = parseSourceRef(positional[0]);
  const actionRef = stringOption(options, "action-ref") ?? "v0";
  if (!/^[A-Za-z0-9._/-]+$/.test(actionRef)) throw new UsageError("--action-ref contains unsupported characters.");

  const output = stringOption(options, "output") ?? ".github/workflows/app-verbatim.yml";
  const workflow = createWorkflow(source, {
    actionRef,
    createIssue: Boolean(options["create-issue"])
  });
  await writeContent(workflow, output, options.force, "GitHub Actions workflow");
  console.error("Next: commit the workflow, then run it from the Actions tab.");
}

function createWorkflow(source, { actionRef, createIssue }) {
  const permissions = ["permissions:", "  contents: read"];
  if (createIssue) permissions.push("  issues: write");

  const inputs = [
    `          app-url: ${JSON.stringify(source.canonicalUrl)}`
  ];
  if (source.country) inputs.push(`          country: ${JSON.stringify(source.country)}`);
  if (source.language) inputs.push(`          language: ${JSON.stringify(source.language)}`);
  if (createIssue) {
    inputs.push("          create-issue: true");
    inputs.push("          github-token: ${{ secrets.GITHUB_TOKEN }}");
  }

  return [
    "# Generated by App Verbatim. Safe to edit.",
    "name: App review regression",
    "",
    "on:",
    "  workflow_dispatch:",
    "  schedule:",
    "    - cron: \"17 8 * * *\"",
    "",
    ...permissions,
    "",
    "jobs:",
    "  review-health:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    `      - uses: Nike232/app-verbatim-core@${actionRef}`,
    "        with:",
    ...inputs,
    ""
  ].join("\n");
}

async function writeResult(result, options) {
  const output = stringOption(options, "output");
  const format = resolveExportFormat(stringOption(options, "format"), output);
  const reviews = [result.datasets.primary, result.datasets.competitor].filter(Boolean).flatMap((dataset) => dataset.reviews);
  const content = exportReport(result.report, format, { reviews });
  return writeContent(content, output, options.force, `${format.toUpperCase()} report`);
}

async function writeContent(content, output, force, label) {
  if (!output) return process.stdout.write(content);
  const file = path.resolve(output);
  if (!force && await exists(file)) throw new UsageError(`Output already exists: ${file}. Use --force to replace it.`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
  console.error(`Wrote ${label} to ${file}`);
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

function decimalOption(options, key, fallback, min, max) {
  if (options[key] == null) return fallback;
  const value = Number(options[key]);
  if (!Number.isFinite(value) || value < min || value > max) throw new UsageError(`--${key} must be between ${min} and ${max}.`);
  return value;
}

function inferCheckFormat(output) {
  return output?.toLowerCase().endsWith(".json") ? "json" : "md";
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
