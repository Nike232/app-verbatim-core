import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { classifyReview, THEME_RULES } from "../src/index.js";

const file = path.resolve(import.meta.dirname, "..", "benchmarks", "theme-eval.jsonl");
const examples = (await readFile(file, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const labels = THEME_RULES.map((theme) => theme.id);
const perLabel = Object.fromEntries(labels.map((label) => [label, { tp: 0, fp: 0, fn: 0 }]));
let exact = 0;

for (const example of examples) {
  const predicted = new Set(classifyReview({ title: "", body: example.text }).map((item) => item.id));
  const expected = new Set(example.labels);
  if ([...predicted].sort().join(",") === [...expected].sort().join(",")) exact += 1;
  for (const label of labels) {
    if (predicted.has(label) && expected.has(label)) perLabel[label].tp += 1;
    else if (predicted.has(label)) perLabel[label].fp += 1;
    else if (expected.has(label)) perLabel[label].fn += 1;
  }
}

const totals = Object.values(perLabel).reduce((sum, item) => ({
  tp: sum.tp + item.tp,
  fp: sum.fp + item.fp,
  fn: sum.fn + item.fn
}), { tp: 0, fp: 0, fn: 0 });
const precision = divide(totals.tp, totals.tp + totals.fp);
const recall = divide(totals.tp, totals.tp + totals.fn);
const microF1 = divide(2 * precision * recall, precision + recall);
const exactMatch = exact / examples.length;
const report = {
  benchmark: path.relative(path.resolve(import.meta.dirname, ".."), file).replaceAll("\\", "/"),
  examples: examples.length,
  languages: [...new Set(examples.map((item) => item.language))].sort(),
  microPrecision: round(precision),
  microRecall: round(recall),
  microF1: round(microF1),
  exactMatch: round(exactMatch),
  perLabel: Object.fromEntries(Object.entries(perLabel).map(([label, counts]) => [label, {
    ...counts,
    precision: round(divide(counts.tp, counts.tp + counts.fp)),
    recall: round(divide(counts.tp, counts.tp + counts.fn))
  }]))
};

console.log(JSON.stringify(report, null, 2));
assert.ok(microF1 >= 0.85, `Theme benchmark micro-F1 ${microF1.toFixed(3)} is below 0.85.`);
assert.ok(exactMatch >= 0.75, `Theme benchmark exact match ${exactMatch.toFixed(3)} is below 0.75.`);

function divide(left, right) {
  return right ? left / right : 1;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}
