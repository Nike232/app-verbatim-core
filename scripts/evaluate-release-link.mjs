import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { classifyReleaseLink } from "../src/index.js";

const root = path.resolve(import.meta.dirname, "..");
const benchmarkFile = path.join(root, "benchmarks", "release-link-eval.jsonl");
const policyFile = path.join(root, "benchmarks", "release-link-eval-policy.json");
const examples = (await readFile(benchmarkFile, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const policy = JSON.parse(await readFile(policyFile, "utf8"));
const labels = ["explicit", "change", "none"];

assert.equal(policy.schemaVersion, 1, "Release-link benchmark policy schemaVersion must be 1.");
assert.ok(examples.length >= policy.minimumExamples, `Release-link benchmark needs at least ${policy.minimumExamples} examples.`);

const counts = Object.fromEntries(labels.map((label) => [label, { tp: 0, fp: 0, fn: 0 }]));
let exact = 0;
for (const example of examples) {
  assert.ok(labels.includes(example.label), `Unknown release-link label: ${example.label}`);
  const predicted = classifyReleaseLink({ title: "", body: example.text }).kind;
  if (predicted === example.label) exact += 1;
  for (const label of labels) {
    if (predicted === label && example.label === label) counts[label].tp += 1;
    else if (predicted === label) counts[label].fp += 1;
    else if (example.label === label) counts[label].fn += 1;
  }
}

const totals = Object.values(counts).reduce((sum, item) => ({
  tp: sum.tp + item.tp,
  fp: sum.fp + item.fp,
  fn: sum.fn + item.fn
}), { tp: 0, fp: 0, fn: 0 });
const precision = divide(totals.tp, totals.tp + totals.fp);
const recall = divide(totals.tp, totals.tp + totals.fn);
const report = {
  benchmark: path.relative(root, benchmarkFile).replaceAll("\\", "/"),
  examples: examples.length,
  languages: [...new Set(examples.map((item) => item.language))].sort(),
  microPrecision: round(precision),
  microRecall: round(recall),
  microF1: round(divide(2 * precision * recall, precision + recall)),
  exactMatch: round(exact / examples.length),
  perLabel: counts
};

console.log(JSON.stringify(report, null, 2));
assert.ok(report.microPrecision >= policy.minimumPrecision, `Release-link precision ${report.microPrecision.toFixed(3)} is below ${policy.minimumPrecision}.`);
assert.ok(report.microRecall >= policy.minimumRecall, `Release-link recall ${report.microRecall.toFixed(3)} is below ${policy.minimumRecall}.`);
assert.ok(report.exactMatch >= policy.minimumExactMatch, `Release-link exact match ${report.exactMatch.toFixed(3)} is below ${policy.minimumExactMatch}.`);

function divide(left, right) {
  return right ? left / right : 1;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}
