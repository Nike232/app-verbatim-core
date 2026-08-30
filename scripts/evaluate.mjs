import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { classifyReview, THEME_RULES } from "../src/index.js";

const file = path.resolve(import.meta.dirname, "..", "benchmarks", "theme-eval.jsonl");
const policyFile = path.resolve(import.meta.dirname, "..", "benchmarks", "theme-eval-policy.json");
const examples = (await readFile(file, "utf8")).trim().split(/\r?\n/).map((line) => JSON.parse(line));
const policy = JSON.parse(await readFile(policyFile, "utf8"));
const labels = THEME_RULES.map((theme) => theme.id);
assert.equal(policy.schemaVersion, 1, "Theme benchmark policy schemaVersion must be 1.");
const overall = evaluate(examples);
const perLanguage = Object.fromEntries([...new Set(examples.map((item) => item.language))].sort().map((language) => [
  language,
  evaluate(examples.filter((item) => item.language === language), false)
]));
const report = {
  benchmark: path.relative(path.resolve(import.meta.dirname, ".."), file).replaceAll("\\", "/"),
  examples: examples.length,
  languages: [...new Set(examples.map((item) => item.language))].sort(),
  ...overall,
  perLanguage
};

console.log(JSON.stringify(report, null, 2));
checkThresholds("Overall", overall, policy.overall);
for (const [language, thresholds] of Object.entries(policy.languages ?? {})) {
  const metrics = perLanguage[language];
  assert.ok(metrics, `Theme benchmark has no ${language} examples.`);
  assert.ok(metrics.examples >= thresholds.minimumExamples, `${language} benchmark needs at least ${thresholds.minimumExamples} examples.`);
  checkThresholds(language, metrics, thresholds);
}

function evaluate(items, includeLabels = true) {
  const perLabel = Object.fromEntries(labels.map((label) => [label, { tp: 0, fp: 0, fn: 0 }]));
  let exact = 0;
  for (const example of items) {
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
  const metrics = {
    examples: items.length,
    microPrecision: round(precision),
    microRecall: round(recall),
    microF1: round(divide(2 * precision * recall, precision + recall)),
    exactMatch: round(exact / items.length)
  };
  if (includeLabels) metrics.perLabel = Object.fromEntries(Object.entries(perLabel).map(([label, counts]) => [label, {
    ...counts,
    precision: round(divide(counts.tp, counts.tp + counts.fp)),
    recall: round(divide(counts.tp, counts.tp + counts.fn))
  }]));
  return metrics;
}

function checkThresholds(label, metrics, thresholds) {
  assert.ok(metrics.microPrecision >= thresholds.minimumPrecision, `${label} theme precision ${metrics.microPrecision.toFixed(3)} is below ${thresholds.minimumPrecision}.`);
  assert.ok(metrics.microRecall >= thresholds.minimumRecall, `${label} theme recall ${metrics.microRecall.toFixed(3)} is below ${thresholds.minimumRecall}.`);
  assert.ok(metrics.exactMatch >= thresholds.minimumExactMatch, `${label} exact match ${metrics.exactMatch.toFixed(3)} is below ${thresholds.minimumExactMatch}.`);
}

function divide(left, right) {
  return right ? left / right : 1;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}
