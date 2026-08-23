import { randomUUID } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { analyze, analyzeDataset } from "./run-analysis.js";
import { createDemoDataset } from "./connectors/demo.js";
import { evaluateRegression, regressionToMarkdown } from "./regression.js";

main().catch((error) => {
  console.error(`::error title=App Verbatim failed::${commandEscape(error instanceof Error ? error.message : String(error))}`);
  process.exitCode = 1;
});

async function main() {
  const demo = booleanInput("demo", false);
  const appUrl = input("app-url");
  if (!demo && !appUrl) throw new Error("The app-url input is required.");

  const analysis = demo
    ? analyzeDataset(createDemoDataset(numberInput("limit", 96)), {
      source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" }
    })
    : await analyze(appUrl, {
      country: optionalInput("country"),
      language: optionalInput("language"),
      limit: numberInput("limit", 300)
    });
  const result = evaluateRegression(analysis.report, {
    minVersionReviews: numberInput("min-version-reviews", 5),
    maxRatingDrop: numberInput("max-rating-drop", 0.4),
    maxNegativeShareIncrease: numberInput("max-negative-increase", 0.15),
    maxThemeShareIncrease: numberInput("max-theme-increase", 0.18),
    maxDiscoveredIssueShare: numberInput("max-discovered-share", 0.05),
    minThemeReviews: numberInput("min-theme-reviews", 3)
  });
  const markdown = regressionToMarkdown(result);
  const outputPath = path.resolve(input("output", "app-verbatim-regression.json"));
  const reportPath = path.resolve(input("report-output", "app-verbatim-report.json"));
  await Promise.all([
    write(outputPath, `${JSON.stringify(result, null, 2)}\n`),
    write(reportPath, `${JSON.stringify(analysis.report, null, 2)}\n`),
    appendSummary(markdown)
  ]);

  await setOutput("status", result.status);
  await setOutput("current-version", result.currentVersion ?? "");
  await setOutput("baseline-version", result.baselineVersion ?? "");
  await setOutput("violations", String(result.violations.length));
  await setOutput("result-file", outputPath);
  await setOutput("report-file", reportPath);

  if (result.status === "fail" && booleanInput("create-issue", false)) {
    const issueUrl = await upsertIssue(result, markdown);
    await setOutput("issue-url", issueUrl);
    console.log(`Regression issue: ${issueUrl}`);
  }

  console.log(`${result.status.toUpperCase()}: ${result.summary}`);
  if (result.status === "fail" && booleanInput("fail-on-regression", true)) {
    console.error(`::error title=App review regression::${commandEscape(result.summary)}`);
    process.exitCode = 1;
  }
  if (result.status === "insufficient-data" && booleanInput("fail-on-insufficient-data", false)) {
    console.error(`::error title=Insufficient review evidence::${commandEscape(result.summary)}`);
    process.exitCode = 1;
  }
}

async function upsertIssue(result, markdown) {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = optionalInput("github-token") ?? process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error("create-issue requires GITHUB_REPOSITORY and a github-token input.");
  const marker = `<!-- app-verbatim:${result.app.store}:${result.app.id} -->`;
  const title = `[App Verbatim] Review regression in v${result.currentVersion}`;
  const body = `${marker}\n${markdown}`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "app-verbatim-action"
  };
  const base = `https://api.github.com/repos/${repository}`;
  const list = await github(`${base}/issues?state=open&per_page=100`, { headers });
  const existing = list.find((issue) => !issue.pull_request && issue.body?.includes(marker));
  if (existing) {
    const updated = await github(`${base}/issues/${existing.number}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title, body })
    });
    return updated.html_url;
  }
  const created = await github(`${base}/issues`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title, body })
  });
  return created.html_url;
}

async function github(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

async function write(file, content) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content, "utf8");
}

async function appendSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
}

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return Promise.resolve();
  const delimiter = `app_verbatim_${randomUUID()}`;
  return appendFile(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, "utf8");
}

function optionalInput(name) {
  const value = process.env[`INPUT_${name.toUpperCase()}`] ?? process.env[`INPUT_${name.toUpperCase().replaceAll("-", "_")}`];
  return value?.trim() || undefined;
}

function input(name, fallback) {
  return optionalInput(name) ?? fallback;
}

function numberInput(name, fallback) {
  const value = input(name, String(fallback));
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a number.`);
  return parsed;
}

function booleanInput(name, fallback) {
  const value = optionalInput(name);
  if (value == null) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false.`);
}

function commandEscape(value) {
  return String(value).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A").replaceAll(":", "%3A").replaceAll(",", "%2C");
}
