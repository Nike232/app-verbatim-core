import { createHash } from "node:crypto";

const DAY_MS = 86_400_000;
const STOP_WORDS = new Set([
  "app", "application", "after", "again", "also", "and", "are", "because", "before", "been", "being", "but", "can", "could", "did", "does", "every", "for", "from", "had", "has", "have", "into", "its", "it's", "just", "like", "more", "not", "only", "please", "really", "since", "still", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "too", "use", "used", "using", "very", "want", "was", "were", "what", "when", "where", "which", "with", "work", "would", "your", "update", "version",
  "一个", "这个", "那个", "但是", "就是", "没有", "可以", "非常", "真的", "已经", "现在", "使用", "软件", "应用", "希望", "感觉", "问题"
]);

export function discoverIssues(reviews, options = {}) {
  if (!Array.isArray(reviews)) throw new TypeError("reviews must be an array.");
  const totalReviews = options.totalReviews ?? reviews.length;
  const documents = reviews
    .filter((review) => review?.body && Number(review.rating) <= 3)
    .map((review) => ({ review, ...fingerprint(review.body) }))
    .filter((document) => document.features.size);
  if (documents.length < 2) return [];

  const occurrences = new Map();
  const display = new Map();
  for (const [index, document] of documents.entries()) {
    for (const feature of document.features) {
      const indexes = occurrences.get(feature) ?? [];
      indexes.push(index);
      occurrences.set(feature, indexes);
      const label = document.display.get(feature) ?? feature;
      const labels = display.get(feature) ?? new Map();
      labels.set(label, (labels.get(label) ?? 0) + 1);
      display.set(feature, labels);
    }
  }

  const maxDocumentFrequency = Math.max(3, Math.ceil(documents.length * 0.8));
  const candidates = [...occurrences.entries()].filter(([feature, indexes]) => {
    const isPhrase = feature.includes(" ");
    const isCjk = /[\u3400-\u9fff\u3040-\u30ff]/u.test(feature);
    return (isPhrase || isCjk) && indexes.length >= 2 && indexes.length <= maxDocumentFrequency;
  }).map(([feature, indexes]) => {
    const items = indexes.map((index) => documents[index].review);
    const averageRating = round(mean(items.map((review) => review.rating)), 2);
    const phraseBoost = feature.includes(" ") ? 1.35 : 1;
    const specificity = Math.log((documents.length + 1) / (indexes.length + 0.5)) + 1;
    return {
      feature,
      indexes,
      items,
      averageRating,
      score: round(indexes.length * (6 - averageRating) * specificity * phraseBoost, 3)
    };
  }).sort((left, right) => right.score - left.score || right.indexes.length - left.indexes.length);

  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((current) => overlap(candidate.indexes, current.indexes) >= 0.65)) continue;
    selected.push(candidate);
    if (selected.length >= (options.limit ?? 6)) break;
  }

  const anchor = options.anchor ?? Math.max(...documents.map(({ review }) => Date.parse(review.createdAt)).filter(Number.isFinite));
  const recentStart = anchor - 30 * DAY_MS;
  const previousStart = anchor - 60 * DAY_MS;
  return selected.map((candidate) => {
    const recentCount = candidate.items.filter((review) => Date.parse(review.createdAt) >= recentStart).length;
    const previousCount = candidate.items.filter((review) => {
      const time = Date.parse(review.createdAt);
      return time >= previousStart && time < recentStart;
    }).length;
    const trendPercent = previousCount === 0 ? (recentCount ? 100 : 0) : Math.round(((recentCount - previousCount) / previousCount) * 100);
    const label = mostCommon(display.get(candidate.feature));
    const versions = aggregateVersions(candidate.items);
    return {
      id: `discovered-${createHash("sha256").update(candidate.feature).digest("hex").slice(0, 12)}`,
      label,
      fingerprint: candidate.feature,
      count: candidate.items.length,
      share: totalReviews ? round(candidate.items.length / totalReviews, 3) : 0,
      averageRating: candidate.averageRating,
      recentCount,
      previousCount,
      trendPercent,
      score: candidate.score,
      versions,
      evidence: [...candidate.items].sort((left, right) => evidenceScore(right) - evidenceScore(left)).slice(0, 4).map(evidenceRef)
    };
  });
}

function aggregateVersions(items) {
  const groups = new Map();
  for (const review of items) {
    if (!review.appVersion) continue;
    const group = groups.get(review.appVersion) ?? [];
    group.push(review);
    groups.set(review.appVersion, group);
  }
  return [...groups.entries()].sort((left, right) => right[1].length - left[1].length).map(([version, group]) => ({
    version,
    count: group.length,
    evidence: [...group].sort((left, right) => evidenceScore(right) - evidenceScore(left)).slice(0, 4).map(evidenceRef)
  }));
}

function fingerprint(value) {
  const normalized = String(value).normalize("NFKC").toLowerCase();
  const display = new Map();
  const features = new Set();
  const latinRuns = normalized.match(/[a-zà-öø-ÿ][a-zà-öø-ÿ'-]{2,}/gu) ?? [];
  const tokens = latinRuns.map((token) => ({ raw: token, stem: stem(token) })).filter(({ stem: token }) => token.length >= 3 && !STOP_WORDS.has(token));
  for (const token of tokens) addFeature(features, display, token.stem, token.raw);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const key = `${tokens[index].stem} ${tokens[index + 1].stem}`;
    addFeature(features, display, key, `${tokens[index].raw} ${tokens[index + 1].raw}`);
  }

  const cjkRuns = normalized.match(/[\u3400-\u9fff\u3040-\u30ff]{3,}/gu) ?? [];
  for (const run of cjkRuns) {
    for (let index = 0; index <= run.length - 2; index += 1) {
      const feature = run.slice(index, index + 2);
      if (!STOP_WORDS.has(feature)) addFeature(features, display, feature, feature);
    }
    for (let index = 0; index <= run.length - 3; index += 1) {
      const feature = run.slice(index, index + 3);
      if (!STOP_WORDS.has(feature)) addFeature(features, display, feature, feature);
    }
  }
  return { features, display };
}

function addFeature(features, display, key, label) {
  features.add(key);
  display.set(key, label);
}

function stem(value) {
  let word = value.replace(/^'+|'+$/g, "");
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) word = word.slice(0, -3);
  else if (word.length > 4 && word.endsWith("ed")) {
    word = word.slice(0, -2);
    if (/(at|iz)$/.test(word)) word += "e";
  } else if (word.length > 4 && word.endsWith("es")) word = word.slice(0, -2);
  else if (word.length > 4 && word.endsWith("s")) word = word.slice(0, -1);
  return word.replace(/([a-z])\1$/, "$1");
}

function mostCommon(counts) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)[0][0];
}

function overlap(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  const intersection = [...a].filter((value) => b.has(value)).length;
  return intersection / Math.min(a.size, b.size);
}

function evidenceRef(review) {
  return {
    reviewId: review.reviewId,
    rating: review.rating,
    excerpt: review.body.length > 220 ? `${review.body.slice(0, 217)}…` : review.body,
    author: review.author,
    appVersion: review.appVersion,
    createdAt: review.createdAt,
    helpfulCount: review.helpfulCount,
    sourceUrl: review.sourceUrl
  };
}

function evidenceScore(review) {
  return (6 - review.rating) * 10 + Math.min(review.helpfulCount ?? 0, 50) + Date.parse(review.createdAt) / 1e12;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) / values.length : 0;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
