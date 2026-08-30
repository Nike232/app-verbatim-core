import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { classifyReviewScope, REVIEW_SCOPE_CATEGORIES } from "../src/index.js";

const root = path.resolve(import.meta.dirname, "..");
const benchmarkFile = path.join(root, "benchmarks", "actionability-eval.jsonl");
const policyFile = path.join(root, "benchmarks", "actionability-eval-policy.json");
const examples = (await readFile(benchmarkFile, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const policy = JSON.parse(await readFile(policyFile, "utf8"));
const labels = [...REVIEW_SCOPE_CATEGORIES];

assert.equal(policy.schemaVersion, 1, "Actionability benchmark policy schemaVersion must be 1.");
assert.ok(examples.length >= policy.minimumExamples, `Actionability benchmark needs at least ${policy.minimumExamples} examples.`);
assert.ok(new Set(examples.map((item) => item.language)).size >= policy.minimumLanguages, `Actionability benchmark needs at least ${policy.minimumLanguages} languages.`);

const counts = Object.fromEntries(labels.map((label) => [label, { examples: 0, tp: 0, fp: 0, fn: 0 }]));
let exact = 0;
for (const example of examples) {
  assert.ok(labels.includes(example.label), `Unknown actionability label: ${example.label}`);
  counts[example.label].examples += 1;
  const predicted = classifyReviewScope({ title: "", body: example.text }).primary;
  if (predicted === example.label) exact += 1;
  for (const label of labels) {
    if (predicted === label && example.label === label) counts[label].tp += 1;
    else if (predicted === label) counts[label].fp += 1;
    else if (example.label === label) counts[label].fn += 1;
  }
}

for (const [label, count] of Object.entries(counts)) {
  assert.ok(count.examples >= policy.minimumPerCategory, `${label} needs at least ${policy.minimumPerCategory} examples.`);
  count.precision = round(divide(count.tp, count.tp + count.fp));
  count.recall = round(divide(count.tp, count.tp + count.fn));
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
assert.ok(report.microPrecision >= policy.minimumPrecision, `Actionability precision ${report.microPrecision.toFixed(3)} is below ${policy.minimumPrecision}.`);
assert.ok(report.microRecall >= policy.minimumRecall, `Actionability recall ${report.microRecall.toFixed(3)} is below ${policy.minimumRecall}.`);
assert.ok(report.exactMatch >= policy.minimumExactMatch, `Actionability exact match ${report.exactMatch.toFixed(3)} is below ${policy.minimumExactMatch}.`);
for (const [label, count] of Object.entries(counts)) {
  assert.ok(count.precision >= policy.minimumPerCategoryPrecision, `${label} precision ${count.precision.toFixed(3)} is below ${policy.minimumPerCategoryPrecision}.`);
  assert.ok(count.recall >= policy.minimumPerCategoryRecall, `${label} recall ${count.recall.toFixed(3)} is below ${policy.minimumPerCategoryRecall}.`);
}

function divide(left, right) {
  return right ? left / right : 1;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}
