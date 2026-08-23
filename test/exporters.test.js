import assert from "node:assert/strict";
import test from "node:test";

import { analyzeDataset, createDemoDataset, reportToCsv, reportToHtml, resolveExportFormat } from "../src/index.js";

test("infers supported export formats", () => {
  assert.equal(resolveExportFormat(undefined, "report.md"), "md");
  assert.equal(resolveExportFormat("markdown"), "md");
  assert.equal(resolveExportFormat(undefined, "report.unknown"), "json");
  assert.throws(() => resolveExportFormat("pdf"), /Unsupported format/);
});

test("guards spreadsheet formulas in CSV", () => {
  const csv = reportToCsv([{ source: "demo", appId: "app", reviewId: "one", rating: 1, body: "=HYPERLINK(\"bad\")", author: "+cmd", createdAt: "2026-01-01" }]);
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+cmd/);
});

test("escapes untrusted values in standalone HTML", () => {
  const dataset = createDemoDataset(4);
  dataset.app.name = "<script>alert(1)</script>";
  const { report } = analyzeDataset(dataset, { source: { store: "demo", appId: "one" }, generatedAt: "2026-08-24T00:00:00.000Z" });
  const html = reportToHtml(report);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});
