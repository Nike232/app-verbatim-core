#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { pathToFileURL } from "node:url";
import * as z from "zod/v4";

import { createDemoDataset } from "./connectors/demo.js";
import { reportToMarkdown } from "./exporters.js";
import { evaluateRegression, regressionToMarkdown } from "./regression.js";
import { analyze, analyzeDataset } from "./run-analysis.js";
import { VERSION } from "./version.js";

const sourceSchema = {
  appUrl: z.string().url().optional().describe("Public Apple App Store or Google Play listing URL"),
  country: z.string().length(2).default("US").describe("Two-letter storefront country"),
  language: z.string().min(2).max(12).default("en").describe("Review language"),
  limit: z.number().int().min(1).max(2_000).default(300).describe("Maximum reviews to fetch"),
  demo: z.boolean().default(false).describe("Use the deterministic offline fixture instead of a public listing")
};

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

export function createMcpServer() {
  const server = new McpServer({ name: "app-verbatim", version: VERSION });

  server.registerTool("check_release_regression", {
    title: "Check app release regression",
    description: "Compare review evidence for the newest two sufficiently sampled app versions. Returns pass, fail, or insufficient-data plus the source reviews behind every violation.",
    inputSchema: {
      ...sourceSchema,
      minVersionReviews: z.number().int().min(1).max(2_000).default(5),
      maxRatingDrop: z.number().min(0).max(4).default(0.4),
      maxNegativeIncrease: z.number().min(0).max(1).default(0.15),
      maxThemeIncrease: z.number().min(0).max(1).default(0.18),
      maxDiscoveredShare: z.number().min(0).max(1).default(0.05),
      minThemeReviews: z.number().int().min(1).max(2_000).default(3)
    },
    annotations
  }, async (input) => toolResult(async () => {
    const analysis = await runSource(input);
    const result = evaluateRegression(analysis.report, {
      minVersionReviews: input.minVersionReviews,
      maxRatingDrop: input.maxRatingDrop,
      maxNegativeShareIncrease: input.maxNegativeIncrease,
      maxThemeShareIncrease: input.maxThemeIncrease,
      maxDiscoveredIssueShare: input.maxDiscoveredShare,
      minThemeReviews: input.minThemeReviews
    });
    return { text: regressionToMarkdown(result), structuredContent: { result } };
  }));

  server.registerTool("analyze_app_reviews", {
    title: "Analyze app reviews",
    description: "Turn public app reviews into evidence-backed themes, version signals, newly discovered issue fingerprints, and recommendations.",
    inputSchema: sourceSchema,
    annotations
  }, async (input) => toolResult(async () => {
    const analysis = await runSource(input);
    return { text: reportToMarkdown(analysis.report), structuredContent: { report: analysis.report } };
  }));

  server.registerTool("compare_app_reviews", {
    title: "Compare two apps",
    description: "Compare App Store or Google Play review evidence for a primary app and competitor, including pain-point concentration and source reviews.",
    inputSchema: {
      primaryUrl: z.string().url().describe("Primary public app listing URL"),
      competitorUrl: z.string().url().describe("Competitor public app listing URL"),
      country: z.string().length(2).default("US"),
      language: z.string().min(2).max(12).default("en"),
      limit: z.number().int().min(1).max(2_000).default(300)
    },
    annotations
  }, async (input) => toolResult(async () => {
    const analysis = await analyze(input.primaryUrl, {
      competitor: input.competitorUrl,
      country: input.country,
      language: input.language,
      limit: input.limit
    });
    return { text: reportToMarkdown(analysis.report), structuredContent: { report: analysis.report } };
  }));

  return server;
}

export async function startMcpServer() {
  const server = createMcpServer();
  await server.connect(new StdioServerTransport());
}

async function runSource(input) {
  if (input.demo) {
    return analyzeDataset(createDemoDataset(Math.min(input.limit, 500)), {
      source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" }
    });
  }
  if (!input.appUrl) throw new TypeError("appUrl is required unless demo is true.");
  return analyze(input.appUrl, {
    country: input.country,
    language: input.language,
    limit: input.limit
  });
}

async function toolResult(operation) {
  try {
    const result = await operation();
    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: result.structuredContent
    };
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }]
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startMcpServer().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
