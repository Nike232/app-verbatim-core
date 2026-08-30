var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/action.js
var import_node_crypto4 = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = __toESM(require("node:path"), 1);

// src/run-analysis.js
var import_node_crypto3 = require("node:crypto");

// src/analysis.js
var import_node_crypto2 = require("node:crypto");

// src/discovery.js
var import_node_crypto = require("node:crypto");
var DAY_MS = 864e5;
var STOP_WORDS = /* @__PURE__ */ new Set([
  "app",
  "application",
  "after",
  "again",
  "also",
  "and",
  "are",
  "because",
  "before",
  "been",
  "being",
  "but",
  "can",
  "could",
  "did",
  "does",
  "every",
  "for",
  "from",
  "had",
  "has",
  "have",
  "into",
  "its",
  "it's",
  "just",
  "like",
  "more",
  "not",
  "only",
  "please",
  "really",
  "since",
  "still",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "too",
  "use",
  "used",
  "using",
  "very",
  "want",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "with",
  "work",
  "would",
  "your",
  "update",
  "version",
  "\u4E00\u4E2A",
  "\u8FD9\u4E2A",
  "\u90A3\u4E2A",
  "\u4F46\u662F",
  "\u5C31\u662F",
  "\u6CA1\u6709",
  "\u53EF\u4EE5",
  "\u975E\u5E38",
  "\u771F\u7684",
  "\u5DF2\u7ECF",
  "\u73B0\u5728",
  "\u4F7F\u7528",
  "\u8F6F\u4EF6",
  "\u5E94\u7528",
  "\u5E0C\u671B",
  "\u611F\u89C9",
  "\u95EE\u9898"
]);
function discoverIssues(reviews2, options = {}) {
  if (!Array.isArray(reviews2)) throw new TypeError("reviews must be an array.");
  const totalReviews = options.totalReviews ?? reviews2.length;
  const documents = reviews2.filter((review) => review?.body && Number(review.rating) <= 3).map((review) => ({ review, ...fingerprint(review.body) })).filter((document) => document.features.size);
  if (documents.length < 2) return [];
  const occurrences = /* @__PURE__ */ new Map();
  const display = /* @__PURE__ */ new Map();
  for (const [index, document] of documents.entries()) {
    for (const feature of document.features) {
      const indexes = occurrences.get(feature) ?? [];
      indexes.push(index);
      occurrences.set(feature, indexes);
      const label = document.display.get(feature) ?? feature;
      const labels = display.get(feature) ?? /* @__PURE__ */ new Map();
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
      const time3 = Date.parse(review.createdAt);
      return time3 >= previousStart && time3 < recentStart;
    }).length;
    const trendPercent = previousCount === 0 ? recentCount ? 100 : 0 : Math.round((recentCount - previousCount) / previousCount * 100);
    const label = mostCommon(display.get(candidate.feature));
    const versions = aggregateVersions(candidate.items);
    return {
      id: `discovered-${(0, import_node_crypto.createHash)("sha256").update(candidate.feature).digest("hex").slice(0, 12)}`,
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
  const groups = /* @__PURE__ */ new Map();
  for (const review of items) {
    if (!review.appVersion) continue;
    const group = groups.get(review.appVersion) ?? [];
    group.push(review);
    groups.set(review.appVersion, group);
  }
  return [...groups.entries()].sort((left, right) => right[1].length - left[1].length).map(([version2, group]) => ({
    version: version2,
    count: group.length,
    evidence: [...group].sort((left, right) => evidenceScore(right) - evidenceScore(left)).slice(0, 4).map(evidenceRef)
  }));
}
function fingerprint(value) {
  const normalized = String(value).normalize("NFKC").toLowerCase();
  const display = /* @__PURE__ */ new Map();
  const features = /* @__PURE__ */ new Set();
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
    excerpt: review.body.length > 220 ? `${review.body.slice(0, 217)}\u2026` : review.body,
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

// src/analysis.js
var DAY_MS2 = 864e5;
var THEME_RULES = [
  {
    id: "stability",
    label: "Stability and crashes",
    description: "Crashes, freezes, errors, and launch failures",
    intent: "problem",
    keywords: ["crash", "crashed", "crashing", "freeze", "frozen", "bug", "error", "broken", "won't open", "doesn't open", "\u5D29\u6E83", "\u95EA\u9000", "\u5361\u6B7B", "\u9519\u8BEF", "\u6253\u4E0D\u5F00", "\u65E0\u6CD5\u542F\u52A8", "absturz", "st\xFCrzt", "plantage", "plante", "bloquea", "fallo", "\u30AF\u30E9\u30C3\u30B7\u30E5", "\u5F37\u5236\u7D42\u4E86", "\u843D\u3061\u308B"]
  },
  {
    id: "performance",
    label: "Performance and battery",
    description: "Speed, lag, heat, battery drain, and resource usage",
    intent: "problem",
    keywords: ["slow", "lag", "laggy", "battery", "drain", "overheat", "loading", "stutter", "\u5361\u987F", "\u5F88\u6162", "\u8017\u7535", "\u53D1\u70ED", "\u52A0\u8F7D", "langsam", "batterie", "lent", "lente", "bater\xEDa", "\u9045\u3044", "\u91CD\u3044", "\u30D0\u30C3\u30C6\u30EA\u30FC"]
  },
  {
    id: "pricing",
    label: "Pricing and subscriptions",
    description: "Pricing, paywalls, trials, renewals, and refunds",
    intent: "problem",
    keywords: ["price", "pricing", "expensive", "subscription", "subscribe", "paywall", "trial", "refund", "charged", "\u4EF7\u683C", "\u592A\u8D35", "\u8BA2\u9605", "\u4ED8\u8D39", "\u9000\u6B3E", "\u6263\u8D39", "\u7EED\u8D39", "teuer", "abonnement", "cher", "caro", "suscripci\xF3n", "\u9AD8\u3044", "\u8AB2\u91D1", "\u30B5\u30D6\u30B9\u30AF"]
  },
  {
    id: "account",
    label: "Login and accounts",
    description: "Sign-in, registration, verification, and account access",
    intent: "problem",
    keywords: ["login", "log in", "sign in", "account", "password", "verification", "code", "\u767B\u5F55", "\u8D26\u6237", "\u8D26\u53F7", "\u5BC6\u7801", "\u9A8C\u8BC1\u7801", "\u6CE8\u518C", "anmelden", "connexion", "inicio de sesi\xF3n", "contrase\xF1a", "\u30ED\u30B0\u30A4\u30F3", "\u30A2\u30AB\u30A6\u30F3\u30C8", "\u30D1\u30B9\u30EF\u30FC\u30C9"]
  },
  {
    id: "sync",
    label: "Sync and data",
    description: "Cross-device sync, data loss, backup, import, and export",
    intent: "problem",
    keywords: ["sync", "lost data", "missing data", "backup", "restore", "import", "export", "\u540C\u6B65", "\u6570\u636E\u4E22\u5931", "\u5907\u4EFD", "\u6062\u590D", "\u5BFC\u5165", "\u5BFC\u51FA", "synchron", "sauvegarde", "sincron", "copia de seguridad", "\u540C\u671F", "\u30C7\u30FC\u30BF\u6D88\u5931", "\u30D0\u30C3\u30AF\u30A2\u30C3\u30D7"]
  },
  {
    id: "notifications",
    label: "Notifications and reminders",
    description: "Notification delivery, reminder timing, and interruptions",
    intent: "problem",
    keywords: ["notification", "notify", "reminder", "alert", "\u901A\u77E5", "\u63D0\u9192", "\u63A8\u9001", "benachrichtigung", "erinnerung", "notificaci\xF3n", "recordatorio", "\u30EA\u30DE\u30A4\u30F3\u30C0\u30FC"]
  },
  {
    id: "usability",
    label: "Usability and interface",
    description: "Navigation, discoverability, readability, and interaction paths",
    intent: "problem",
    keywords: ["confusing", "hard to use", "difficult to use", "interface", "ui", "navigation", "can't find", "\u627E\u4E0D\u5230", "\u96BE\u7528", "\u754C\u9762", "\u64CD\u4F5C", "\u5BFC\u822A", "\u590D\u6742", "verwirrend", "schwer zu bedienen", "difficile", "confuso", "dif\xEDcil de usar", "\u4F7F\u3044\u306B\u304F\u3044", "\u5206\u304B\u308A\u306B\u304F\u3044"]
  },
  {
    id: "feature-request",
    label: "Feature requests",
    description: "Explicit requests for additions or improvements",
    intent: "request",
    keywords: ["please add", "wish", "would love", "need a", "feature", "can you", "could you", "\u5E0C\u671B", "\u5EFA\u8BAE\u589E\u52A0", "\u80FD\u4E0D\u80FD", "\u8BF7\u6DFB\u52A0", "\u529F\u80FD", "\u9700\u8981\u652F\u6301", "bitte hinzuf\xFCgen", "w\xE4re sch\xF6n", "veuillez ajouter", "por favor a\xF1adan", "me gustar\xEDa", "\u8FFD\u52A0\u3057\u3066", "\u6B32\u3057\u3044", "\u6A5F\u80FD"]
  },
  {
    id: "privacy",
    label: "Privacy and permissions",
    description: "Privacy, tracking, permissions, and data usage",
    intent: "problem",
    keywords: ["privacy", "tracking", "permission", "data collection", "secure", "\u9690\u79C1", "\u8FFD\u8E2A", "\u6743\u9650", "\u6570\u636E\u6536\u96C6", "\u5B89\u5168", "datenschutz", "berechtigung", "confidentialit\xE9", "privacidad", "permiso", "\u30D7\u30E9\u30A4\u30D0\u30B7\u30FC", "\u6A29\u9650"]
  }
];
var STOP_WORDS2 = /* @__PURE__ */ new Set([
  "the",
  "and",
  "for",
  "are",
  "was",
  "were",
  "you",
  "not",
  "but",
  "can",
  "has",
  "had",
  "its",
  "it's",
  "don",
  "doesn",
  "cannot",
  "how",
  "now",
  "such",
  "this",
  "that",
  "with",
  "have",
  "from",
  "just",
  "your",
  "very",
  "when",
  "what",
  "would",
  "could",
  "there",
  "their",
  "them",
  "these",
  "they",
  "been",
  "being",
  "does",
  "did",
  "app",
  "apps",
  "really",
  "after",
  "before",
  "because",
  "about",
  "into",
  "than",
  "then",
  "only",
  "also",
  "still",
  "even",
  "more",
  "some",
  "good",
  "great",
  "please",
  "using",
  "used",
  "use",
  "work",
  "works",
  "make",
  "much",
  "like",
  "love",
  "want",
  "need",
  "\u4E00\u4E2A",
  "\u8FD9\u4E2A",
  "\u90A3\u4E2A",
  "\u8FD8\u662F",
  "\u4F46\u662F",
  "\u5C31\u662F",
  "\u6CA1\u6709",
  "\u53EF\u4EE5",
  "\u975E\u5E38",
  "\u771F\u7684",
  "\u5DF2\u7ECF",
  "\u73B0\u5728",
  "\u4F7F\u7528",
  "\u8F6F\u4EF6",
  "\u5E94\u7528",
  "\u5E0C\u671B",
  "\u611F\u89C9",
  "\u95EE\u9898"
]);
function normalizeReview(review) {
  const body = cleanText(review.body ?? review.text ?? "");
  const title = cleanText(review.title ?? "");
  const createdAt = toIso(review.createdAt ?? review.date ?? review.updatedAt);
  const source = review.source ?? "unknown";
  const reviewId = String(review.reviewId ?? review.id ?? stableId(`${source}:${body}:${createdAt}`));
  return {
    source,
    appId: String(review.appId ?? "unknown"),
    reviewId,
    title,
    body,
    rating: clampNumber(review.rating ?? review.score, 1, 5, 0),
    language: review.language ?? null,
    country: review.country?.toUpperCase?.() ?? review.country ?? null,
    appVersion: cleanText(review.appVersion ?? review.version ?? "") || null,
    author: cleanText(review.author ?? review.userName ?? "Anonymous") || "Anonymous",
    helpfulCount: Math.max(0, Number(review.helpfulCount ?? review.thumbsUp ?? 0) || 0),
    reply: review.reply ?? null,
    sourceUrl: review.sourceUrl ?? null,
    createdAt,
    updatedAt: toIso(review.updatedAt ?? review.createdAt ?? review.date)
  };
}
function deduplicateReviews(reviews2) {
  const byKey = /* @__PURE__ */ new Map();
  for (const review of reviews2.map(normalizeReview)) {
    const key = `${review.source}:${review.appId}:${review.reviewId}`;
    const previous = byKey.get(key);
    if (!previous || Date.parse(review.updatedAt) > Date.parse(previous.updatedAt)) {
      byKey.set(key, review);
    }
  }
  return [...byKey.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
function classifyReview(review) {
  const haystack = `${review.title} ${review.body}`.toLowerCase();
  return THEME_RULES.map((theme) => {
    const hits = theme.keywords.filter((keyword) => matchesKeyword(haystack, keyword));
    return hits.length ? { id: theme.id, hits, confidence: Math.min(0.98, 0.56 + hits.length * 0.13) } : null;
  }).filter(Boolean);
}
function matchesKeyword(haystack, value) {
  const keyword = value.toLowerCase();
  if (/[^a-zà-öø-ÿ\s'-]/u.test(keyword)) return haystack.includes(keyword);
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const inflection = !keyword.includes(" ") && keyword.length >= 4 ? "(?:s|es|ed|ing)?" : "";
  return new RegExp(`(?:^|[^a-z\xE0-\xF6\xF8-\xFF])${escaped}${inflection}(?=$|[^a-z\xE0-\xF6\xF8-\xFF])`, "u").test(haystack);
}
function buildReport({ reviews: reviews2, app: app2, source, generatedAt = (/* @__PURE__ */ new Date()).toISOString(), aiSummary = null }) {
  const cleanReviews = deduplicateReviews(reviews2).filter((review) => review.body);
  const anchor = cleanReviews.length ? Date.parse(cleanReviews[0].createdAt) : Date.parse(generatedAt);
  const recentStart = anchor - 30 * DAY_MS2;
  const previousStart = anchor - 60 * DAY_MS2;
  const themes = THEME_RULES.map((rule) => aggregateTheme(rule, cleanReviews, recentStart, previousStart)).filter((theme) => theme.count > 0).sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count);
  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: cleanReviews.filter((review) => review.rating === rating).length
  }));
  const averageRating = round2(mean2(cleanReviews.map((review) => review.rating).filter(Boolean)), 2);
  const versions = aggregateVersions2(cleanReviews);
  const timeline = aggregateTimeline(cleanReviews);
  const appTerms = new Set(`${app2.name ?? ""} ${app2.developer ?? ""}`.toLowerCase().match(/[a-z][a-z'-]{2,}|[\u4e00-\u9fff]{2,6}/g) ?? []);
  const keywords = extractKeywords(cleanReviews, appTerms);
  const discoveredIssues = discoverIssues(
    cleanReviews.filter((review) => classifyReview(review).length === 0),
    { totalReviews: cleanReviews.length, anchor }
  );
  const insights = buildInsights(themes, versions, cleanReviews);
  const countries = aggregateValue(cleanReviews, "country", 8);
  const languages = aggregateValue(cleanReviews, "language", 8);
  return {
    schemaVersion: 1,
    generatedAt,
    source,
    app: {
      id: app2.id,
      name: app2.name,
      icon: app2.icon ?? null,
      developer: app2.developer ?? null,
      url: app2.url,
      store: app2.store
    },
    sample: {
      total: cleanReviews.length,
      averageRating,
      negativeShare: cleanReviews.length ? round2(cleanReviews.filter((review) => review.rating <= 2).length / cleanReviews.length, 3) : 0,
      firstReviewAt: cleanReviews.at(-1)?.createdAt ?? null,
      lastReviewAt: cleanReviews[0]?.createdAt ?? null,
      countries,
      languages
    },
    ratingDistribution: distribution,
    timeline,
    themes,
    versions,
    keywords,
    discoveredIssues,
    insights,
    aiSummary,
    methodology: {
      evidenceRule: "Every insight must cite source reviews from the current dataset.",
      recentWindowDays: 30,
      classifier: "deterministic-keyword-v1",
      discovery: "deterministic-phrase-mining-v1",
      caveat: "Public store reviews are a sample; findings represent only the reviews retrieved in this run."
    }
  };
}
function buildComparison(primaryReport, competitorReport) {
  const primaryThemes = new Map(primaryReport.themes.map((theme) => [theme.id, theme]));
  const competitorThemes = new Map(competitorReport.themes.map((theme) => [theme.id, theme]));
  const gaps = THEME_RULES.map((rule) => {
    const primary = primaryThemes.get(rule.id);
    const competitor = competitorThemes.get(rule.id);
    const primaryShare = primary?.share ?? 0;
    const competitorShare = competitor?.share ?? 0;
    return {
      id: rule.id,
      label: rule.label,
      primaryCount: primary?.count ?? 0,
      primaryShare,
      competitorCount: competitor?.count ?? 0,
      competitorShare,
      shareGap: round2(competitorShare - primaryShare, 3),
      evidence: competitor?.evidence ?? []
    };
  }).filter((gap) => gap.primaryCount || gap.competitorCount).sort((a, b) => Math.abs(b.shareGap) - Math.abs(a.shareGap));
  const opportunities = gaps.filter((gap) => gap.competitorCount >= 2 && gap.shareGap >= 0.03).slice(0, 4).map((gap) => ({
    id: `competitor-${gap.id}`,
    title: `${gap.label} is more concentrated in competitor feedback`,
    statement: `${gap.label} appears in ${Math.round(gap.competitorShare * 100)}% of ${competitorReport.app.name} reviews versus ${Math.round(gap.primaryShare * 100)}% for the primary app.`,
    recommendation: `Read the competitor evidence and test whether fewer ${gap.label.toLowerCase()} problems can become a product promise or migration message.`,
    evidence: gap.evidence
  }));
  return {
    competitor: competitorReport.app,
    sample: competitorReport.sample,
    ratingGap: round2((primaryReport.sample.averageRating || 0) - (competitorReport.sample.averageRating || 0), 2),
    gaps,
    opportunities
  };
}
function aggregateTheme(rule, reviews2, recentStart, previousStart) {
  const matched = reviews2.map((review) => ({ review, matches: classifyReview(review) })).filter(({ matches }) => matches.some((match) => match.id === rule.id));
  const recent = matched.filter(({ review }) => Date.parse(review.createdAt) >= recentStart).length;
  const previous = matched.filter(({ review }) => {
    const time3 = Date.parse(review.createdAt);
    return time3 >= previousStart && time3 < recentStart;
  }).length;
  const avgRating = round2(mean2(matched.map(({ review }) => review.rating)), 2);
  const evidence = matched.sort((a, b) => evidenceScore2(b.review) - evidenceScore2(a.review)).slice(0, 4).map(({ review }) => evidenceRef2(review));
  const trendPercent = previous === 0 ? recent > 0 ? 100 : 0 : Math.round((recent - previous) / previous * 100);
  return {
    id: rule.id,
    label: rule.label,
    description: rule.description,
    intent: rule.intent,
    count: matched.length,
    share: reviews2.length ? round2(matched.length / reviews2.length, 3) : 0,
    averageRating: avgRating,
    negativeCount: matched.filter(({ review }) => review.rating <= 2).length,
    recentCount: recent,
    previousCount: previous,
    trendPercent,
    priorityScore: round2(matched.length * (6 - (avgRating || 3)) * (1 + Math.max(0, trendPercent) / 200), 1),
    evidence
  };
}
function aggregateVersions2(reviews2) {
  const groups = /* @__PURE__ */ new Map();
  for (const review of reviews2) {
    if (!review.appVersion) continue;
    const group = groups.get(review.appVersion) ?? [];
    group.push(review);
    groups.set(review.appVersion, group);
  }
  return [...groups.entries()].map(([version2, items]) => {
    const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const themeSignals = THEME_RULES.map((rule) => {
      const matched = items.filter((review) => classifyReview(review).some((match) => match.id === rule.id));
      return {
        id: rule.id,
        label: rule.label,
        count: matched.length,
        share: round2(matched.length / items.length, 3),
        negativeCount: matched.filter((review) => review.rating <= 2).length,
        evidence: matched.sort((a, b) => evidenceScore2(b) - evidenceScore2(a)).slice(0, 3).map(evidenceRef2)
      };
    }).filter((theme) => theme.count > 0).sort((a, b) => b.count - a.count);
    return {
      version: version2,
      count: items.length,
      averageRating: round2(mean2(items.map((item) => item.rating)), 2),
      negativeShare: round2(items.filter((item) => item.rating <= 2).length / items.length, 3),
      lastSeenAt: sorted[0].createdAt,
      themeSignals,
      evidence: sorted.filter((item) => item.rating <= 2).slice(0, 3).map(evidenceRef2)
    };
  }).sort((a, b) => compareVersionIdentifiers(b.version, a.version) || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)).slice(0, 12);
}
function compareVersionIdentifiers(left, right) {
  const a = String(left).match(/\d+/g)?.map(Number);
  const b = String(right).match(/\d+/g)?.map(Number);
  if (!a?.length || !b?.length) return 0;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
function aggregateTimeline(reviews2) {
  const groups = /* @__PURE__ */ new Map();
  for (const review of reviews2) {
    const key = review.createdAt.slice(0, 7);
    const group = groups.get(key) ?? [];
    group.push(review);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([period, items]) => ({
    period,
    count: items.length,
    averageRating: round2(mean2(items.map((item) => item.rating)), 2),
    negativeCount: items.filter((item) => item.rating <= 2).length
  }));
}
function aggregateValue(reviews2, field, limit) {
  const counts = /* @__PURE__ */ new Map();
  for (const review of reviews2) {
    const value = review[field] || "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));
}
function extractKeywords(reviews2, excluded = /* @__PURE__ */ new Set()) {
  const counts = /* @__PURE__ */ new Map();
  const bodies = reviews2.filter((review) => review.rating <= 3).map((review) => review.body.toLowerCase());
  for (const body of bodies) {
    const words = body.match(/[a-z][a-z'-]{2,}|[\u4e00-\u9fff]{2,6}/g) ?? [];
    for (const word of new Set(words)) {
      if (!STOP_WORDS2.has(word) && !excluded.has(word) && !/^\d+$/.test(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([term, count]) => ({ term, count }));
}
function buildInsights(themes, versions, reviews2) {
  const results = [];
  const growing = themes.find((theme) => theme.recentCount >= 2 && theme.trendPercent > 20);
  if (growing) {
    results.push({
      id: `trend-${growing.id}`,
      kind: "emerging",
      severity: growing.averageRating <= 2.2 ? "high" : "medium",
      title: `${growing.label} is increasing`,
      statement: `${growing.recentCount} matching reviews appeared in the recent window, a ${formatPercent(growing.trendPercent)} change from the previous window.`,
      recommendation: "Reproduce the shared paths in the evidence first, then connect fixes to the next release.",
      evidence: growing.evidence
    });
  }
  const painful = themes.find((theme) => theme.negativeCount >= 2);
  if (painful) {
    results.push({
      id: `pain-${painful.id}`,
      kind: "pain",
      severity: painful.negativeCount >= Math.max(4, painful.count * 0.6) ? "high" : "medium",
      title: `${painful.label} is the most concentrated pain point`,
      statement: `${painful.negativeCount} of ${painful.count} matching reviews are one or two stars, with an average rating of ${painful.averageRating || "n/a"}.`,
      recommendation: "Rank reproduction paths from the source reviews and fix the broadest, lowest-rated root cause first.",
      evidence: painful.evidence
    });
  }
  const regressed = versions.find((version2) => version2.count >= 3 && version2.averageRating <= 2.8);
  if (regressed) {
    results.push({
      id: `version-${regressed.version}`,
      kind: "regression",
      severity: regressed.averageRating <= 2 ? "high" : "medium",
      title: `Version ${regressed.version} shows a regression signal`,
      statement: `${regressed.count} reviews for this version average ${regressed.averageRating} stars, with ${Math.round(regressed.negativeShare * 100)}% rated one or two stars.`,
      recommendation: "Compare the evidence with the release changelog, map symptoms to shipped changes, and schedule regression tests.",
      evidence: regressed.evidence
    });
  }
  const request = themes.find((theme) => theme.intent === "request" && theme.count >= 2);
  if (request) {
    results.push({
      id: "feature-demand",
      kind: "opportunity",
      severity: "low",
      title: "A testable feature request is visible",
      statement: `${request.count} reviews explicitly request an addition or improvement, representing ${Math.round(request.share * 100)}% of the sample.`,
      recommendation: "Validate frequent requests with interviews or a lightweight prototype before committing roadmap capacity.",
      evidence: request.evidence
    });
  }
  if (!results.length && reviews2.length) {
    const evidence = reviews2.slice(0, 3).map(evidenceRef2);
    results.push({
      id: "baseline",
      kind: "baseline",
      severity: "low",
      title: "No concentrated risk is visible in this sample",
      statement: `${reviews2.length} reviews were checked; no theme met both the volume and trend thresholds.`,
      recommendation: "Increase the sample or rerun after the next release, keeping the same method for comparison.",
      evidence
    });
  }
  return results.slice(0, 6);
}
function evidenceRef2(review) {
  return {
    reviewId: review.reviewId,
    rating: review.rating,
    excerpt: review.body.length > 220 ? `${review.body.slice(0, 217)}\u2026` : review.body,
    author: review.author,
    appVersion: review.appVersion,
    createdAt: review.createdAt,
    helpfulCount: review.helpfulCount,
    sourceUrl: review.sourceUrl
  };
}
function evidenceScore2(review) {
  return (6 - review.rating) * 10 + Math.min(review.helpfulCount, 50) + Date.parse(review.createdAt) / 1e12;
}
function cleanText(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function toIso(value) {
  const date3 = value ? new Date(value) : /* @__PURE__ */ new Date();
  return Number.isNaN(date3.getTime()) ? (/* @__PURE__ */ new Date()).toISOString() : date3.toISOString();
}
function clampNumber(value, min, max, fallback) {
  const number4 = Number(value);
  return Number.isFinite(number4) ? Math.min(max, Math.max(min, number4)) : fallback;
}
function stableId(value) {
  return (0, import_node_crypto2.createHash)("sha256").update(value).digest("hex").slice(0, 24);
}
function mean2(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function round2(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${value}%`;
}

// src/connector-registry.js
var ConnectorDefinitionError = class extends TypeError {
  constructor(message) {
    super(message);
    this.name = "ConnectorDefinitionError";
  }
};
var ConnectorNotFoundError = class extends Error {
  constructor(source) {
    super(`No connector is registered for store: ${source?.store ?? "unknown"}`);
    this.name = "ConnectorNotFoundError";
    this.source = source;
  }
};
var ConnectorRegistry = class {
  #connectors = /* @__PURE__ */ new Map();
  constructor(connectors = []) {
    for (const connector of connectors) this.register(connector);
  }
  register(connector) {
    validateConnector(connector);
    if (this.#connectors.has(connector.id)) throw new ConnectorDefinitionError(`Connector id already registered: ${connector.id}`);
    this.#connectors.set(connector.id, Object.freeze({ ...connector }));
    return this;
  }
  unregister(id) {
    return this.#connectors.delete(id);
  }
  get(id) {
    return this.#connectors.get(id) ?? null;
  }
  resolve(source) {
    for (const connector of this.#connectors.values()) {
      if (connector.supports(source)) return connector;
    }
    throw new ConnectorNotFoundError(source);
  }
  list() {
    return [...this.#connectors.values()].map(({ id, name, version: version2 }) => ({ id, name, version: version2 }));
  }
};
function defineConnector(connector) {
  validateConnector(connector);
  return Object.freeze({ ...connector });
}
function validateConnector(connector) {
  if (!connector || typeof connector !== "object") throw new ConnectorDefinitionError("A connector must be an object.");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(connector.id ?? "")) throw new ConnectorDefinitionError("Connector id must use lowercase letters, numbers, and hyphens.");
  if (typeof connector.name !== "string" || !connector.name.trim()) throw new ConnectorDefinitionError("Connector name is required.");
  if (typeof connector.supports !== "function") throw new ConnectorDefinitionError("Connector supports(source) must be a function.");
  if (typeof connector.fetch !== "function") throw new ConnectorDefinitionError("Connector fetch(source, options) must be a function.");
}

// src/version.js
var VERSION = "0.5.4";

// src/connectors/errors.js
var ConnectorError = class extends Error {
  constructor(store, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : void 0);
    this.name = "ConnectorError";
    this.store = store;
    this.status = options.status ?? 502;
    this.retryable = options.retryable ?? false;
  }
};

// src/connectors/apple.js
var MAX_RSS_PAGES = 10;
var PAGE_SIZE = 50;
var APP_STORE_PAGE_REVIEW_LIMIT = 10;
var USER_AGENT = `AppVerbatim/${VERSION} (+https://github.com/Nike232/app-verbatim-core)`;
var appleConnector = defineConnector({
  id: "apple-app-store",
  name: "Apple App Store public reviews",
  version: "2",
  supports: (source) => source?.store === "apple-app-store",
  fetch: fetchAppleReviews
});
async function fetchAppleReviews(source, options = {}) {
  const country = (options.country ?? source.country ?? "US").toLowerCase();
  const limit = clamp(options.limit ?? 300, 1, MAX_RSS_PAGES * PAGE_SIZE);
  const app2 = await fetchApp(source.appId, country, options);
  const reviews2 = [];
  let pagesFetched = 0;
  let publicEndpoint = "iTunes Customer Reviews RSS";
  let fallbackUsed = false;
  for (let page = 1; page <= Math.min(MAX_RSS_PAGES, Math.ceil(limit / PAGE_SIZE)); page += 1) {
    const url2 = `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${source.appId}/sortby=mostrecent/json`;
    const entries = await fetchReviewEntries(url2, options, page === 1 ? 2 : 1);
    if (!entries.length) break;
    pagesFetched += 1;
    for (const entry of entries) {
      if (!entry["im:rating"]?.label || !entry.content?.label) continue;
      reviews2.push(normalizeAppleEntry(entry, source, country));
      if (reviews2.length >= limit) break;
    }
    if (reviews2.length >= limit || entries.length < PAGE_SIZE) break;
  }
  if (!reviews2.length) {
    reviews2.push(...await fetchAppleReviewPage(source, country, { ...options, limit }));
    pagesFetched = 1;
    publicEndpoint = "App Store public reviews page";
    fallbackUsed = true;
  }
  return {
    app: {
      id: source.appId,
      name: app2.trackName ?? `App ${source.appId}`,
      icon: app2.artworkUrl100 ?? null,
      developer: app2.artistName ?? null,
      url: app2.trackViewUrl ?? source.canonicalUrl,
      store: "apple-app-store"
    },
    reviews: reviews2,
    metadata: {
      connector: appleConnector.id,
      connectorVersion: appleConnector.version,
      country: country.toUpperCase(),
      pagesFetched,
      publicEndpoint,
      fallbackUsed,
      requestedLimit: limit,
      returnedReviews: reviews2.length,
      versionDataAvailable: reviews2.some((review) => Boolean(review.appVersion))
    }
  };
}
async function fetchReviewEntries(url2, options, attempts) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetchWithRetry(url2, options);
    if (response.status === 404) return [];
    if (!response.ok) throw httpError("apple-app-store", "Apple review feed", response);
    const payload = await parseJson(response, "Apple review feed");
    const entries = Array.isArray(payload.feed?.entry) ? payload.feed.entry : [];
    if (entries.length || attempt === attempts) return entries;
    await delay(300 * attempt, options.signal);
  }
  return [];
}
function normalizeAppleEntry(entry, source, country = "us") {
  return normalizeReview({
    source: "apple-app-store",
    appId: source.appId,
    reviewId: entry.id?.label,
    title: entry.title?.label,
    body: entry.content?.label,
    rating: entry["im:rating"]?.label,
    appVersion: entry["im:version"]?.label,
    author: entry.author?.name?.label,
    country: country.toUpperCase(),
    sourceUrl: source.canonicalUrl,
    createdAt: entry.updated?.label,
    updatedAt: entry.updated?.label
  });
}
function normalizeApplePageReview(entry, source, country = "us", sourceUrl = source.canonicalUrl) {
  return normalizeReview({
    source: "apple-app-store",
    appId: source.appId,
    reviewId: entry.id,
    title: entry.title,
    body: entry.contents,
    rating: entry.rating,
    author: entry.reviewerName,
    country: country.toUpperCase(),
    sourceUrl,
    createdAt: entry.date,
    updatedAt: entry.date
  });
}
function parseAppleReviewPage(html, source, country = "us", limit = APP_STORE_PAGE_REVIEW_LIMIT) {
  const match = String(html).match(/<script[^>]*\bid=(?:"|')?serialized-server-data(?:"|')?[^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return [];
  let payload;
  try {
    payload = JSON.parse(match[1]);
  } catch (error) {
    throw new ConnectorError("apple-app-store", "Apple public reviews page returned invalid embedded data.", { cause: error, retryable: true });
  }
  const pageUrl = appleReviewPageUrl(source.appId, country);
  const reviews2 = [];
  const reviewIds = /* @__PURE__ */ new Set();
  const queue = [payload];
  for (let cursor = 0; cursor < queue.length && reviews2.length < limit; cursor += 1) {
    const value = queue[cursor];
    if (!value || typeof value !== "object") continue;
    if (value.$kind === "Review") {
      const id = String(value.id ?? "").trim();
      const rating = Number(value.rating);
      const body = String(value.contents ?? "").trim();
      if (id && body && rating >= 1 && rating <= 5 && !reviewIds.has(id)) {
        reviewIds.add(id);
        reviews2.push(normalizeApplePageReview(value, source, country, pageUrl));
      }
    }
    queue.push(...Array.isArray(value) ? value : Object.values(value));
  }
  return reviews2;
}
async function fetchAppleReviewPage(source, country, options) {
  const response = await fetchWithRetry(appleReviewPageUrl(source.appId, country), {
    ...options,
    accept: "text/html,application/xhtml+xml"
  });
  if (!response.ok) throw httpError("apple-app-store", "Apple public reviews page", response);
  const reviews2 = parseAppleReviewPage(await response.text(), source, country, Math.min(options.limit, APP_STORE_PAGE_REVIEW_LIMIT));
  if (!reviews2.length) {
    throw new ConnectorError("apple-app-store", "Apple public review sources returned no reviews.", { status: 502, retryable: true });
  }
  return reviews2;
}
function appleReviewPageUrl(appId, country) {
  return `https://apps.apple.com/${country}/app/${appId}?see-all=reviews&platform=iphone`;
}
async function fetchApp(appId, country, options) {
  const response = await fetchWithRetry(`https://itunes.apple.com/lookup?id=${appId}&country=${country}`, options);
  if (!response.ok) throw httpError("apple-app-store", "Apple app lookup", response);
  const payload = await parseJson(response, "Apple app lookup");
  if (!payload.results?.[0]) throw new ConnectorError("apple-app-store", "App Store application not found.", { status: 404 });
  return payload.results[0];
}
async function fetchWithRetry(url2, options) {
  const attempts = clamp(options.attempts ?? 3, 1, 5);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const timeoutSignal = AbortSignal.timeout(clamp(options.timeoutMs ?? 2e4, 1e3, 6e4));
      const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
      const response = await (options.fetch ?? fetch)(url2, {
        signal,
        headers: {
          accept: options.accept ?? "application/json",
          "cache-control": "no-cache",
          "user-agent": options.userAgent ?? USER_AGENT,
          ...options.headers
        }
      });
      if (!isRetryableStatus(response.status) || attempt === attempts) return response;
      await delay(retryDelay(response, attempt), options.signal);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      lastError = error;
      if (attempt === attempts) break;
      await delay(250 * 2 ** (attempt - 1), options.signal);
    }
  }
  throw new ConnectorError("apple-app-store", `Apple request failed: ${lastError?.message ?? "network error"}`, { retryable: true, cause: lastError });
}
function retryDelay(response, attempt) {
  const seconds = Number.parseInt(response.headers.get("retry-after") ?? "", 10);
  return Number.isFinite(seconds) ? Math.min(seconds * 1e3, 1e4) : 250 * 2 ** (attempt - 1);
}
function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Request aborted."));
    }, { once: true });
  });
}
function httpError(store, label, response) {
  return new ConnectorError(store, `${label} returned HTTP ${response.status}.`, {
    status: response.status,
    retryable: isRetryableStatus(response.status)
  });
}
async function parseJson(response, label) {
  try {
    return await response.json();
  } catch (error) {
    throw new ConnectorError("apple-app-store", `${label} returned invalid JSON.`, { cause: error });
  }
}
function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}
function clamp(value, min, max) {
  const number4 = Number.parseInt(value, 10);
  return Number.isInteger(number4) ? Math.min(max, Math.max(min, number4)) : min;
}

// src/connectors/demo.js
var templates = [
  [1, "The app crashes every time I open the analytics tab after version 4.8.", "stability"],
  [2, "Sync stopped working after the update and my saved project disappeared.", "sync"],
  [1, "Subscription price doubled and the restore purchase button does nothing.", "pricing"],
  [2, "Notifications arrive hours late, so reminders are no longer useful.", "notifications"],
  [3, "The new navigation is confusing. I cannot find exports anymore.", "usability"],
  [4, "Please add CSV export and a weekly email summary for the team.", "request"],
  [2, "Login verification code never arrives when I use a custom email domain.", "account"],
  [1, "Battery drain is severe and the phone gets hot while syncing.", "performance"],
  [5, "Clean interface and the new search is much faster. Great update.", "praise"],
  [4, "Would love filters by version and country in the next release.", "request"],
  [2, "The app freezes on launch unless I reinstall it.", "stability"],
  [3, "Too many permission prompts before I can try the product.", "privacy"]
];
var demoConnector = defineConnector({
  id: "demo",
  name: "Deterministic offline demo",
  version: "1",
  supports: (source) => source?.store === "demo",
  fetch: (source, options = {}) => Promise.resolve(source?.appId === "competitor" ? createDemoCompetitorDataset(options.limit) : createDemoDataset(options.limit))
});
function createDemoDataset(limit = 96) {
  const count = clamp2(limit, 1, 500);
  const anchor = Date.parse("2026-08-23T09:00:00.000Z");
  const reviews2 = Array.from({ length: count }, (_, index) => {
    const [rating, text, tag] = templates[index % templates.length];
    const currentRelease = index < 36;
    const previousRelease = index >= 36 && index < 68;
    const recentStability = currentRelease && index % 3 === 0;
    const novelCameraIssue = currentRelease && index % 7 === 2 && index % 3 !== 0;
    return normalizeReview({
      source: "google-play",
      appId: "com.demo.pulse",
      reviewId: `demo-${index + 1}`,
      title: tag === "praise" ? "A thoughtful update" : null,
      body: novelCameraIssue ? "Camera uploads rotate every portrait photo sideways after saving." : recentStability ? `Since 4.8.0 the app crashes during normal use. ${text}` : text,
      rating: novelCameraIssue || recentStability ? 1 : previousRelease ? Math.min(5, rating + 1) : rating,
      language: "en",
      country: ["US", "GB", "CA", "AU"][index % 4],
      appVersion: index < 36 ? "4.8.0" : index < 68 ? "4.7.2" : "4.6.9",
      author: `Sample user ${index + 1}`,
      helpfulCount: index * 7 % 43,
      sourceUrl: "https://play.google.com/store/apps/details?id=com.demo.pulse",
      createdAt: new Date(anchor - index * 1.8 * 864e5).toISOString()
    });
  });
  return {
    app: { id: "com.demo.pulse", name: "Pulse Notes", icon: null, developer: "Northstar Studio", url: "https://play.google.com/store/apps/details?id=com.demo.pulse", store: "google-play" },
    reviews: reviews2,
    metadata: { connector: "demo", connectorVersion: "1", fixture: true, scenario: "4.8 stability regression" }
  };
}
function createDemoCompetitorDataset(limit = 84) {
  const base = createDemoDataset(limit ?? 84);
  const replacements = [
    "The subscription is too expensive and every useful feature is behind a paywall.",
    "I was charged after cancelling the trial and support would not refund it.",
    "Please add a monthly plan. The annual subscription is too expensive.",
    "The price keeps increasing but basic export still requires another payment."
  ];
  return {
    app: { id: "com.demo.orbit", name: "Orbit Journal", icon: null, developer: "Orbit Labs", url: "https://play.google.com/store/apps/details?id=com.demo.orbit", store: "google-play" },
    reviews: base.reviews.map((review, index) => ({
      ...review,
      appId: "com.demo.orbit",
      reviewId: `competitor-${index + 1}`,
      body: index % 3 === 0 ? replacements[index % replacements.length] : review.body.replaceAll("4.8.0", "7.2.0"),
      rating: index % 3 === 0 ? 1 : review.rating,
      appVersion: index < 30 ? "7.2.0" : "7.1.4",
      sourceUrl: "https://play.google.com/store/apps/details?id=com.demo.orbit"
    })),
    metadata: { connector: "demo", connectorVersion: "1", fixture: true, scenario: "competitor pricing complaints" }
  };
}
function clamp2(value, min, max) {
  const number4 = Number.parseInt(value ?? "", 10);
  return Number.isInteger(number4) ? Math.min(max, Math.max(min, number4)) : 96;
}

// node_modules/zod/v4/core/core.js
var _a;
// @__NO_SIDE_EFFECTS__
function $constructor(name, initializer2, params) {
  function init(inst, def) {
    if (!inst._zod) {
      Object.defineProperty(inst, "_zod", {
        value: {
          def,
          constr: _,
          traits: /* @__PURE__ */ new Set()
        },
        enumerable: false
      });
    }
    if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer2(inst, def);
    const proto = _.prototype;
    const keys = Object.keys(proto);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = params?.Parent ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a2;
    const inst = params?.Parent ? new Definition() : this;
    init(inst, def);
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      if (params?.Parent && inst instanceof params.Parent)
        return true;
      return inst?._zod?.traits?.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
var $ZodAsyncError = class extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
};
(_a = globalThis).__zod_globalConfig ?? (_a.__zod_globalConfig = {});
var globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  if (newConfig)
    Object.assign(globalConfig, newConfig);
  return globalConfig;
}

// node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  const set = false;
  return {
    get value() {
      if (!set) {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
      throw new Error("cached value already set");
    }
  };
}
function nullish(input2) {
  return input2 === null || input2 === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
var EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
var captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
var propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || params?.parent)
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if (params?.message !== void 0) {
    if (params?.error !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function optionalKeys(shape2) {
  return Object.keys(shape2).filter((k) => {
    return shape2[k]._zod.optin === "optional" && shape2[k]._zod.optout === "optional";
  });
}
var NUMBER_FORMAT_RANGES = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape2) {
  if (!isPlainObject(shape2)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = schema._zod.def.shape;
    for (const key in shape2) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape2 };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (x.issues[i]?.continue === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path2, issues) {
  return issues.map((iss) => {
    var _a2;
    (_a2 = iss).path ?? (_a2.path = []);
    iss.path.unshift(path2);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config2) {
  const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config2.customError?.(iss)) ?? unwrapMessage(config2.localeError?.(iss)) ?? "Invalid input";
  const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
  rest.path ?? (rest.path = []);
  rest.message = message;
  if (ctx?.reportInput) {
    rest.input = _input;
  }
  return rest;
}
function getLengthableOrigin(input2) {
  if (Array.isArray(input2))
    return "array";
  if (typeof input2 === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input2, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input: input2,
      inst
    };
  }
  return { ...iss };
}

// node_modules/zod/v4/core/errors.js
var initializer = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
};
var $ZodError = $constructor("$ZodError", initializer);
var $ZodRealError = $constructor("$ZodError", initializer, { Parent: Error });

// node_modules/zod/v4/core/parse.js
var _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  if (result.issues.length) {
    const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params?.callee);
    throw e;
  }
  return result.value;
};
var parse = /* @__PURE__ */ _parse($ZodRealError);
var _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params?.callee);
    throw e;
  }
  return result.value;
};
var parseAsync = /* @__PURE__ */ _parseAsync($ZodRealError);
var _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParse = /* @__PURE__ */ _safeParse($ZodRealError);
var _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
var safeParseAsync = /* @__PURE__ */ _safeParseAsync($ZodRealError);

// node_modules/zod/v4/core/regexes.js
var duration = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
var httpProtocol = /^https?$/;
var dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
var date = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime(args) {
  const time3 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const timeRegex = `${time3}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
var string = (params) => {
  const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
var integer = /^-?\d+$/;
var number = /^-?\d+(?:\.\d+)?$/;
var boolean = /^(?:true|false)$/i;
var _null = /^null$/i;

// node_modules/zod/v4/core/checks.js
var $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a2;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a2 = inst._zod).onattach ?? (_a2.onattach = []);
});
var numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
var $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = def.format?.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input2 = payload.value;
    if (isInt) {
      if (!Number.isInteger(input2)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input: input2,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input2)) {
        if (input2 > 0) {
          payload.issues.push({
            input: input2,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input: input2,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input2 < minimum) {
      payload.issues.push({
        origin: "number",
        input: input2,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input2 > maximum) {
      payload.issues.push({
        origin: "number",
        input: input2,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input2 = payload.value;
    const length = input2.length;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input2);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input: input2,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input2 = payload.value;
    const length = input2.length;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input2);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input: input2,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a2;
  $ZodCheck.init(inst, def);
  (_a2 = inst._zod.def).when ?? (_a2.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input2 = payload.value;
    const length = input2.length;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input2);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
var $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a2, _b;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a2 = inst._zod).check ?? (_a2.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
var $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});

// node_modules/zod/v4/core/versions.js
var version = {
  major: 4,
  minor: 4,
  patch: 3
};

// node_modules/zod/v4/core/schemas.js
var $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a2;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const checks = [...inst._zod.def.checks ?? []];
  if (inst._zod.traits.has("$ZodCheck")) {
    checks.unshift(inst);
  }
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a2 = inst._zod).deferred ?? (_a2.deferred = []);
    inst._zod.deferred?.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && ctx?.async === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
  defineLazy(inst, "~standard", () => ({
    validate: (value) => {
      try {
        const r = safeParse(inst, value);
        return r.success ? { value: r.data } : { issues: r.error?.issues };
      } catch (_) {
        return safeParseAsync(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
      }
    },
    vendor: "zod",
    version: 1
  }));
});
var $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
var $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
var $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    try {
      const trimmed = payload.value.trim();
      if (!def.normalize && def.protocol?.source === httpProtocol.source) {
        if (!/^https?:\/\//i.test(trimmed)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid URL format",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
      }
      const url2 = new URL(trimmed);
      if (def.hostname) {
        def.hostname.lastIndex = 0;
        if (!def.hostname.test(url2.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.protocol) {
        def.protocol.lastIndex = 0;
        if (!def.protocol.test(url2.protocol.endsWith(":") ? url2.protocol.slice(0, -1) : url2.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.normalize) {
        payload.value = url2.href;
      } else {
        payload.value = trimmed;
      }
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
var $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date);
  $ZodStringFormat.init(inst, def);
});
var $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time(def));
  $ZodStringFormat.init(inst, def);
});
var $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration);
  $ZodStringFormat.init(inst, def);
});
var $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input2 = payload.value;
    if (typeof input2 === "number" && !Number.isNaN(input2) && Number.isFinite(input2)) {
      return payload;
    }
    const received = typeof input2 === "number" ? Number.isNaN(input2) ? "NaN" : !Number.isFinite(input2) ? "Infinity" : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input: input2,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
var $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
var $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input2 = payload.value;
    if (typeof input2 === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input: input2,
      inst
    });
    return payload;
  };
});
var $ZodNull = /* @__PURE__ */ $constructor("$ZodNull", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = _null;
  inst._zod.values = /* @__PURE__ */ new Set([null]);
  inst._zod.parse = (payload, _ctx) => {
    const input2 = payload.value;
    if (input2 === null)
      return payload;
    payload.issues.push({
      expected: "null",
      code: "invalid_type",
      input: input2,
      inst
    });
    return payload;
  };
});
var $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
var $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input2 = payload.value;
    if (!Array.isArray(input2)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input: input2,
        inst
      });
      return payload;
    }
    payload.value = Array(input2.length);
    const proms = [];
    for (let i = 0; i < input2.length; i++) {
      const item = input2[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input2, isOptionalIn, isOptionalOut) {
  const isPresent = key in input2;
  if (result.issues.length) {
    if (isOptionalIn && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && !isOptionalIn) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input2, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const isOptionalIn = _catchall.optin === "optional";
  const isOptionalOut = _catchall.optout === "optional";
  for (const key in input2) {
    if (key === "__proto__")
      continue;
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input2[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input2, isOptionalIn, isOptionalOut)));
    } else {
      handlePropertyResult(r, payload, key, input2, isOptionalIn, isOptionalOut);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input: input2,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
var $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!desc?.get) {
    const sh = def.shape;
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazy(inst._zod, "propValues", () => {
    const shape2 = def.shape;
    const propValues = {};
    for (const key in shape2) {
      const field = shape2[key]._zod;
      if (field.values) {
        propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
        for (const v of field.values)
          propValues[key].add(v);
      }
    }
    return propValues;
  });
  const isObject2 = isObject;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input2 = payload.value;
    if (!isObject2(input2)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input: input2,
        inst
      });
      return payload;
    }
    payload.value = {};
    const proms = [];
    const shape2 = value.shape;
    for (const key of value.keys) {
      const el = shape2[key];
      const isOptionalIn = el._zod.optin === "optional";
      const isOptionalOut = el._zod.optout === "optional";
      const r = el._zod.run({ value: input2[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input2, isOptionalIn, isOptionalOut)));
      } else {
        handlePropertyResult(r, payload, key, input2, isOptionalIn, isOptionalOut);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input2, payload, ctx, _normalized.value, inst);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
var $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "values", () => {
    if (def.options.every((o) => o._zod.values)) {
      return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    if (def.options.every((o) => o._zod.pattern)) {
      const patterns = def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
var $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
  def.inclusive = false;
  $ZodUnion.init(inst, def);
  const _super = inst._zod.parse;
  defineLazy(inst._zod, "propValues", () => {
    const propValues = {};
    for (const option of def.options) {
      const pv = option._zod.propValues;
      if (!pv || Object.keys(pv).length === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
      for (const [k, v] of Object.entries(pv)) {
        if (!propValues[k])
          propValues[k] = /* @__PURE__ */ new Set();
        for (const val of v) {
          propValues[k].add(val);
        }
      }
    }
    return propValues;
  });
  const disc = cached(() => {
    const opts = def.options;
    const map = /* @__PURE__ */ new Map();
    for (const o of opts) {
      const values = o._zod.propValues?.[def.discriminator];
      if (!values || values.size === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
      for (const v of values) {
        if (map.has(v)) {
          throw new Error(`Duplicate discriminator value "${String(v)}"`);
        }
        map.set(v, o);
      }
    }
    return map;
  });
  inst._zod.parse = (payload, ctx) => {
    const input2 = payload.value;
    if (!isObject(input2)) {
      payload.issues.push({
        code: "invalid_type",
        expected: "object",
        input: input2,
        inst
      });
      return payload;
    }
    const opt = disc.value.get(input2?.[def.discriminator]);
    if (opt) {
      return opt._zod.run(payload, ctx);
    }
    if (def.unionFallback || ctx.direction === "backward") {
      return _super(payload, ctx);
    }
    payload.issues.push({
      code: "invalid_union",
      errors: [],
      note: "No matching discriminator",
      discriminator: def.discriminator,
      options: Array.from(disc.value.keys()),
      input: input2,
      path: [def.discriminator],
      inst
    });
    return payload;
  };
});
var $ZodTuple = /* @__PURE__ */ $constructor("$ZodTuple", (inst, def) => {
  $ZodType.init(inst, def);
  const items = def.items;
  inst._zod.parse = (payload, ctx) => {
    const input2 = payload.value;
    if (!Array.isArray(input2)) {
      payload.issues.push({
        input: input2,
        inst,
        expected: "tuple",
        code: "invalid_type"
      });
      return payload;
    }
    payload.value = [];
    const proms = [];
    const optinStart = getTupleOptStart(items, "optin");
    const optoutStart = getTupleOptStart(items, "optout");
    if (!def.rest) {
      if (input2.length < optinStart) {
        payload.issues.push({
          code: "too_small",
          minimum: optinStart,
          inclusive: true,
          input: input2,
          inst,
          origin: "array"
        });
        return payload;
      }
      if (input2.length > items.length) {
        payload.issues.push({
          code: "too_big",
          maximum: items.length,
          inclusive: true,
          input: input2,
          inst,
          origin: "array"
        });
      }
    }
    const itemResults = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      const r = items[i]._zod.run({ value: input2[i], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((rr) => {
          itemResults[i] = rr;
        }));
      } else {
        itemResults[i] = r;
      }
    }
    if (def.rest) {
      let i = items.length - 1;
      const rest = input2.slice(items.length);
      for (const el of rest) {
        i++;
        const result = def.rest._zod.run({ value: el, issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((r) => handleTupleResult(r, payload, i)));
        } else {
          handleTupleResult(result, payload, i);
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => handleTupleResults(itemResults, payload, items, input2, optoutStart));
    }
    return handleTupleResults(itemResults, payload, items, input2, optoutStart);
  };
});
function getTupleOptStart(items, key) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]._zod[key] !== "optional")
      return i + 1;
  }
  return 0;
}
function handleTupleResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handleTupleResults(itemResults, final, items, input2, optoutStart) {
  for (let i = 0; i < items.length; i++) {
    const r = itemResults[i];
    const isPresent = i < input2.length;
    if (r.issues.length) {
      if (!isPresent && i >= optoutStart) {
        final.value.length = i;
        break;
      }
      final.issues.push(...prefixIssues(i, r.issues));
    }
    final.value[i] = r.value;
  }
  for (let i = final.value.length - 1; i >= input2.length; i--) {
    if (items[i]._zod.optout === "optional" && final.value[i] === void 0) {
      final.value.length = i;
    } else {
      break;
    }
  }
  return final;
}
var $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input2 = payload.value;
    if (!isPlainObject(input2)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input: input2,
        inst
      });
      return payload;
    }
    const proms = [];
    const values = def.keyType._zod.values;
    if (values) {
      payload.value = {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            continue;
          }
          const outKey = keyResult.value;
          const result = def.valueType._zod.run({ value: input2[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input2) {
        if (!recordKeys.has(key)) {
          unrecognized = unrecognized ?? [];
          unrecognized.push(key);
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input: input2,
          inst,
          keys: unrecognized
        });
      }
    } else {
      payload.value = {};
      for (const key of Reflect.ownKeys(input2)) {
        if (key === "__proto__")
          continue;
        if (!Object.prototype.propertyIsEnumerable.call(input2, key))
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input2[key];
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const result = def.valueType._zod.run({ value: input2[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[keyResult.value] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[keyResult.value] = result.value;
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
var $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input2 = payload.value;
    if (valuesSet.has(input2)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input: input2,
      inst
    });
    return payload;
  };
});
var $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  if (def.values.length === 0) {
    throw new Error("Cannot create literal schema with no valid values");
  }
  const values = new Set(def.values);
  inst._zod.values = values;
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input2 = payload.value;
    if (values.has(input2)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input: input2,
      inst
    });
    return payload;
  };
});
function handleOptionalResult(result, input2) {
  if (input2 === void 0 && (result.issues.length || result.fallback)) {
    return { issues: [], value: void 0 };
  }
  return result;
}
var $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.optout = "optional";
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (def.innerType._zod.optin === "optional") {
      const input2 = payload.value;
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise)
        return result.then((r) => handleOptionalResult(r, input2));
      return handleOptionalResult(result, input2);
    }
    if (payload.value === void 0) {
      return payload;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
var $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
var $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input2 = payload.value;
    const r = def.fn(input2);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input2, inst));
    }
    handleRefineResult(r, payload, input2, inst);
    return;
  };
});
function handleRefineResult(result, payload, input2, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input: input2,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}

// node_modules/zod/v4/core/api.js
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
  return new Class({
    type: "string",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
  return new Class({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
  return new Class({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
  return new Class({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
  return new Class({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
  return new Class({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
  return new Class({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
  return new Class({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
  return new Class({
    type: "boolean",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _null2(Class, params) {
  return new Class({
    type: "null",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _positive(params) {
  return /* @__PURE__ */ _gt(0, params);
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _custom(Class, fn, _params) {
  const norm = normalizeParams(_params);
  norm.abort ?? (norm.abort = true);
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...norm
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}

// node_modules/zod/v4/mini/schemas.js
var ZodMiniType = /* @__PURE__ */ $constructor("ZodMiniType", (inst, def) => {
  if (!inst._zod)
    throw new Error("Uninitialized schema in ZodMiniType.");
  $ZodType.init(inst, def);
  inst.def = def;
  inst.type = def.type;
  inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
  inst.safeParse = (data, params) => safeParse(inst, data, params);
  inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
  inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
  inst.check = (...checks) => {
    return inst.clone({
      ...def,
      checks: [
        ...def.checks ?? [],
        ...checks.map((ch) => typeof ch === "function" ? {
          _zod: { check: ch, def: { check: "custom" }, onattach: [] }
        } : ch)
      ]
    }, { parent: true });
  };
  inst.with = inst.check;
  inst.clone = (_def, params) => clone(inst, _def, params);
  inst.brand = () => inst;
  inst.register = ((reg, meta2) => {
    reg.add(inst, meta2);
    return inst;
  });
  inst.apply = (fn) => fn(inst);
});
var ZodMiniString = /* @__PURE__ */ $constructor("ZodMiniString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function string2(params) {
  return _string(ZodMiniString, params);
}
var ZodMiniStringFormat = /* @__PURE__ */ $constructor("ZodMiniStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  ZodMiniString.init(inst, def);
});
var ZodMiniURL = /* @__PURE__ */ $constructor("ZodMiniURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodMiniStringFormat.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function url(params) {
  return _url(ZodMiniURL, params);
}
var ZodMiniNumber = /* @__PURE__ */ $constructor("ZodMiniNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function number2(params) {
  return _number(ZodMiniNumber, params);
}
var ZodMiniNumberFormat = /* @__PURE__ */ $constructor("ZodMiniNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodMiniNumber.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function int(params) {
  return _int(ZodMiniNumberFormat, params);
}
var ZodMiniBoolean = /* @__PURE__ */ $constructor("ZodMiniBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function boolean2(params) {
  return _boolean(ZodMiniBoolean, params);
}
var ZodMiniNull = /* @__PURE__ */ $constructor("ZodMiniNull", (inst, def) => {
  $ZodNull.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function _null3(params) {
  return _null2(ZodMiniNull, params);
}
var ZodMiniUnknown = /* @__PURE__ */ $constructor("ZodMiniUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function unknown() {
  return _unknown(ZodMiniUnknown);
}
var ZodMiniArray = /* @__PURE__ */ $constructor("ZodMiniArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function array(element, params) {
  return new ZodMiniArray({
    type: "array",
    element,
    ...normalizeParams(params)
  });
}
var ZodMiniObject = /* @__PURE__ */ $constructor("ZodMiniObject", (inst, def) => {
  $ZodObject.init(inst, def);
  ZodMiniType.init(inst, def);
  defineLazy(inst, "shape", () => def.shape);
});
// @__NO_SIDE_EFFECTS__
function object(shape2, params) {
  const def = {
    type: "object",
    shape: shape2 ?? {},
    ...normalizeParams(params)
  };
  return new ZodMiniObject(def);
}
// @__NO_SIDE_EFFECTS__
function extend2(schema, shape2) {
  return extend(schema, shape2);
}
// @__NO_SIDE_EFFECTS__
function pick2(schema, mask) {
  return pick(schema, mask);
}
// @__NO_SIDE_EFFECTS__
function omit2(schema, mask) {
  return omit(schema, mask);
}
var ZodMiniUnion = /* @__PURE__ */ $constructor("ZodMiniUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function union(options, params) {
  return new ZodMiniUnion({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
var ZodMiniDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodMiniDiscriminatedUnion", (inst, def) => {
  $ZodDiscriminatedUnion.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function discriminatedUnion(discriminator, options, params) {
  return new ZodMiniDiscriminatedUnion({
    type: "union",
    options,
    discriminator,
    ...normalizeParams(params)
  });
}
var ZodMiniTuple = /* @__PURE__ */ $constructor("ZodMiniTuple", (inst, def) => {
  $ZodTuple.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function tuple(items, _paramsOrRest, _params) {
  const hasRest = _paramsOrRest instanceof $ZodType;
  const params = hasRest ? _params : _paramsOrRest;
  const rest = hasRest ? _paramsOrRest : null;
  return new ZodMiniTuple({
    type: "tuple",
    items,
    rest,
    ...normalizeParams(params)
  });
}
var ZodMiniRecord = /* @__PURE__ */ $constructor("ZodMiniRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodMiniRecord({
      type: "record",
      keyType: /* @__PURE__ */ string2(),
      valueType: keyType,
      ...normalizeParams(valueType)
    });
  }
  return new ZodMiniRecord({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
var ZodMiniEnum = /* @__PURE__ */ $constructor("ZodMiniEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodMiniType.init(inst, def);
  inst.options = Object.values(def.entries);
});
// @__NO_SIDE_EFFECTS__
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodMiniEnum({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
var ZodMiniLiteral = /* @__PURE__ */ $constructor("ZodMiniLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function literal(value, params) {
  return new ZodMiniLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
var ZodMiniOptional = /* @__PURE__ */ $constructor("ZodMiniOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function optional(innerType) {
  return new ZodMiniOptional({
    type: "optional",
    innerType
  });
}
var ZodMiniNullable = /* @__PURE__ */ $constructor("ZodMiniNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function nullable(innerType) {
  return new ZodMiniNullable({
    type: "nullable",
    innerType
  });
}
var ZodMiniDefault = /* @__PURE__ */ $constructor("ZodMiniDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function _default(innerType, defaultValue) {
  return new ZodMiniDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
var ZodMiniCustom = /* @__PURE__ */ $constructor("ZodMiniCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodMiniType.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function custom(fn, _params) {
  return _custom(ZodMiniCustom, fn ?? (() => true), _params);
}
// @__NO_SIDE_EFFECTS__
function refine(fn, _params = {}) {
  return _refine(ZodMiniCustom, fn, _params);
}

// node_modules/zod/v4/mini/iso.js
var iso_exports = {};
__export(iso_exports, {
  ZodMiniISODate: () => ZodMiniISODate,
  ZodMiniISODateTime: () => ZodMiniISODateTime,
  ZodMiniISODuration: () => ZodMiniISODuration,
  ZodMiniISOTime: () => ZodMiniISOTime,
  date: () => date2,
  datetime: () => datetime2,
  duration: () => duration2,
  time: () => time2
});
var ZodMiniISODateTime = /* @__PURE__ */ $constructor("ZodMiniISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodMiniStringFormat.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function datetime2(params) {
  return _isoDateTime(ZodMiniISODateTime, params);
}
var ZodMiniISODate = /* @__PURE__ */ $constructor("ZodMiniISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodMiniStringFormat.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function date2(params) {
  return _isoDate(ZodMiniISODate, params);
}
var ZodMiniISOTime = /* @__PURE__ */ $constructor("ZodMiniISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodMiniStringFormat.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function time2(params) {
  return _isoTime(ZodMiniISOTime, params);
}
var ZodMiniISODuration = /* @__PURE__ */ $constructor("ZodMiniISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodMiniStringFormat.init(inst, def);
});
// @__NO_SIDE_EFFECTS__
function duration2(params) {
  return _isoDuration(ZodMiniISODuration, params);
}

// node_modules/lru-cache/dist/esm/node/index.min.js
var import_node_diagnostics_channel = require("node:diagnostics_channel");
var S = (0, import_node_diagnostics_channel.channel)("lru-cache:metrics");
var W = (0, import_node_diagnostics_channel.tracingChannel)("lru-cache");
var L = typeof performance == "object" && performance && typeof performance.now == "function" ? performance : Date;
var M = typeof process == "object" && process ? process : {};

// node_modules/@mradex77/google-play-scraper/dist/index.js
var BASE_URL = "https://play.google.com";
var clusters = {
  new: "new",
  top: "top"
};
var category = {
  APPLICATION: "APPLICATION",
  ANDROID_WEAR: "ANDROID_WEAR",
  ART_AND_DESIGN: "ART_AND_DESIGN",
  AUTO_AND_VEHICLES: "AUTO_AND_VEHICLES",
  BEAUTY: "BEAUTY",
  BOOKS_AND_REFERENCE: "BOOKS_AND_REFERENCE",
  BUSINESS: "BUSINESS",
  COMICS: "COMICS",
  COMMUNICATION: "COMMUNICATION",
  DATING: "DATING",
  EDUCATION: "EDUCATION",
  ENTERTAINMENT: "ENTERTAINMENT",
  EVENTS: "EVENTS",
  FINANCE: "FINANCE",
  FOOD_AND_DRINK: "FOOD_AND_DRINK",
  HEALTH_AND_FITNESS: "HEALTH_AND_FITNESS",
  HOUSE_AND_HOME: "HOUSE_AND_HOME",
  LIBRARIES_AND_DEMO: "LIBRARIES_AND_DEMO",
  LIFESTYLE: "LIFESTYLE",
  MAPS_AND_NAVIGATION: "MAPS_AND_NAVIGATION",
  MEDICAL: "MEDICAL",
  MUSIC_AND_AUDIO: "MUSIC_AND_AUDIO",
  NEWS_AND_MAGAZINES: "NEWS_AND_MAGAZINES",
  PARENTING: "PARENTING",
  PERSONALIZATION: "PERSONALIZATION",
  PHOTOGRAPHY: "PHOTOGRAPHY",
  PRODUCTIVITY: "PRODUCTIVITY",
  SHOPPING: "SHOPPING",
  SOCIAL: "SOCIAL",
  SPORTS: "SPORTS",
  TOOLS: "TOOLS",
  TRAVEL_AND_LOCAL: "TRAVEL_AND_LOCAL",
  VIDEO_PLAYERS: "VIDEO_PLAYERS",
  WATCH_FACE: "WATCH_FACE",
  WEATHER: "WEATHER",
  GAME: "GAME",
  GAME_ACTION: "GAME_ACTION",
  GAME_ADVENTURE: "GAME_ADVENTURE",
  GAME_ARCADE: "GAME_ARCADE",
  GAME_BOARD: "GAME_BOARD",
  GAME_CARD: "GAME_CARD",
  GAME_CASINO: "GAME_CASINO",
  GAME_CASUAL: "GAME_CASUAL",
  GAME_EDUCATIONAL: "GAME_EDUCATIONAL",
  GAME_MUSIC: "GAME_MUSIC",
  GAME_PUZZLE: "GAME_PUZZLE",
  GAME_RACING: "GAME_RACING",
  GAME_ROLE_PLAYING: "GAME_ROLE_PLAYING",
  GAME_SIMULATION: "GAME_SIMULATION",
  GAME_SPORTS: "GAME_SPORTS",
  GAME_STRATEGY: "GAME_STRATEGY",
  GAME_TRIVIA: "GAME_TRIVIA",
  GAME_WORD: "GAME_WORD",
  FAMILY: "FAMILY",
  FAMILY_ACTION: "FAMILY_ACTION",
  FAMILY_BRAINGAMES: "FAMILY_BRAINGAMES",
  FAMILY_CREATE: "FAMILY_CREATE",
  FAMILY_EDUCATION: "FAMILY_EDUCATION",
  FAMILY_MUSICVIDEO: "FAMILY_MUSICVIDEO",
  FAMILY_PRETEND: "FAMILY_PRETEND"
};
var collection = {
  TOP_FREE: "TOP_FREE",
  TOP_PAID: "TOP_PAID",
  GROSSING: "GROSSING"
};
var sort = {
  NEWEST: 2,
  RATING: 3,
  HELPFULNESS: 1
};
var age = {
  FIVE_UNDER: "AGE_RANGE1",
  SIX_EIGHT: "AGE_RANGE2",
  NINE_UP: "AGE_RANGE3"
};
var permission = {
  COMMON: 0,
  OTHER: 1
};
Object.freeze(clusters);
Object.freeze(category);
Object.freeze(collection);
Object.freeze(sort);
Object.freeze(age);
Object.freeze(permission);
var GooglePlayError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "GooglePlayError";
  }
};
var ValidationError = class ValidationError2 extends GooglePlayError {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
  static fromZod(error, context) {
    const details = error.issues.map((issue2) => {
      const path2 = issue2.path.join(".");
      return path2 ? `${path2}: ${issue2.message}` : issue2.message;
    }).join("; ");
    return new ValidationError2(`${context}: ${details}`);
  }
};
var HttpError = class extends GooglePlayError {
  status;
  url;
  constructor(message, status, url2) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.url = url2;
  }
};
var NotFoundError = class extends HttpError {
  constructor(message, status, url2) {
    super(message, status, url2);
    this.name = "NotFoundError";
  }
};
var RateLimitError = class extends HttpError {
  constructor(message, status, url2) {
    super(message, status, url2);
    this.name = "RateLimitError";
  }
};
var BlockedError = class extends GooglePlayError {
  constructor(message) {
    super(message);
    this.name = "BlockedError";
  }
};
var ParseError = class extends GooglePlayError {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
};
var SpecError = class SpecError2 extends ParseError {
  context;
  failures;
  constructor(context, failures) {
    super(SpecError2.buildMessage(context, failures));
    this.name = "SpecError";
    this.context = context;
    this.failures = failures;
  }
  static buildMessage(context, failures) {
    const lines = failures.map((failure) => {
      const paths = failure.paths.map((path2) => `[${path2.join(", ")}]`).join(" | ");
      return `  ${failure.field} (${paths}): ${failure.message}`;
    });
    return [`${context} failed to parse ${failures.length.toString()} field(s):`, ...lines].join("\n");
  }
};
var requestOptionsSchema = object({
  headers: optional(record(string2(), string2())),
  fetchImpl: optional(custom((value) => typeof value === "function")),
  timeoutMs: optional(int().check(_positive(), _lte(12e4))),
  retries: optional(int().check(_gte(0), _lte(5))),
  signal: optional(custom((value) => value instanceof AbortSignal)),
  onRequest: optional(custom((value) => typeof value === "function")),
  onResponse: optional(custom((value) => typeof value === "function")),
  onRetry: optional(custom((value) => typeof value === "function"))
});
var baseOptionsSchema = object({
  lang: _default(string2().check(_minLength(2), _maxLength(7)), "en"),
  country: _default(string2().check(_length(2)), "us"),
  throttle: optional(number2().check(_positive(), _lte(50))),
  requestOptions: optional(requestOptionsSchema),
  onDegradation: optional(custom((value) => typeof value === "function")),
  onIntegrityEvent: optional(custom((value) => typeof value === "function"))
});
function normalizeCountry(country) {
  return country.toLowerCase();
}
function hasUniqueCountriesIgnoringCase(countries) {
  const normalized = countries.map(normalizeCountry);
  return new Set(normalized).size === normalized.length;
}
function parseOptions(schema, input2, context) {
  const result = safeParse(schema, input2);
  if (!result.success) throw ValidationError.fromZod(result.error, context);
  return result.data;
}
var COUNTRY_CODE_PATTERN = /^[a-z]{2}$/i;
var fetchImplSchema = custom((value) => typeof value === "function");
var countryFetchSettingsSchema = object({
  perCountry: record(string2().check(_regex(COUNTRY_CODE_PATTERN)), fetchImplSchema).check(refine((perCountry) => hasUniqueCountriesIgnoringCase(Object.keys(perCountry)), "country codes must be unique ignoring case")),
  fallback: optional(fetchImplSchema)
});
var appItemSchema = object({
  title: string2(),
  appId: string2(),
  url: string2(),
  icon: string2(),
  developer: string2(),
  developerId: optional(string2()),
  currency: optional(string2()),
  price: number2(),
  free: boolean2(),
  summary: optional(string2()),
  scoreText: optional(string2()),
  score: optional(number2().check(_gte(0), _lte(5)))
});
var DEFAULT_RETRIES = 2;
var DEFAULT_TIMEOUT_MS = 3e4;
var BASE_BACKOFF_MS = 500;
var THROTTLE_WINDOW_MS = 1e3;
var USER_AGENT2 = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
var ANY_MIME = "*";
var DEFAULT_HEADERS = {
  "User-Agent": USER_AGENT2,
  Accept: `text/html,${ANY_MIME}/${ANY_MIME}`,
  "Accept-Language": "en-US,en;q=0.9"
};
var FORM_CONTENT_TYPE = "application/x-www-form-urlencoded;charset=UTF-8";
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
function emit(hook, event) {
  if (hook === void 0) return;
  try {
    const result = hook(event);
    if (result instanceof Promise) result.catch(() => void 0);
  } catch {
    return;
  }
}
function createRateLimiter(rate) {
  let timestamps = [];
  let tail = Promise.resolve();
  const reserve = async () => {
    const now = Date.now();
    const windowStart = now - THROTTLE_WINDOW_MS;
    timestamps = timestamps.filter((timestamp) => timestamp > windowStart);
    if (timestamps.length >= rate) {
      const oldest = timestamps[0] ?? now;
      await sleep(oldest + THROTTLE_WINDOW_MS - now);
      return reserve();
    }
    timestamps.push(Date.now());
  };
  return () => {
    const result = tail.then(reserve);
    tail = result.catch(() => void 0);
    return result;
  };
}
function buildHeaders(method, configHeaders, requestHeaders) {
  const headers = { ...DEFAULT_HEADERS };
  if (method === "POST") headers["Content-Type"] = FORM_CONTENT_TYPE;
  Object.assign(headers, configHeaders ?? {}, requestHeaders ?? {});
  return headers;
}
function isRetryableStatus2(status) {
  return status === 429 || status >= 500;
}
function parseRetryAfter(response) {
  const header = response.headers.get("retry-after");
  if (header === null) return;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : void 0;
}
function computeBackoff(attempt, retryAfterSeconds) {
  if (retryAfterSeconds !== void 0) return retryAfterSeconds * 1e3;
  const ceiling = BASE_BACKOFF_MS * 2 ** attempt;
  return Math.random() * ceiling;
}
function mapStatusToError(status, url2) {
  if (status === 404) return new NotFoundError("App not found (404)", status, url2);
  if (status === 429) return new RateLimitError("Rate limited by Google Play (429)", status, url2);
  return new HttpError(`Request to ${url2} failed with status ${status.toString()}`, status, url2);
}
function buildRequestSignal(timeoutMs, signal) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal === void 0 ? timeout : AbortSignal.any([signal, timeout]);
}
function hostIsConsent(finalUrl) {
  if (!finalUrl) return false;
  try {
    return new URL(finalUrl).host === "consent.google.com";
  } catch {
    return false;
  }
}
function assertNotBlocked(response, body) {
  if (hostIsConsent(response.url) || body.includes("www.google.com/recaptcha") || body.includes("unusual traffic")) throw new BlockedError("Blocked by Google Play (consent wall or captcha)");
}
function createHttpClient(config2 = {}) {
  const fetchImpl = config2.fetchImpl ?? fetch;
  const retries = config2.retries ?? DEFAULT_RETRIES;
  const timeoutMs = config2.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const callerSignal = config2.signal;
  const limiter = config2.limiter ?? (config2.throttle !== void 0 ? createRateLimiter(config2.throttle) : void 0);
  const request = async (req) => {
    const method = req.method ?? "GET";
    const headers = buildHeaders(method, config2.headers, req.headers);
    const eventFor = (attempt) => ({
      url: req.url,
      method,
      attempt: attempt + 1
    });
    for (let attempt = 0; ; attempt += 1) {
      if (limiter) await limiter();
      emit(config2.onRequest, eventFor(attempt));
      const startedAt = performance.now();
      try {
        const response = await fetchImpl(req.url, {
          method,
          headers,
          body: req.body,
          signal: buildRequestSignal(timeoutMs, callerSignal)
        });
        if (response.ok) {
          const body = await response.text();
          emit(config2.onResponse, {
            ...eventFor(attempt),
            status: response.status,
            durationMs: performance.now() - startedAt
          });
          assertNotBlocked(response, body);
          return body;
        }
        emit(config2.onResponse, {
          ...eventFor(attempt),
          status: response.status,
          durationMs: performance.now() - startedAt
        });
        if (isRetryableStatus2(response.status) && attempt < retries) {
          const delayMs = computeBackoff(attempt, parseRetryAfter(response));
          emit(config2.onRetry, {
            ...eventFor(attempt),
            delayMs,
            reason: "status",
            status: response.status
          });
          await sleep(delayMs);
          continue;
        }
        throw mapStatusToError(response.status, req.url);
      } catch (error) {
        if (error instanceof GooglePlayError) throw error;
        if (callerSignal?.aborted) throw error;
        if (attempt < retries) {
          const delayMs = computeBackoff(attempt, void 0);
          emit(config2.onRetry, {
            ...eventFor(attempt),
            delayMs,
            reason: "network"
          });
          await sleep(delayMs);
          continue;
        }
        const httpError2 = new HttpError(`Network request to ${req.url} failed`, 0, req.url);
        httpError2.cause = error;
        throw httpError2;
      }
    }
  };
  return { request };
}
function clientFromOptions(opts) {
  return createHttpClient({
    throttle: opts.throttle,
    fetchImpl: opts.requestOptions?.fetchImpl,
    retries: opts.requestOptions?.retries,
    timeoutMs: opts.requestOptions?.timeoutMs,
    headers: opts.requestOptions?.headers,
    signal: opts.requestOptions?.signal,
    onRequest: opts.requestOptions?.onRequest,
    onResponse: opts.requestOptions?.onResponse,
    onRetry: opts.requestOptions?.onRetry
  });
}
var SCRIPT_BLOCK_REGEX = />AF_initDataCallback[\s\S]*?<\/script/g;
var BLOCK_KEY_REGEX = /(ds:.*?)'/;
var BLOCK_PAYLOAD_REGEX = /data:([\s\S]*?), sideChannel: {}}\);<\//;
var SERVICE_TABLE_REGEX = /; var AF_dataServiceRequests[\s\S]*?; var AF_initDataChunkQueue/;
var SERVICE_PAIR_REGEX = /'(ds:\d+)'\s*:\s*\{\s*id:\s*'([^']+)'/g;
function isBlockKey(value) {
  return typeof value === "string" && /^ds:\d+$/.test(value);
}
function deriveScriptDataSelection(requirements) {
  const blockKeys = /* @__PURE__ */ new Set();
  const rpcIds = /* @__PURE__ */ new Set();
  for (const requirement of requirements) {
    let contributed = false;
    if ("rpcId" in requirement && requirement.rpcId !== void 0) {
      rpcIds.add(requirement.rpcId);
      contributed = true;
    }
    for (const path2 of requirement.paths) {
      const blockKey = path2[0];
      if (isBlockKey(blockKey)) {
        blockKeys.add(blockKey);
        contributed = true;
      }
    }
    if (!contributed) throw new Error("script data requirement has no statically resolvable key");
  }
  return {
    blockKeys,
    rpcIds
  };
}
function selectedBlockKeys(selection, serviceRequests) {
  if (selection === void 0) return;
  const keys = new Set(selection.blockKeys);
  for (const [key, rpcId] of Object.entries(serviceRequests)) if (selection.rpcIds.has(rpcId)) keys.add(key);
  return keys;
}
function parseBlocks(html, selectedKeys) {
  const blocks = {};
  const parsedKeys = /* @__PURE__ */ new Set();
  const matches = html.match(SCRIPT_BLOCK_REGEX);
  if (matches === null) return blocks;
  for (const block of matches) {
    const keyMatch = BLOCK_KEY_REGEX.exec(block);
    const payloadMatch = BLOCK_PAYLOAD_REGEX.exec(block);
    const key = keyMatch?.[1];
    const payload = payloadMatch?.[1];
    if (key === void 0 || payload === void 0) continue;
    if (selectedKeys !== void 0 && !selectedKeys.has(key)) continue;
    if (selectedKeys !== void 0 && parsedKeys.has(key)) throw new ParseError(`script data block ${key}: duplicate selected callback`);
    try {
      blocks[key] = JSON.parse(payload);
      parsedKeys.add(key);
    } catch {
      if (selectedKeys !== void 0) throw new ParseError(`script data block ${key}: invalid JSON`);
      continue;
    }
  }
  return blocks;
}
function parseServiceRequests(html) {
  const requests = {};
  const table = SERVICE_TABLE_REGEX.exec(html)?.[0];
  if (table === void 0) return requests;
  for (const pair of table.matchAll(SERVICE_PAIR_REGEX)) {
    const dsKey = pair[1];
    const rpcId = pair[2];
    if (dsKey !== void 0 && rpcId !== void 0) requests[dsKey] = rpcId;
  }
  return requests;
}
function parseScriptData(html, selection) {
  const serviceRequests = parseServiceRequests(html);
  return {
    blocks: parseBlocks(html, selectedBlockKeys(selection, serviceRequests)),
    serviceRequests
  };
}
function resolveDsKeys(data, rpcId) {
  const keys = [];
  for (const [dsKey, id] of Object.entries(data.serviceRequests)) if (id === rpcId) keys.push(dsKey);
  return keys;
}
function isIndexable(value) {
  return Array.isArray(value);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function step(value, segment) {
  if (typeof segment === "number") {
    if (!isIndexable(value)) return;
    return value[segment < 0 ? value.length + segment : segment];
  }
  if (isRecord(value)) return value[segment];
}
function getPath(value, path2) {
  let current = value;
  for (const segment of path2) {
    if (current === void 0 || current === null) return;
    current = step(current, segment);
  }
  return current;
}
function formatIssues(error) {
  return error.issues.map((issue2) => {
    const path2 = issue2.path.join(".");
    return path2 ? `${path2}: ${issue2.message}` : issue2.message;
  }).join("; ");
}
function parseRaw(schema, value, context) {
  try {
    return parse(schema, value);
  } catch (error) {
    if (error instanceof $ZodError) throw new ParseError(`${context}: ${formatIssues(error)}`);
    throw error;
  }
}
function buildRawArrayPathSchema(path2, valueSchema, optionalSegments) {
  let schema = valueSchema;
  for (const index of path2.toReversed()) {
    const items = [optionalSegments ? optional(schema) : schema];
    for (let offset = 0; offset < index; offset += 1) items.unshift(unknown());
    schema = tuple(items, unknown());
  }
  return schema;
}
function rawArrayPathSchema(path2, valueSchema) {
  return buildRawArrayPathSchema(path2, valueSchema, false);
}
function rawOptionalArrayPathSchema(path2, valueSchema) {
  return buildRawArrayPathSchema(path2, valueSchema, true);
}
function candidateLabel(candidate) {
  return `${candidate.kind} ${candidate.name}`;
}
function routedCandidates(data, rpcId) {
  if (rpcId === void 0) return [];
  const candidates = [];
  for (const name of resolveDsKeys(data, rpcId)) {
    const root = data.blocks[name];
    if (root !== void 0 && root !== null) candidates.push({
      kind: "routed",
      name,
      root
    });
  }
  return candidates;
}
function fallbackCandidates(data, paths) {
  const candidates = [];
  for (const path2 of paths) {
    const root = getPath(data.blocks, path2);
    if (root !== void 0 && root !== null) candidates.push({
      kind: "fallback",
      name: path2.join("."),
      root
    });
  }
  return candidates;
}
function missingRoot(spec, context) {
  if (spec.missing.kind === "required") throw new ParseError(`${context}: required script root missing`);
  if (spec.missing.kind === "optional") return { root: void 0 };
  const root = spec.missing.create();
  parseRaw(spec.schema, root, `${context} default root`);
  return { root };
}
function rejectCandidate(spec, context, candidate) {
  const label = candidateLabel(candidate);
  parseRaw(spec.schema, candidate.root, `${context} ${label}`);
  throw new ParseError(`${context}: ${label} does not match the expected root`);
}
function unmatchedRoot(spec, context, rejected, onIntegrityEvent) {
  if (rejected === void 0) return missingRoot(spec, context);
  if (spec.unparsableCandidates !== "skip") return rejectCandidate(spec, context, rejected);
  const error = new ParseError(`${context}: skipped unparsable ${candidateLabel(rejected)}`);
  onIntegrityEvent?.({
    context,
    reason: "optional-section-parse",
    error
  });
  return missingRoot(spec, context);
}
function resolveScriptRoot(data, spec, context, onIntegrityEvent) {
  const matchesSchema = (candidate) => safeParse(spec.schema, candidate.root).success;
  const routed = routedCandidates(data, spec.rpcId);
  const routedMatches = routed.filter(matchesSchema);
  if (spec.rpcId !== void 0 && routedMatches.length > 1) {
    const names = routedMatches.map((candidate) => candidate.name).join(", ");
    throw new ParseError(`${context}: rpc ${spec.rpcId} is ambiguous across ${names}`);
  }
  const routedMatch = routedMatches[0];
  if (routedMatch !== void 0) return { root: routedMatch.root };
  const fallbacks = fallbackCandidates(data, spec.paths);
  const fallbackMatch = fallbacks.find(matchesSchema);
  if (fallbackMatch !== void 0) {
    if (spec.rpcId !== void 0) {
      const error = new ParseError(`${context}: used absolute ${candidateLabel(fallbackMatch)} for rpc ${spec.rpcId}`);
      onIntegrityEvent?.({
        context,
        reason: "rpc-anchor-fallback",
        error
      });
    }
    return { root: fallbackMatch.root };
  }
  return unmatchedRoot(spec, context, fallbacks[0] ?? routed[0], onIntegrityEvent);
}
var required2 = () => ({ kind: "required" });
var optional2 = () => ({ kind: "optional" });
var defaulted = (create) => ({
  kind: "default",
  create
});
function isScriptData(source) {
  return typeof source === "object" && source !== null && "blocks" in source && "serviceRequests" in source;
}
function resolveValue(root, paths) {
  for (const path2 of paths) {
    const value = getPath(root, path2);
    if (value !== void 0 && value !== null) return {
      found: true,
      value
    };
  }
  return { found: false };
}
function failureMessage(error) {
  if (error instanceof $ZodError) return error.issues.map((issue2) => {
    const path2 = issue2.path.join(".");
    return path2 ? `${path2}: ${issue2.message}` : issue2.message;
  }).join("; ");
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "non-error thrown during extraction";
}
function extract(source, specs, context) {
  const root = isScriptData(source) ? source.blocks : source;
  const result = {};
  const failures = [];
  for (const [field, spec] of Object.entries(specs)) {
    const paths = spec.paths;
    const resolved = resolveValue(root, paths);
    try {
      if (!resolved.found && spec.missing.kind === "required") {
        failures.push({
          field,
          paths,
          message: "required value missing"
        });
        continue;
      }
      if (!resolved.found && spec.missing.kind === "optional") {
        result[field] = parse(spec.schema, void 0);
        continue;
      }
      if (!resolved.found && spec.missing.kind === "default") {
        result[field] = parse(spec.schema, spec.missing.create());
        continue;
      }
      const raw = resolved.found ? resolved.value : void 0;
      const input2 = spec.transform ? spec.transform(raw) : raw;
      result[field] = parse(spec.schema, input2);
    } catch (error) {
      failures.push({
        field,
        paths,
        message: failureMessage(error)
      });
    }
  }
  if (failures.length > 0) throw new SpecError(context, failures);
  return result;
}
var appCategorySchema = object({
  name: string2(),
  id: nullable(string2())
});
var histogramSchema = object({
  "1": number2(),
  "2": number2(),
  "3": number2(),
  "4": number2(),
  "5": number2()
});
var appSchema = object({
  title: string2(),
  description: string2(),
  descriptionHTML: string2(),
  summary: optional(string2()),
  installs: optional(string2()),
  minInstalls: optional(number2()),
  maxInstalls: optional(number2()),
  score: optional(number2().check(_gte(0), _lte(5))),
  scoreText: optional(string2()),
  ratings: optional(number2()),
  reviews: optional(number2()),
  histogram: histogramSchema,
  price: number2(),
  originalPrice: optional(number2()),
  discountEndDate: optional(number2()),
  free: boolean2(),
  currency: optional(string2()),
  priceText: string2(),
  available: boolean2(),
  offersIAP: optional(boolean2()),
  IAPRange: optional(string2()),
  androidVersion: string2(),
  androidVersionText: string2(),
  androidMaxVersion: string2(),
  developer: string2(),
  developerId: string2(),
  developerEmail: optional(string2()),
  developerWebsite: optional(string2()),
  developerAddress: optional(string2()),
  developerLegalName: optional(string2()),
  developerLegalEmail: optional(string2()),
  developerLegalAddress: optional(string2()),
  developerLegalPhoneNumber: optional(string2()),
  privacyPolicy: optional(string2()),
  developerInternalID: string2(),
  genre: string2(),
  genreId: string2(),
  categories: array(appCategorySchema),
  icon: string2(),
  headerImage: optional(string2()),
  screenshots: array(string2()),
  video: optional(string2()),
  videoImage: optional(string2()),
  previewVideo: optional(string2()),
  contentRating: optional(string2()),
  contentRatingDescription: optional(string2()),
  adSupported: boolean2(),
  released: optional(string2()),
  updated: number2(),
  version: string2(),
  recentChanges: optional(string2()),
  comments: array(string2()),
  preregister: boolean2(),
  earlyAccessEnabled: boolean2(),
  isAvailableInPlayPass: boolean2(),
  appId: string2(),
  url: string2()
});
var MICROS_PER_UNIT = 1e6;
function resolveAppUrl(value) {
  return typeof value === "string" ? new URL(value, BASE_URL).toString() : void 0;
}
function microsToUnits(value) {
  return typeof value === "number" && Number.isFinite(value) ? value / MICROS_PER_UNIT : void 0;
}
function isFreeMicros(value) {
  return value === 0;
}
var TAB = 9;
var LINE_FEED = 10;
var CARRIAGE_RETURN = 13;
var UNIT_SEPARATOR = 31;
var DELETE = 127;
var C1_END = 159;
var SURROGATE_START$1 = 55296;
var SURROGATE_END$1 = 57343;
function isPreservedWhitespace(code) {
  return code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN;
}
function isControlCharacter(code) {
  if (isPreservedWhitespace(code)) return false;
  return code <= UNIT_SEPARATOR || code >= DELETE && code <= C1_END;
}
function isLoneSurrogate(code) {
  return code >= SURROGATE_START$1 && code <= SURROGATE_END$1;
}
function sanitizeText(value) {
  if (typeof value !== "string") return;
  let result = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (isControlCharacter(code) || isLoneSurrogate(code)) continue;
    result += character;
  }
  return result;
}
var BR_TAGS = /<br>/g;
var CARRIAGE_RETURNS = /\r\n?/g;
var TAGS = /<[^>]*>/g;
var ENTITIES = /&#[0-9]+;|&#[xX][0-9a-fA-F]+;|&[a-zA-Z]+;/g;
var NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\xA0"
};
var REPLACEMENT_CHARACTER = "\uFFFD";
var MAX_CODE_POINT = 1114111;
var SURROGATE_START = 55296;
var SURROGATE_END = 57343;
function decodeNumericReference(codePoint) {
  if (codePoint <= 0 || codePoint > MAX_CODE_POINT) return REPLACEMENT_CHARACTER;
  if (codePoint >= SURROGATE_START && codePoint <= SURROGATE_END) return REPLACEMENT_CHARACTER;
  return String.fromCodePoint(codePoint);
}
function decodeEntity(match) {
  const body = match.slice(1, -1);
  if (body.startsWith("#x") || body.startsWith("#X")) return decodeNumericReference(Number.parseInt(body.slice(2), 16));
  if (body.startsWith("#")) return decodeNumericReference(Number.parseInt(body.slice(1), 10));
  return NAMED_ENTITIES[body] ?? match;
}
function stripTags(html) {
  let stripped = html;
  let previous = "";
  while (stripped !== previous) {
    previous = stripped;
    stripped = stripped.replace(TAGS, "");
  }
  return stripped;
}
function htmlToPlainText(html) {
  return stripTags(html.replace(BR_TAGS, "\r\n").replace(CARRIAGE_RETURNS, "\n")).replace(ENTITIES, decodeEntity);
}
var MAX_COMMENTS = 5;
function descriptionHtmlLocalized(value) {
  const translated = getPath(value, [
    12,
    0,
    0,
    1
  ]);
  const original = getPath(value, [
    72,
    0,
    1
  ]);
  return sanitizeText(typeof translated === "string" && translated.length > 0 ? translated : original);
}
function descriptionText(html) {
  if (typeof html !== "string") return;
  return sanitizeText(htmlToPlainText(html));
}
function priceText(value) {
  return typeof value === "string" && value.length > 0 ? value : "Free";
}
function normalizeAndroidVersion(value) {
  if (typeof value !== "string") return "VARY";
  const token = value.split(" ")[0];
  if (token !== void 0 && parseFloat(token)) return token;
  return "VARY";
}
function buildHistogram(container) {
  return {
    1: histogramCount(container, 1),
    2: histogramCount(container, 2),
    3: histogramCount(container, 3),
    4: histogramCount(container, 4),
    5: histogramCount(container, 5)
  };
}
function histogramCount(container, star) {
  const bucket = getPath(container, [star, 1]);
  return typeof bucket === "number" ? bucket : 0;
}
function developerIdFromUrl(value) {
  if (typeof value !== "string") return;
  return value.split("id=")[1];
}
function extractComments(root) {
  const comments = getPath(root, [0]);
  if (!Array.isArray(comments)) return [];
  return comments.map((comment) => getPath(comment, [4])).filter((text) => typeof text === "string").slice(0, MAX_COMMENTS);
}
function extractScreenshots(value) {
  if (!Array.isArray(value)) return [];
  return value.map((shot) => getPath(shot, [3, 2])).filter((url2) => typeof url2 === "string");
}
function extractCategories(value, categories2 = []) {
  if (!Array.isArray(value) || value.length === 0) return categories2;
  if (value.length >= 4 && typeof value[0] === "string") {
    categories2.push({
      name: value[0],
      id: nullableString(value[2])
    });
    return categories2;
  }
  for (const sub of value) extractCategories(sub, categories2);
  return categories2;
}
function categoriesFromDetail(value) {
  const categories2 = extractCategories(getPath(value, [118]));
  if (categories2.length > 0) return categories2;
  const name = getPath(value, [
    79,
    0,
    0,
    0
  ]);
  if (typeof name === "string") return [{
    name,
    id: nullableString(getPath(value, [
      79,
      0,
      0,
      2
    ]))
  }];
  return categories2;
}
function nullableString(value) {
  return typeof value === "string" ? value : null;
}
var shape$6 = appSchema.shape;
var REQUIRED$5 = required2();
var OPTIONAL$5 = optional2();
var DEFAULT_FALSE = defaulted(() => false);
var DEFAULT_VARY = defaulted(() => "VARY");
var DEFAULT_PRICE$2 = defaulted(() => 0);
var DEFAULT_PRICE_TEXT = defaulted(() => "Free");
var APP_DETAILS_RPC_ID = "Ws7gDc";
function isDetailsRoot(value) {
  const details = getPath(value, [1, 2]);
  return Array.isArray(details) && details.length > 100;
}
function isPopulatedCommentsRoot(value) {
  const author = getPath(value, [
    0,
    0,
    1,
    0
  ]);
  const version2 = getPath(value, [
    0,
    0,
    10
  ]);
  const date3 = getPath(value, [
    0,
    0,
    5,
    0
  ]);
  return typeof author === "string" && author.length > 0 && typeof version2 === "string" && version2.length > 0 && typeof date3 === "number";
}
function isAbsentCommentsRoot(value) {
  if (Array.isArray(value) && value.length === 0) return true;
  const emptyMarker = getPath(value, [
    0,
    0,
    0
  ]);
  const ratings = getPath(value, [
    1,
    2,
    0
  ]);
  return Array.isArray(emptyMarker) && isRecord(ratings) && "52" in ratings;
}
var appDetailsRootSchema = custom(isDetailsRoot);
var appCommentsRootSchema = custom((value) => isPopulatedCommentsRoot(value) || isAbsentCommentsRoot(value));
var appDetailsRootSpec = {
  rpcId: APP_DETAILS_RPC_ID,
  paths: [["ds:5"]],
  schema: appDetailsRootSchema,
  missing: REQUIRED$5
};
var appCommentsRootSpec = {
  rpcId: APP_DETAILS_RPC_ID,
  paths: [["ds:8"], ["ds:9"]],
  schema: appCommentsRootSchema,
  missing: defaulted(() => []),
  unparsableCandidates: "skip"
};
var appScriptDataSelection = deriveScriptDataSelection([appDetailsRootSpec, appCommentsRootSpec]);
var appSpecs = {
  title: {
    paths: [[
      1,
      2,
      0,
      0
    ]],
    missing: REQUIRED$5,
    schema: shape$6.title
  },
  description: {
    paths: [[1, 2]],
    missing: REQUIRED$5,
    schema: shape$6.description,
    transform: (value) => descriptionText(descriptionHtmlLocalized(value))
  },
  descriptionHTML: {
    paths: [[1, 2]],
    missing: REQUIRED$5,
    schema: shape$6.descriptionHTML,
    transform: descriptionHtmlLocalized
  },
  summary: {
    paths: [[
      1,
      2,
      73,
      0,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.summary
  },
  installs: {
    paths: [[
      1,
      2,
      13,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.installs
  },
  minInstalls: {
    paths: [[
      1,
      2,
      13,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.minInstalls
  },
  maxInstalls: {
    paths: [[
      1,
      2,
      13,
      2
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.maxInstalls
  },
  score: {
    paths: [[
      1,
      2,
      51,
      0,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.score
  },
  scoreText: {
    paths: [[
      1,
      2,
      51,
      0,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.scoreText
  },
  ratings: {
    paths: [[
      1,
      2,
      51,
      2,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.ratings
  },
  reviews: {
    paths: [[
      1,
      2,
      51,
      3,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.reviews
  },
  histogram: {
    paths: [[
      1,
      2,
      51,
      1
    ]],
    missing: defaulted(() => buildHistogram(void 0)),
    schema: shape$6.histogram,
    transform: buildHistogram
  },
  price: {
    paths: [[
      1,
      2,
      57,
      0,
      0,
      0,
      0,
      1,
      0,
      0
    ]],
    missing: DEFAULT_PRICE$2,
    schema: shape$6.price,
    transform: microsToUnits
  },
  originalPrice: {
    paths: [[
      1,
      2,
      57,
      0,
      0,
      0,
      0,
      1,
      1,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.originalPrice,
    transform: (value) => typeof value === "number" && value !== 0 ? microsToUnits(value) : void 0
  },
  discountEndDate: {
    paths: [[
      1,
      2,
      57,
      0,
      0,
      0,
      0,
      14,
      0,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.discountEndDate,
    transform: (value) => typeof value === "number" ? value * 1e3 : value
  },
  free: {
    paths: [[
      1,
      2,
      57,
      0,
      0,
      0,
      0,
      1,
      0,
      0
    ]],
    missing: DEFAULT_FALSE,
    schema: shape$6.free,
    transform: (value) => value === 0
  },
  currency: {
    paths: [[
      1,
      2,
      57,
      0,
      0,
      0,
      0,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.currency
  },
  priceText: {
    paths: [[
      1,
      2,
      57,
      0,
      0,
      0,
      0,
      1,
      0,
      2
    ]],
    missing: DEFAULT_PRICE_TEXT,
    schema: shape$6.priceText,
    transform: priceText
  },
  available: {
    paths: [[
      1,
      2,
      18,
      0
    ]],
    missing: DEFAULT_FALSE,
    schema: shape$6.available,
    transform: (value) => Boolean(value)
  },
  offersIAP: {
    paths: [[
      1,
      2,
      19,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.offersIAP,
    transform: (value) => Boolean(value)
  },
  IAPRange: {
    paths: [[
      1,
      2,
      19,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.IAPRange
  },
  androidVersion: {
    paths: [[
      1,
      2,
      140,
      1,
      1,
      0,
      0,
      1
    ], [
      1,
      2,
      -1,
      "141",
      1,
      1,
      0,
      0,
      1
    ]],
    missing: DEFAULT_VARY,
    schema: shape$6.androidVersion,
    transform: normalizeAndroidVersion
  },
  androidVersionText: {
    paths: [[
      1,
      2,
      140,
      1,
      1,
      0,
      0,
      1
    ], [
      1,
      2,
      -1,
      "141",
      1,
      1,
      0,
      0,
      1
    ]],
    missing: defaulted(() => "Varies with device"),
    schema: shape$6.androidVersionText,
    transform: (value) => typeof value === "string" && value.length > 0 ? value : "Varies with device"
  },
  androidMaxVersion: {
    paths: [[
      1,
      2,
      140,
      1,
      1,
      0,
      1,
      1
    ], [
      1,
      2,
      -1,
      "141",
      1,
      1,
      0,
      1,
      1
    ]],
    missing: DEFAULT_VARY,
    schema: shape$6.androidMaxVersion,
    transform: normalizeAndroidVersion
  },
  developer: {
    paths: [[
      1,
      2,
      68,
      0
    ]],
    missing: REQUIRED$5,
    schema: shape$6.developer
  },
  developerId: {
    paths: [[
      1,
      2,
      68,
      1,
      4,
      2
    ]],
    missing: REQUIRED$5,
    schema: shape$6.developerId,
    transform: developerIdFromUrl
  },
  developerEmail: {
    paths: [[
      1,
      2,
      69,
      1,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.developerEmail
  },
  developerWebsite: {
    paths: [[
      1,
      2,
      69,
      0,
      5,
      2
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.developerWebsite
  },
  developerAddress: {
    paths: [[
      1,
      2,
      69,
      2,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.developerAddress
  },
  developerLegalName: {
    paths: [[
      1,
      2,
      69,
      4,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.developerLegalName
  },
  developerLegalEmail: {
    paths: [[
      1,
      2,
      69,
      4,
      1,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.developerLegalEmail
  },
  developerLegalAddress: {
    paths: [[
      1,
      2,
      69
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.developerLegalAddress,
    transform: (value) => {
      const address = getPath(value, [
        4,
        2,
        0
      ]);
      return typeof address === "string" ? address.replace(/\n/g, ", ") : void 0;
    }
  },
  developerLegalPhoneNumber: {
    paths: [[
      1,
      2,
      69,
      4,
      3
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.developerLegalPhoneNumber
  },
  privacyPolicy: {
    paths: [[
      1,
      2,
      99,
      0,
      5,
      2
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.privacyPolicy
  },
  developerInternalID: {
    paths: [[
      1,
      2,
      68,
      1,
      4,
      2
    ]],
    missing: REQUIRED$5,
    schema: shape$6.developerInternalID,
    transform: developerIdFromUrl
  },
  genre: {
    paths: [[
      1,
      2,
      79,
      0,
      0,
      0
    ]],
    missing: REQUIRED$5,
    schema: shape$6.genre
  },
  genreId: {
    paths: [[
      1,
      2,
      79,
      0,
      0,
      2
    ]],
    missing: REQUIRED$5,
    schema: shape$6.genreId
  },
  categories: {
    paths: [[1, 2]],
    missing: REQUIRED$5,
    schema: shape$6.categories,
    transform: categoriesFromDetail
  },
  icon: {
    paths: [[
      1,
      2,
      95,
      0,
      3,
      2
    ]],
    missing: REQUIRED$5,
    schema: shape$6.icon
  },
  headerImage: {
    paths: [[
      1,
      2,
      96,
      0,
      3,
      2
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.headerImage
  },
  screenshots: {
    paths: [[
      1,
      2,
      78,
      0
    ]],
    missing: REQUIRED$5,
    schema: shape$6.screenshots,
    transform: extractScreenshots
  },
  video: {
    paths: [[
      1,
      2,
      100,
      0,
      0,
      3,
      2
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.video
  },
  videoImage: {
    paths: [[
      1,
      2,
      100,
      1,
      0,
      3,
      2
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.videoImage
  },
  previewVideo: {
    paths: [[
      1,
      2,
      100,
      1,
      2,
      0,
      2
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.previewVideo
  },
  contentRating: {
    paths: [[
      1,
      2,
      9,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.contentRating
  },
  contentRatingDescription: {
    paths: [[
      1,
      2,
      9,
      2,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.contentRatingDescription
  },
  adSupported: {
    paths: [[
      1,
      2,
      48
    ]],
    missing: DEFAULT_FALSE,
    schema: shape$6.adSupported,
    transform: (value) => Boolean(value)
  },
  released: {
    paths: [[
      1,
      2,
      10,
      0
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.released
  },
  updated: {
    paths: [[
      1,
      2,
      145,
      0,
      1,
      0
    ], [
      1,
      2,
      -1,
      "146",
      0,
      1,
      0
    ]],
    missing: REQUIRED$5,
    schema: shape$6.updated,
    transform: (value) => typeof value === "number" ? value * 1e3 : value
  },
  version: {
    paths: [[
      1,
      2,
      140,
      0,
      0,
      0
    ], [
      1,
      2,
      -1,
      "141",
      0,
      0,
      0
    ]],
    missing: DEFAULT_VARY,
    schema: shape$6.version,
    transform: (value) => typeof value === "string" && value.length > 0 ? value : "VARY"
  },
  recentChanges: {
    paths: [[
      1,
      2,
      144,
      1,
      1
    ], [
      1,
      2,
      -1,
      "145",
      1,
      1
    ]],
    missing: OPTIONAL$5,
    schema: shape$6.recentChanges,
    transform: sanitizeText
  },
  preregister: {
    paths: [[
      1,
      2,
      18,
      0
    ]],
    missing: DEFAULT_FALSE,
    schema: shape$6.preregister,
    transform: (value) => value === 1
  },
  earlyAccessEnabled: {
    paths: [[
      1,
      2,
      18,
      2
    ]],
    missing: DEFAULT_FALSE,
    schema: shape$6.earlyAccessEnabled,
    transform: (value) => typeof value === "string"
  },
  isAvailableInPlayPass: {
    paths: [[
      1,
      2,
      62
    ]],
    missing: DEFAULT_FALSE,
    schema: shape$6.isAvailableInPlayPass,
    transform: (value) => Boolean(value)
  }
};
var appOptionsSchema = extend2(baseOptionsSchema, { appId: string2().check(_minLength(1)) });
var DETAILS_URL$1 = `${BASE_URL}/store/apps/details`;
function createApp(resolveClient = clientFromOptions) {
  return async function app2(options) {
    const parsed = parseOptions(appOptionsSchema, options, "app");
    const params = new URLSearchParams({
      id: parsed.appId,
      hl: parsed.lang,
      gl: parsed.country
    });
    const url2 = `${DETAILS_URL$1}?${params.toString()}`;
    const data = parseScriptData(await resolveClient(parsed).request({ url: url2 }), appScriptDataSelection);
    const details = resolveScriptRoot(data, appDetailsRootSpec, "app details", parsed.onIntegrityEvent);
    const comments = resolveScriptRoot(data, appCommentsRootSpec, "app comments", parsed.onIntegrityEvent);
    const extracted = extract(details.root, appSpecs, "app");
    return appSchema.parse({
      ...extracted,
      appId: parsed.appId,
      url: url2,
      comments: extractComments(comments.root)
    });
  };
}
var app = createApp();
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === void 0) continue;
      results[index] = await fn(item, index);
    }
  };
  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
var appsOptionsSchema = extend2(baseOptionsSchema, {
  appIds: array(string2().check(_minLength(1))).check(_minLength(1), _maxLength(250)),
  concurrency: _default(int().check(_gte(1), _lte(20)), 5)
});
var APPS_CONTEXT = "apps";
function toGooglePlayError(cause) {
  if (cause instanceof GooglePlayError) return cause;
  const error = new GooglePlayError(cause instanceof Error ? cause.message : String(cause));
  error.cause = cause;
  return error;
}
function createApps(getApp) {
  return async function apps2(options) {
    const parsed = parseOptions(appsOptionsSchema, options, APPS_CONTEXT);
    return mapWithConcurrency(parsed.appIds, parsed.concurrency, async (appId) => {
      try {
        return {
          appId,
          status: "fulfilled",
          app: await getApp({
            appId,
            lang: parsed.lang,
            country: parsed.country,
            throttle: parsed.throttle,
            requestOptions: parsed.requestOptions
          })
        };
      } catch (error) {
        return {
          appId,
          status: "rejected",
          error: toGooglePlayError(error)
        };
      }
    });
  };
}
var apps = createApps(app);
var countryAvailabilitySchema = discriminatedUnion("status", [
  object({ status: literal("available") }),
  object({ status: literal("unavailable") }),
  object({
    status: literal("error"),
    message: string2()
  })
]);
var availabilityResultSchema = object({
  appId: string2(),
  countries: record(string2().check(_length(2)), countryAvailabilitySchema)
});
var countryCodeSchema = string2().check(_regex(/^[a-z]{2}$/i));
var availabilityOptionsSchema = object({
  appId: string2().check(_minLength(1)),
  countries: array(countryCodeSchema).check(_minLength(1), _maxLength(50), refine(hasUniqueCountriesIgnoringCase, "country codes must be unique ignoring case")),
  lang: _default(string2().check(_minLength(2), _maxLength(7)), "en"),
  concurrency: _default(int().check(_gte(1), _lte(20)), 5),
  throttle: optional(number2().check(_positive(), _lte(50))),
  requestOptions: optional(requestOptionsSchema)
});
var AVAILABILITY_CONTEXT = "availability";
var DETAILS_URL = `${BASE_URL}/store/apps/details`;
function toCountryAvailability(error) {
  if (error instanceof NotFoundError) return { status: "unavailable" };
  return {
    status: "error",
    message: error instanceof Error ? error.message : String(error)
  };
}
function createAvailability(resolveClient = clientFromOptions) {
  return async function availability2(options) {
    const parsed = parseOptions(availabilityOptionsSchema, options, AVAILABILITY_CONTEXT);
    const countries = parsed.countries.map(normalizeCountry);
    const client = resolveClient(parsed);
    const probe = async (country) => {
      const params = new URLSearchParams({
        id: parsed.appId,
        hl: parsed.lang,
        gl: country
      });
      const url2 = `${DETAILS_URL}?${params.toString()}`;
      try {
        await client.request({ url: url2 });
        return { status: "available" };
      } catch (error) {
        return toCountryAvailability(error);
      }
    };
    const outcomes = await mapWithConcurrency(countries, parsed.concurrency, probe);
    const byCountry = {};
    for (const [index, country] of countries.entries()) {
      const outcome = outcomes[index];
      if (outcome !== void 0) byCountry[country] = outcome;
    }
    return availabilityResultSchema.parse({
      appId: parsed.appId,
      countries: byCountry
    });
  };
}
var availability = createAvailability();
function detectPaginationTokenCycle(seenTokens, token, context, onIntegrityEvent) {
  if (!seenTokens.has(token)) {
    seenTokens.add(token);
    return false;
  }
  const error = new ParseError(`${context}: pagination token cycle detected`);
  onIntegrityEvent?.({
    context,
    reason: "pagination-token-cycle",
    error
  });
  return true;
}
function parseOptionalSection(context, parseSection, onIntegrityEvent) {
  try {
    return parseSection();
  } catch (error) {
    if (!(error instanceof ParseError)) throw error;
    onIntegrityEvent?.({
      context,
      reason: "optional-section-parse",
      error
    });
    return;
  }
}
var BATCH_URL = `${BASE_URL}/_/PlayStoreUi/data/batchexecute`;
var DEFAULT_ENVELOPE_TAIL = [null, "generic"];
var WRB_FRAME_MARKER = "wrb.fr";
var SNIPPET_LENGTH = 200;
var targetFrameSchema = tuple([
  literal(WRB_FRAME_MARKER),
  string2(),
  nullable(string2())
], unknown());
function isArray(value) {
  return Array.isArray(value);
}
function snippet(text) {
  return text.slice(0, SNIPPET_LENGTH);
}
function buildBatchBody(rpcId, payload, envelopeTail = DEFAULT_ENVELOPE_TAIL) {
  const envelope = [[[
    rpcId,
    JSON.stringify(payload),
    ...envelopeTail
  ]]];
  return new URLSearchParams({ "f.req": JSON.stringify(envelope) }).toString();
}
function matchEnvelope(frames, rpcId) {
  for (const frame of frames) {
    if (!isArray(frame)) continue;
    if (frame[0] === WRB_FRAME_MARKER && frame[1] === rpcId) {
      const raw = parseRaw(targetFrameSchema, frame, `batchexecute ${rpcId} envelope`)[2];
      if (raw === null) return {
        found: true,
        value: null
      };
      try {
        return {
          found: true,
          value: JSON.parse(raw)
        };
      } catch {
        throw new ParseError(`batchexecute ${rpcId} payload is not valid JSON`);
      }
    }
  }
  return {
    found: false,
    value: void 0
  };
}
function tryParseArray(text) {
  try {
    const parsed = JSON.parse(text);
    return isArray(parsed) ? parsed : void 0;
  } catch {
    return;
  }
}
function parseBatchResponse(text, rpcId) {
  const start = text.indexOf("[");
  if (start === -1) throw new ParseError(`batchexecute response missing array start: ${snippet(text)}`);
  const body = text.slice(start);
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("[")) continue;
    const frames = tryParseArray(trimmed);
    if (frames === void 0) continue;
    const match = matchEnvelope(frames, rpcId);
    if (match.found) return match.value;
  }
  const whole = tryParseArray(body);
  if (whole !== void 0) {
    const match = matchEnvelope(whole, rpcId);
    if (match.found) return match.value;
  }
  throw new ParseError(`batchexecute response has no envelope for rpc ${rpcId}: ${snippet(body)}`);
}
var CLUSTER_RPC_ID = "qnKhOb";
var CLUSTER_STATIC_QUERY = "rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0";
var CLUSTER_TRAILING_QUERY = "authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213";
function clusterUrl(lang, country) {
  return `${BATCH_URL}?${CLUSTER_STATIC_QUERY}&hl=${lang}&gl=${country}&${CLUSTER_TRAILING_QUERY}`;
}
function buildClusterBody(numberOfApps, withToken) {
  return `f.req=%5B%5B%5B%22qnKhOb%22%2C%22%5B%5Bnull%2C%5B%5B10%2C%5B10%2C${numberOfApps.toString()}%5D%5D%2Ctrue%2Cnull%2C%5B96%2C27%2C4%2C8%2C57%2C30%2C110%2C79%2C11%2C16%2C49%2C1%2C3%2C9%2C12%2C104%2C55%2C56%2C51%2C10%2C34%2C77%5D%5D%2Cnull%2C%5C%22${withToken}%5C%22%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D`;
}
function asToken(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function numericPath(path2, context) {
  const result = [];
  for (const segment of path2) {
    if (typeof segment !== "number") throw new ParseError(`${context} response path must contain only array indexes`);
    result.push(segment);
  }
  return result;
}
async function* clusterPages(params) {
  const { client, lang, country, itemSpecs, appsPath, tokenPath, context } = params;
  if (params.initialApps.length > 0) yield params.initialApps;
  const seenTokens = /* @__PURE__ */ new Set();
  let token = asToken(params.initialToken);
  const appsPageSchema = rawArrayPathSchema(numericPath(appsPath, context), array(unknown()));
  const tokenPageSchema = rawOptionalArrayPathSchema(numericPath(tokenPath, context), nullable(string2()));
  while (token !== void 0) {
    if (detectPaginationTokenCycle(seenTokens, token, context, params.onIntegrityEvent)) return;
    const body = buildClusterBody(100, token);
    let page;
    try {
      const payload = parseBatchResponse(await client.request({
        url: clusterUrl(lang, country),
        method: "POST",
        body
      }), CLUSTER_RPC_ID);
      parseRaw(appsPageSchema, payload, `${context} continuation apps response`);
      parseRaw(tokenPageSchema, payload, `${context} continuation token response`);
      const apps2 = getPath(payload, appsPath);
      if (!Array.isArray(apps2) || apps2.length === 0) return;
      page = apps2.map((item) => extract(item, itemSpecs, context));
      token = asToken(getPath(payload, tokenPath));
    } catch (error) {
      if (error instanceof ParseError) {
        params.onDegradation?.({
          context,
          reason: "cluster-page-parse",
          error
        });
        return;
      }
      throw error;
    }
    yield page;
  }
}
async function fetchClusterApps(params) {
  const { num, ...pageParams } = params;
  const collected = [];
  for await (const page of clusterPages(pageParams)) {
    for (const item of page) collected.push(item);
    if (collected.length >= num) break;
  }
  return collected.slice(0, num);
}
var DEFAULT_CONCURRENCY = 3;
async function resolveFullDetail(items, options, getApp, concurrency = DEFAULT_CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      const item = items[index];
      if (item === void 0) continue;
      results[index] = await getApp({
        appId: item.appId,
        lang: options.lang,
        country: options.country,
        throttle: options.throttle,
        requestOptions: options.requestOptions
      });
    }
  };
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
var searchResultSchema = appItemSchema;
var shape$5 = searchResultSchema.shape;
var REQUIRED$4 = required2();
var OPTIONAL$4 = optional2();
var DEFAULT_PRICE$1 = defaulted(() => 0);
var DEFAULT_NOT_FREE$1 = defaulted(() => false);
var SEARCH_RPC_ID = "lGYRle";
function developerIdFromLink(value) {
  return typeof value === "string" ? value.split("?id=")[1] : void 0;
}
var INITIAL_MAPPINGS = {
  app: [
    0,
    1,
    0,
    23
  ],
  sections: [0, 1]
};
var searchRootSpec = {
  rpcId: SEARCH_RPC_ID,
  paths: [["ds:4"]],
  schema: rawArrayPathSchema(INITIAL_MAPPINGS.sections, array(unknown())),
  missing: REQUIRED$4
};
var searchScriptDataSelection = deriveScriptDataSelection([searchRootSpec]);
var SECTIONS_MAPPING = {
  apps: [22, 0],
  token: [
    22,
    1,
    3,
    1
  ]
};
var CLUSTER_MAPPINGS$1 = {
  apps: [
    0,
    0,
    0
  ],
  token: [
    0,
    0,
    7,
    1
  ]
};
var searchItemSpecs = {
  title: {
    paths: [[0, 3]],
    missing: REQUIRED$4,
    schema: shape$5.title
  },
  appId: {
    paths: [[
      0,
      0,
      0
    ]],
    missing: REQUIRED$4,
    schema: shape$5.appId
  },
  url: {
    paths: [[
      0,
      10,
      4,
      2
    ]],
    missing: REQUIRED$4,
    schema: shape$5.url,
    transform: resolveAppUrl
  },
  icon: {
    paths: [[
      0,
      1,
      3,
      2
    ]],
    missing: REQUIRED$4,
    schema: shape$5.icon
  },
  developer: {
    paths: [[0, 14]],
    missing: REQUIRED$4,
    schema: shape$5.developer
  },
  currency: {
    paths: [[
      0,
      8,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.currency
  },
  price: {
    paths: [[
      0,
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_PRICE$1,
    schema: shape$5.price,
    transform: microsToUnits
  },
  free: {
    paths: [[
      0,
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_NOT_FREE$1,
    schema: shape$5.free,
    transform: isFreeMicros
  },
  summary: {
    paths: [[
      0,
      13,
      1
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.summary
  },
  scoreText: {
    paths: [[
      0,
      4,
      0
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.scoreText
  },
  score: {
    paths: [[
      0,
      4,
      1
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.score
  }
};
var searchPageItemSpecs = {
  title: {
    paths: [[3]],
    missing: REQUIRED$4,
    schema: shape$5.title
  },
  appId: {
    paths: [[0, 0]],
    missing: REQUIRED$4,
    schema: shape$5.appId
  },
  url: {
    paths: [[
      10,
      4,
      2
    ]],
    missing: REQUIRED$4,
    schema: shape$5.url,
    transform: resolveAppUrl
  },
  icon: {
    paths: [[
      1,
      3,
      2
    ]],
    missing: REQUIRED$4,
    schema: shape$5.icon
  },
  developer: {
    paths: [[14]],
    missing: REQUIRED$4,
    schema: shape$5.developer
  },
  currency: {
    paths: [[
      8,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.currency
  },
  price: {
    paths: [[
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_PRICE$1,
    schema: shape$5.price,
    transform: microsToUnits
  },
  free: {
    paths: [[
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_NOT_FREE$1,
    schema: shape$5.free,
    transform: isFreeMicros
  },
  summary: {
    paths: [[13, 1]],
    missing: OPTIONAL$4,
    schema: shape$5.summary
  },
  scoreText: {
    paths: [[4, 0]],
    missing: OPTIONAL$4,
    schema: shape$5.scoreText
  },
  score: {
    paths: [[4, 1]],
    missing: OPTIONAL$4,
    schema: shape$5.score
  }
};
var exactMatchSpecs = {
  title: {
    paths: [[
      16,
      2,
      0,
      0
    ]],
    missing: REQUIRED$4,
    schema: shape$5.title
  },
  appId: {
    paths: [[
      16,
      3,
      "12",
      0,
      0
    ]],
    missing: REQUIRED$4,
    schema: shape$5.appId
  },
  url: {
    paths: [[
      17,
      0,
      0,
      4,
      2
    ]],
    missing: REQUIRED$4,
    schema: shape$5.url,
    transform: resolveAppUrl
  },
  icon: {
    paths: [[
      16,
      2,
      95,
      0,
      3,
      2
    ]],
    missing: REQUIRED$4,
    schema: shape$5.icon
  },
  developer: {
    paths: [[
      16,
      2,
      68,
      0
    ]],
    missing: REQUIRED$4,
    schema: shape$5.developer
  },
  developerId: {
    paths: [[
      16,
      2,
      68,
      1,
      4,
      2
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.developerId,
    transform: developerIdFromLink
  },
  currency: {
    paths: [[
      17,
      0,
      2,
      0,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.currency
  },
  price: {
    paths: [[
      17,
      0,
      2,
      0,
      1,
      0,
      0
    ]],
    missing: DEFAULT_PRICE$1,
    schema: shape$5.price,
    transform: microsToUnits
  },
  free: {
    paths: [[
      17,
      0,
      2,
      0,
      1,
      0,
      0
    ]],
    missing: DEFAULT_NOT_FREE$1,
    schema: shape$5.free,
    transform: isFreeMicros
  },
  summary: {
    paths: [[
      16,
      2,
      73,
      0,
      1
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.summary
  },
  scoreText: {
    paths: [[
      16,
      2,
      51,
      0,
      0
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.scoreText
  },
  score: {
    paths: [[
      16,
      2,
      51,
      0,
      1
    ]],
    missing: OPTIONAL$4,
    schema: shape$5.score
  }
};
function priceGoogleValue(value) {
  switch (value) {
    case "free":
      return 1;
    case "paid":
      return 2;
    default:
      return 0;
  }
}
function matchesPriceFilter(free, filter) {
  switch (filter) {
    case "free":
      return free;
    case "paid":
      return !free;
    default:
      return true;
  }
}
function filterByPrice(items, filter) {
  if (filter === "all") return [...items];
  return items.filter((item) => matchesPriceFilter(item.free, filter));
}
var searchOptionsSchema = extend2(baseOptionsSchema, {
  term: string2().check(_minLength(1)),
  num: _default(int().check(_gte(1), _lte(250)), 20),
  price: _default(_enum([
    "all",
    "free",
    "paid"
  ]), "all"),
  fullDetail: _default(boolean2(), false)
});
var SEARCH_URL = `${BASE_URL}/store/search`;
var SEARCH_CONTEXT = "search";
async function fetchSearchFirstPage(query, resolveClient) {
  const params = new URLSearchParams({
    c: "apps",
    q: query.term,
    hl: query.lang,
    gl: query.country,
    price: priceGoogleValue(query.price).toString()
  });
  const client = resolveClient(query);
  return {
    client,
    page: firstPage(resolveScriptRoot(parseScriptData(await client.request({ url: `${SEARCH_URL}?${params.toString()}` }), searchScriptDataSelection), searchRootSpec, "search root", query.onIntegrityEvent).root, query.onIntegrityEvent)
  };
}
function prependExactMatch(root, apps2, onIntegrityEvent) {
  const exactMatchData = getPath(root, INITIAL_MAPPINGS.app);
  if (exactMatchData === void 0 || exactMatchData === null) return apps2;
  const exactMatch = parseOptionalSection(SEARCH_CONTEXT, () => extract(exactMatchData, exactMatchSpecs, SEARCH_CONTEXT), onIntegrityEvent);
  if (exactMatch === void 0) return apps2;
  if (apps2.some((item) => item.appId === exactMatch.appId)) return apps2;
  return [exactMatch, ...apps2];
}
function firstPage(root, onIntegrityEvent) {
  const sections = getPath(root, INITIAL_MAPPINGS.sections);
  if (!Array.isArray(sections)) throw new ParseError(`${SEARCH_CONTEXT}: validated sections root is unavailable`);
  for (const section of sections) {
    const apps2 = getPath(section, SECTIONS_MAPPING.apps);
    if (Array.isArray(apps2) && apps2.length > 0) {
      const extracted = apps2.map((item) => extract(item, searchItemSpecs, SEARCH_CONTEXT));
      const token = getPath(section, SECTIONS_MAPPING.token);
      return {
        apps: prependExactMatch(root, extracted, onIntegrityEvent),
        token: typeof token === "string" ? token : void 0
      };
    }
  }
  return {
    apps: [],
    token: void 0
  };
}
function createSearch(getApp, resolveClient = clientFromOptions) {
  return async function search2(options) {
    const parsed = parseOptions(searchOptionsSchema, options, SEARCH_CONTEXT);
    const { client, page } = await fetchSearchFirstPage(parsed, resolveClient);
    const sliced = filterByPrice(await fetchClusterApps({
      client,
      lang: parsed.lang,
      country: parsed.country,
      num: parsed.num,
      initialApps: page.apps,
      initialToken: page.token,
      itemSpecs: searchPageItemSpecs,
      appsPath: CLUSTER_MAPPINGS$1.apps,
      tokenPath: CLUSTER_MAPPINGS$1.token,
      context: SEARCH_CONTEXT,
      onDegradation: parsed.onDegradation,
      onIntegrityEvent: parsed.onIntegrityEvent
    }), parsed.price).slice(0, parsed.num);
    if (parsed.fullDetail) return resolveFullDetail(sliced, parsed, getApp);
    return array(searchResultSchema).parse(sliced);
  };
}
var search = createSearch(app);
var SUGGEST_RPC_ID = "IJ4APc";
var STATIC_QUERY_PARAMS$1 = {
  rpcids: SUGGEST_RPC_ID,
  "f.sid": "-697906427155521722",
  bl: "boq_playuiserver_20190903.08_p0",
  "soc-app": "121",
  "soc-platform": "1",
  "soc-device": "1",
  _reqid: "1065213"
};
var SUGGEST_LIMIT = 10;
var SUGGEST_DATASET = 2;
var SUGGEST_MODE = 4;
function suggestUrl(lang, country) {
  return `${BATCH_URL}?${new URLSearchParams({
    ...STATIC_QUERY_PARAMS$1,
    hl: lang,
    gl: country
  }).toString()}`;
}
function buildSuggestPayload(term) {
  return [[
    null,
    [term],
    [SUGGEST_LIMIT],
    [SUGGEST_DATASET],
    SUGGEST_MODE
  ]];
}
var SUGGESTIONS_PATH = [0, 0];
var SUGGESTION_TEXT_PATH = [0];
var suggestResponseSchema = union([literal(null), rawArrayPathSchema(SUGGESTIONS_PATH, nullable(array(unknown())))]);
var suggestOptionsSchema = extend2(baseOptionsSchema, { term: string2().check(_minLength(1)) });
var SUGGEST_CONTEXT = "suggest";
var MAX_SUGGESTIONS = 5;
function createSuggest(resolveClient = clientFromOptions) {
  return async function suggest2(options) {
    const parsed = parseOptions(suggestOptionsSchema, options, SUGGEST_CONTEXT);
    const client = resolveClient(parsed);
    const body = buildBatchBody(SUGGEST_RPC_ID, buildSuggestPayload(parsed.term), []);
    const payload = parseBatchResponse(await client.request({
      url: suggestUrl(parsed.lang, parsed.country),
      method: "POST",
      body
    }), SUGGEST_RPC_ID);
    parseRaw(suggestResponseSchema, payload, `${SUGGEST_CONTEXT} response`);
    if (payload === null) return [];
    const entries = getPath(payload, SUGGESTIONS_PATH);
    if (!Array.isArray(entries)) return [];
    return array(string2()).parse(entries.map((entry) => getPath(entry, SUGGESTION_TEXT_PATH))).slice(0, MAX_SUGGESTIONS);
  };
}
var suggest = createSuggest();
var listItemSchema = appItemSchema;
var LIST_RPC_ID = "vyAe2";
var shape$4 = appItemSchema.shape;
var REQUIRED$3 = required2();
var OPTIONAL$3 = optional2();
var STATIC_QUERY_PARAMS = {
  rpcids: LIST_RPC_ID,
  "source-path": "/store/apps",
  "f.sid": "-4178618388443751758",
  bl: "boq_playuiserver_20220612.08_p0",
  authuser: "0",
  "soc-app": "121",
  "soc-platform": "1",
  "soc-device": "1",
  _reqid: "82003",
  rt: "c"
};
var CLUSTER_NAMES = {
  TOP_FREE: "topselling_free",
  TOP_PAID: "topselling_paid",
  GROSSING: "topgrossing"
};
function listUrl(lang, country, age2) {
  const params = new URLSearchParams({
    ...STATIC_QUERY_PARAMS,
    hl: lang,
    gl: country
  });
  if (age2 !== void 0) params.set("age", age2);
  return `${BATCH_URL}?${params.toString()}`;
}
function buildListBody({ num, collection: collection2, category: category2 }) {
  return `f.req=%5B%5B%5B%22vyAe2%22%2C%22%5B%5Bnull%2C%5B%5B8%2C%5B20%2C${num}%5D%5D%2Ctrue%2Cnull%2C%5B64%2C1%2C195%2C71%2C8%2C72%2C9%2C10%2C11%2C139%2C12%2C16%2C145%2C148%2C150%2C151%2C152%2C27%2C30%2C31%2C96%2C32%2C34%2C163%2C100%2C165%2C104%2C169%2C108%2C110%2C113%2C55%2C56%2C57%2C122%5D%2C%5Bnull%2Cnull%2C%5B%5B%5Btrue%5D%2Cnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%2Cnull%2Cnull%2Cnull%2Cnull%2C%5Bnull%2C2%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B1%5D%5D%2C%5Bnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%5D%2C%5Bnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%2Cnull%2C%5Btrue%5D%5D%2C%5Bnull%2C%5B%5Bnull%2C%5B%5D%5D%5D%5D%2Cnull%2Cnull%2Cnull%2Cnull%2C%5B%5B%5Bnull%2C%5B%5D%5D%5D%5D%2C%5B%5B%5Bnull%2C%5B%5D%5D%5D%5D%5D%2C%5B%5B%5B%5B7%2C1%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C31%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C104%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C9%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C8%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C27%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C12%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C65%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C110%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C88%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C11%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C56%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C55%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C96%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C10%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C122%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C72%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C71%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C64%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C113%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C139%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C150%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C169%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C165%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C151%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C163%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C32%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C16%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C108%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B7%2C100%5D%2C%5B%5B1%2C73%2C96%2C103%2C97%2C58%2C50%2C92%2C52%2C112%2C69%2C19%2C31%2C101%2C123%2C74%2C49%2C80%2C38%2C20%2C10%2C14%2C79%2C43%2C42%2C139%5D%5D%5D%2C%5B%5B9%2C1%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C31%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C104%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C9%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C8%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C27%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C12%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C65%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C110%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C88%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C11%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C56%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C55%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C96%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C10%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C122%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C72%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C71%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C64%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C113%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C139%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C150%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C169%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C165%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C151%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C163%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C32%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C16%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C108%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B9%2C100%5D%2C%5B%5B1%2C7%2C9%2C24%2C12%2C31%2C5%2C15%2C27%2C8%2C13%2C10%5D%5D%5D%2C%5B%5B17%2C1%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C31%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C104%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C9%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C8%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C27%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C12%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C65%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C110%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C88%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C11%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C56%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C55%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C96%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C10%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C122%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C72%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C71%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C64%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C113%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C139%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C150%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C169%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C165%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C151%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C163%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C32%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C16%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C108%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B17%2C100%5D%2C%5B%5B1%2C7%2C9%2C25%2C13%2C31%2C5%2C41%2C27%2C8%2C14%2C10%5D%5D%5D%2C%5B%5B10%2C1%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C31%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C104%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C9%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C8%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C27%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C12%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C65%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C110%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C88%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C11%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C56%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C55%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C96%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C10%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C122%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C72%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C71%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C64%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C113%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C139%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C150%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C169%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C165%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C151%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C163%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C32%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C16%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C108%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B10%2C100%5D%2C%5B%5B1%2C7%2C6%2C9%5D%5D%5D%2C%5B%5B1%2C1%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C31%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C104%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C9%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C8%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C27%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C12%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C65%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C110%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C88%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C11%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C56%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C55%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C96%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C10%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C122%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C72%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C71%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C64%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C113%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C139%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C150%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C169%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C165%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C151%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C163%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C32%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C16%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C108%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B1%2C100%5D%2C%5B%5B1%2C5%2C14%2C38%2C19%2C29%2C34%2C4%2C12%2C11%2C6%2C30%2C43%2C40%2C42%2C16%2C10%2C7%5D%5D%5D%2C%5B%5B4%2C1%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C31%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C104%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C9%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C8%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C27%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C12%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C65%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C110%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C88%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C11%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C56%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C55%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C96%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C10%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C122%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C72%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C71%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C64%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C113%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C139%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C150%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C169%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C165%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C151%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C163%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C32%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C16%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C108%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B4%2C100%5D%2C%5B%5B1%2C3%2C5%2C4%2C7%2C6%2C11%2C19%2C21%2C17%2C15%2C12%2C16%2C20%5D%5D%5D%2C%5B%5B3%2C1%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C31%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C104%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C9%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C8%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C27%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C12%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C65%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C110%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C88%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C11%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C56%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C55%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C96%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C10%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C122%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C72%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C71%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C64%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C113%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C139%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C150%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C169%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C165%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C151%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C163%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C32%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C16%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C108%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B3%2C100%5D%2C%5B%5B1%2C5%2C14%2C4%2C10%2C17%5D%5D%5D%2C%5B%5B2%2C1%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C31%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C104%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C9%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C8%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C27%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C12%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C65%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C110%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C88%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C11%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C56%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C55%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C96%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C10%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C122%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C72%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C71%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C64%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C113%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C139%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C150%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C169%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C165%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C151%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C163%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C32%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C16%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C108%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%2C%5B%5B2%2C100%5D%2C%5B%5B1%2C5%2C7%2C4%2C13%2C16%2C12%2C18%5D%5D%5D%5D%5D%5D%2Cnull%2Cnull%2C%5B%5B%5B1%2C2%5D%2C%5B10%2C8%2C9%5D%2C%5B%5D%2C%5B%5D%5D%5D%5D%2C%5B2%2C%5C%22${collection2}%5C%22%2C%5C%22${category2}%5C%22%5D%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=AFSRYlx8XZfN8-O-IKASbNBDkB6T%3A1655531200971&`;
}
var APPS_PATH = [
  0,
  1,
  0,
  28,
  0
];
var listResponseSchema = union([rawArrayPathSchema([0, 1], _null3()), rawArrayPathSchema(APPS_PATH, array(unknown()))]);
var listItemSpecs = {
  title: {
    paths: [[0, 3]],
    missing: REQUIRED$3,
    schema: shape$4.title
  },
  appId: {
    paths: [[
      0,
      0,
      0
    ]],
    missing: REQUIRED$3,
    schema: shape$4.appId
  },
  url: {
    paths: [[
      0,
      10,
      4,
      2
    ]],
    missing: REQUIRED$3,
    schema: shape$4.url,
    transform: resolveAppUrl
  },
  icon: {
    paths: [[
      0,
      1,
      3,
      2
    ]],
    missing: REQUIRED$3,
    schema: shape$4.icon
  },
  developer: {
    paths: [[0, 14]],
    missing: REQUIRED$3,
    schema: shape$4.developer
  },
  currency: {
    paths: [[
      0,
      8,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$3,
    schema: shape$4.currency
  },
  price: {
    paths: [[
      0,
      8,
      1,
      0,
      0
    ]],
    missing: defaulted(() => 0),
    schema: shape$4.price,
    transform: microsToUnits
  },
  free: {
    paths: [[
      0,
      8,
      1,
      0,
      0
    ]],
    missing: defaulted(() => false),
    schema: shape$4.free,
    transform: isFreeMicros
  },
  summary: {
    paths: [[
      0,
      13,
      1
    ]],
    missing: OPTIONAL$3,
    schema: shape$4.summary
  },
  scoreText: {
    paths: [[
      0,
      4,
      0
    ]],
    missing: OPTIONAL$3,
    schema: shape$4.scoreText
  },
  score: {
    paths: [[
      0,
      4,
      1
    ]],
    missing: OPTIONAL$3,
    schema: shape$4.score
  }
};
var listOptionsSchema = extend2(baseOptionsSchema, {
  collection: _default(_enum(collection), "TOP_FREE"),
  category: _default(_enum(category), "APPLICATION"),
  age: optional(_enum(age)),
  num: _default(int().check(_gte(1)), 500),
  fullDetail: _default(boolean2(), false)
});
var LIST_CONTEXT = "list";
function createList(getApp, resolveClient = clientFromOptions) {
  return async function list2(options) {
    const parsed = parseOptions(listOptionsSchema, options, LIST_CONTEXT);
    const client = resolveClient(parsed);
    const body = buildListBody({
      num: parsed.num.toString(),
      collection: CLUSTER_NAMES[parsed.collection],
      category: parsed.category
    });
    const payload = parseBatchResponse(await client.request({
      url: listUrl(parsed.lang, parsed.country, parsed.age),
      method: "POST",
      body
    }), LIST_RPC_ID);
    parseRaw(listResponseSchema, payload, `${LIST_CONTEXT} response`);
    const appsData = getPath(payload, APPS_PATH);
    const items = Array.isArray(appsData) ? appsData.map((item) => extract(item, listItemSpecs, LIST_CONTEXT)) : [];
    if (parsed.fullDetail) return resolveFullDetail(items, parsed, getApp);
    return array(listItemSchema).parse(items);
  };
}
var list = createList(app);
var categoriesOptionsSchema = pick2(baseOptionsSchema, {
  throttle: true,
  requestOptions: true
});
var CATEGORIES_CONTEXT = "categories";
var categoryListSchema = array(string2()).check(_minLength(1));
var CATEGORY_IDS = Object.values(category);
function categories(options) {
  return Promise.resolve().then(() => {
    parseOptions(categoriesOptionsSchema, options ?? {}, CATEGORIES_CONTEXT);
    return categoryListSchema.parse([...CATEGORY_IDS]);
  });
}
var shape$3 = appItemSchema.shape;
var PRICE_NUMBER = /([0-9.,]+)/;
function resolveUrl(value) {
  return typeof value === "string" ? new URL(value, BASE_URL).toString() : void 0;
}
function priceFromText(value) {
  if (typeof value !== "string") return 0;
  const match = PRICE_NUMBER.exec(value);
  return match === null ? 0 : Number.parseFloat(match[0]);
}
function isFreeText(value) {
  return value === void 0 || value === null;
}
var clusterItemSpecs = {
  title: {
    paths: [[2]],
    missing: required2(),
    schema: shape$3.title
  },
  appId: {
    paths: [[12, 0]],
    missing: required2(),
    schema: shape$3.appId
  },
  url: {
    paths: [[
      9,
      4,
      2
    ]],
    missing: required2(),
    schema: shape$3.url,
    transform: resolveUrl
  },
  icon: {
    paths: [[
      1,
      1,
      0,
      3,
      2
    ]],
    missing: required2(),
    schema: shape$3.icon
  },
  developer: {
    paths: [[
      4,
      0,
      0,
      0
    ]],
    missing: required2(),
    schema: shape$3.developer
  },
  currency: {
    paths: [[
      7,
      0,
      3,
      2,
      1,
      0,
      1
    ]],
    missing: optional2(),
    schema: shape$3.currency
  },
  price: {
    paths: [[
      7,
      0,
      3,
      2,
      1,
      0,
      2
    ]],
    missing: defaulted(() => 0),
    schema: shape$3.price,
    transform: priceFromText
  },
  free: {
    paths: [[
      7,
      0,
      3,
      2,
      1,
      0,
      2
    ]],
    missing: defaulted(() => true),
    schema: shape$3.free,
    transform: isFreeText
  },
  summary: {
    paths: [[
      4,
      1,
      1,
      1,
      1
    ]],
    missing: optional2(),
    schema: shape$3.summary
  },
  scoreText: {
    paths: [[
      6,
      0,
      2,
      1,
      0
    ]],
    missing: optional2(),
    schema: shape$3.scoreText
  },
  score: {
    paths: [[
      6,
      0,
      2,
      1,
      1
    ]],
    missing: optional2(),
    schema: shape$3.score
  }
};
var developerAppSchema = appItemSchema;
var shape$2 = developerAppSchema.shape;
var REQUIRED$2 = required2();
var OPTIONAL$2 = optional2();
var DEFAULT_PRICE = defaulted(() => 0);
var DEFAULT_NOT_FREE = defaulted(() => false);
var NUMERIC_ID = /^\d+$/;
function isNumericDevId(devId) {
  return NUMERIC_ID.test(devId);
}
function developerUrl(devId, lang, country) {
  return `${BASE_URL}${isNumericDevId(devId) ? "/store/apps/dev" : "/store/apps/developer"}?${new URLSearchParams({
    id: devId,
    hl: lang,
    gl: country
  }).toString()}`;
}
var NUMERIC_INITIAL_MAPPINGS = {
  apps: [0],
  token: [
    1,
    3,
    1
  ]
};
var NAME_INITIAL_MAPPINGS = {
  apps: [0],
  token: [
    1,
    3,
    1
  ]
};
function isInitialLayoutRoot(value) {
  const apps2 = getPath(value, [0]);
  const token = getPath(value, [
    1,
    3,
    1
  ]);
  return Array.isArray(apps2) && (token === void 0 || token === null || typeof token === "string");
}
var initialLayoutRootSchema = custom(isInitialLayoutRoot);
var numericInitialRootSpec = {
  paths: [[
    "ds:3",
    0,
    1,
    0,
    21
  ]],
  schema: initialLayoutRootSchema,
  missing: optional2()
};
var nameInitialRootSpec = {
  paths: [[
    "ds:3",
    0,
    1,
    0,
    22
  ]],
  schema: initialLayoutRootSchema,
  missing: optional2()
};
var developerScriptDataSelection = deriveScriptDataSelection([numericInitialRootSpec, nameInitialRootSpec]);
var CLUSTER_MAPPINGS = {
  apps: [
    0,
    6,
    0
  ],
  token: [
    0,
    6,
    7,
    1
  ]
};
var nameItemSpecs = {
  title: {
    paths: [[0, 3]],
    missing: REQUIRED$2,
    schema: shape$2.title
  },
  appId: {
    paths: [[
      0,
      0,
      0
    ]],
    missing: REQUIRED$2,
    schema: shape$2.appId
  },
  url: {
    paths: [[
      0,
      10,
      4,
      2
    ]],
    missing: REQUIRED$2,
    schema: shape$2.url,
    transform: resolveAppUrl
  },
  icon: {
    paths: [[
      0,
      1,
      3,
      2
    ]],
    missing: REQUIRED$2,
    schema: shape$2.icon
  },
  developer: {
    paths: [[0, 14]],
    missing: REQUIRED$2,
    schema: shape$2.developer
  },
  currency: {
    paths: [[
      0,
      8,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$2,
    schema: shape$2.currency
  },
  price: {
    paths: [[
      0,
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_PRICE,
    schema: shape$2.price,
    transform: microsToUnits
  },
  free: {
    paths: [[
      0,
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_NOT_FREE,
    schema: shape$2.free,
    transform: isFreeMicros
  },
  summary: {
    paths: [[
      0,
      13,
      1
    ]],
    missing: OPTIONAL$2,
    schema: shape$2.summary
  },
  scoreText: {
    paths: [[
      0,
      4,
      0
    ]],
    missing: OPTIONAL$2,
    schema: shape$2.scoreText
  },
  score: {
    paths: [[
      0,
      4,
      1
    ]],
    missing: OPTIONAL$2,
    schema: shape$2.score
  }
};
var numericItemSpecs = {
  title: {
    paths: [[3]],
    missing: REQUIRED$2,
    schema: shape$2.title
  },
  appId: {
    paths: [[0, 0]],
    missing: REQUIRED$2,
    schema: shape$2.appId
  },
  url: {
    paths: [[
      10,
      4,
      2
    ]],
    missing: REQUIRED$2,
    schema: shape$2.url,
    transform: resolveAppUrl
  },
  icon: {
    paths: [[
      1,
      3,
      2
    ]],
    missing: REQUIRED$2,
    schema: shape$2.icon
  },
  developer: {
    paths: [[14]],
    missing: REQUIRED$2,
    schema: shape$2.developer
  },
  currency: {
    paths: [[
      8,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$2,
    schema: shape$2.currency
  },
  price: {
    paths: [[
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_PRICE,
    schema: shape$2.price,
    transform: microsToUnits
  },
  free: {
    paths: [[
      8,
      1,
      0,
      0
    ]],
    missing: DEFAULT_NOT_FREE,
    schema: shape$2.free,
    transform: isFreeMicros
  },
  summary: {
    paths: [[13, 1]],
    missing: OPTIONAL$2,
    schema: shape$2.summary
  },
  scoreText: {
    paths: [[4, 0]],
    missing: OPTIONAL$2,
    schema: shape$2.scoreText
  },
  score: {
    paths: [[4, 1]],
    missing: OPTIONAL$2,
    schema: shape$2.score
  }
};
var developerOptionsSchema = extend2(baseOptionsSchema, {
  devId: string2().check(_minLength(1)),
  num: _default(int().check(_gte(1)), 60),
  fullDetail: _default(boolean2(), false)
});
var DEVELOPER_CONTEXT = "developer";
var NUMERIC_LAYOUT = {
  rootSpec: numericInitialRootSpec,
  mappings: NUMERIC_INITIAL_MAPPINGS,
  itemSpecs: numericItemSpecs
};
var NAME_LAYOUT = {
  rootSpec: nameInitialRootSpec,
  mappings: NAME_INITIAL_MAPPINGS,
  itemSpecs: nameItemSpecs
};
function extractLayout(data, layout) {
  const resolved = resolveScriptRoot(data, layout.rootSpec, `${DEVELOPER_CONTEXT} layout`);
  if (resolved.root === void 0) return;
  const appsData = getPath(resolved.root, layout.mappings.apps);
  if (!Array.isArray(appsData) || appsData.length === 0) return;
  const apps2 = appsData.map((item) => extract(item, layout.itemSpecs, DEVELOPER_CONTEXT));
  const token = getPath(resolved.root, layout.mappings.token);
  return {
    apps: apps2,
    token: typeof token === "string" ? token : void 0
  };
}
function extractInitial(data, numeric) {
  const ordered = numeric ? [NUMERIC_LAYOUT, NAME_LAYOUT] : [NAME_LAYOUT, NUMERIC_LAYOUT];
  for (const layout of ordered) {
    const extracted = extractLayout(data, layout);
    if (extracted !== void 0) return extracted;
  }
  return {
    apps: [],
    token: void 0
  };
}
async function fetchDeveloperFirstPage(query, resolveClient) {
  const numeric = isNumericDevId(query.devId);
  const client = resolveClient(query);
  const initial = extractInitial(parseScriptData(await client.request({ url: developerUrl(query.devId, query.lang, query.country) }), developerScriptDataSelection), numeric);
  return {
    client,
    apps: initial.apps,
    token: initial.token
  };
}
function createDeveloper(getApp, resolveClient = clientFromOptions) {
  return async function developer2(options) {
    const parsed = parseOptions(developerOptionsSchema, options, DEVELOPER_CONTEXT);
    const { client, apps: apps2, token } = await fetchDeveloperFirstPage(parsed, resolveClient);
    const sliced = (await fetchClusterApps({
      client,
      lang: parsed.lang,
      country: parsed.country,
      num: parsed.num,
      initialApps: apps2,
      initialToken: token,
      itemSpecs: clusterItemSpecs,
      appsPath: CLUSTER_MAPPINGS.apps,
      tokenPath: CLUSTER_MAPPINGS.token,
      context: DEVELOPER_CONTEXT,
      onDegradation: parsed.onDegradation,
      onIntegrityEvent: parsed.onIntegrityEvent
    })).slice(0, parsed.num);
    if (parsed.fullDetail) return resolveFullDetail(sliced, parsed, getApp);
    return array(developerAppSchema).parse(sliced);
  };
}
var developer = createDeveloper(app);
var similarAppSchema = appItemSchema;
var shape$1 = similarAppSchema.shape;
var REQUIRED$1 = required2();
var OPTIONAL$1 = optional2();
var CLUSTERS_RPC_ID = "ag2B9c";
var CLUSTERS_PATH = [1, 1];
var CLUSTER_MAPPING = {
  title: [
    21,
    1,
    0
  ],
  url: [
    21,
    1,
    2,
    4,
    2
  ]
};
var SIMILAR_APPS = "Similar apps";
var SIMILAR_GAMES = "Similar games";
var CLUSTER_PAGE_MAPPINGS = {
  apps: [
    0,
    1,
    0,
    21,
    0
  ],
  token: [
    0,
    1,
    0,
    21,
    1,
    3,
    1
  ]
};
var similarDetailsRootSpec = {
  rpcId: CLUSTERS_RPC_ID,
  paths: [],
  schema: union([tuple([]), rawArrayPathSchema(CLUSTERS_PATH, nullable(array(unknown())))]),
  missing: defaulted(() => [])
};
var similarClusterPageRootSpec = {
  paths: [["ds:3"]],
  schema: union([tuple([tuple([])]), rawArrayPathSchema(CLUSTER_PAGE_MAPPINGS.apps, array(unknown()))]),
  missing: required2()
};
var similarDetailsScriptDataSelection = deriveScriptDataSelection([similarDetailsRootSpec]);
var similarClusterScriptDataSelection = deriveScriptDataSelection([similarClusterPageRootSpec]);
var PAGINATION_MAPPINGS = {
  apps: [
    0,
    0,
    0
  ],
  token: [
    0,
    0,
    7,
    1
  ]
};
function similarDetailsUrl(appId, country) {
  return `${BASE_URL}/store/apps/details?${new URLSearchParams({
    id: appId,
    hl: "en",
    gl: country
  }).toString()}`;
}
function similarClusterUrl(clusterPath, lang, country) {
  return `${BASE_URL}${clusterPath}&gl=${country}&hl=${lang}`;
}
function findSimilarClusterPath(data, onIntegrityEvent) {
  const clusters2 = getPath(resolveScriptRoot(data, similarDetailsRootSpec, "similar details", onIntegrityEvent).root, CLUSTERS_PATH);
  if (Array.isArray(clusters2)) for (const cluster of clusters2) {
    const title = getPath(cluster, CLUSTER_MAPPING.title);
    if (title === SIMILAR_APPS || title === SIMILAR_GAMES) {
      const clusterPath = getPath(cluster, CLUSTER_MAPPING.url);
      if (typeof clusterPath === "string") return clusterPath;
    }
  }
}
var similarItemSpecs = {
  title: {
    paths: [[3]],
    missing: REQUIRED$1,
    schema: shape$1.title
  },
  appId: {
    paths: [[0, 0]],
    missing: REQUIRED$1,
    schema: shape$1.appId
  },
  url: {
    paths: [[
      10,
      4,
      2
    ]],
    missing: REQUIRED$1,
    schema: shape$1.url,
    transform: resolveAppUrl
  },
  icon: {
    paths: [[
      1,
      3,
      2
    ]],
    missing: REQUIRED$1,
    schema: shape$1.icon
  },
  developer: {
    paths: [[14]],
    missing: REQUIRED$1,
    schema: shape$1.developer
  },
  currency: {
    paths: [[
      8,
      1,
      0,
      1
    ]],
    missing: OPTIONAL$1,
    schema: shape$1.currency
  },
  price: {
    paths: [[
      8,
      1,
      0,
      0
    ]],
    missing: defaulted(() => 0),
    schema: shape$1.price,
    transform: microsToUnits
  },
  free: {
    paths: [[
      8,
      1,
      0,
      0
    ]],
    missing: defaulted(() => false),
    schema: shape$1.free,
    transform: isFreeMicros
  },
  summary: {
    paths: [[13, 1]],
    missing: OPTIONAL$1,
    schema: shape$1.summary
  },
  scoreText: {
    paths: [[4, 0]],
    missing: OPTIONAL$1,
    schema: shape$1.scoreText
  },
  score: {
    paths: [[4, 1]],
    missing: OPTIONAL$1,
    schema: shape$1.score
  }
};
var similarOptionsSchema = extend2(baseOptionsSchema, {
  appId: string2().check(_minLength(1)),
  fullDetail: _default(boolean2(), false)
});
var SIMILAR_CONTEXT = "similar";
function extractClusterPage(root) {
  const appsData = getPath(root, CLUSTER_PAGE_MAPPINGS.apps);
  const apps2 = Array.isArray(appsData) ? appsData.map((item) => extract(item, similarItemSpecs, SIMILAR_CONTEXT)) : [];
  const token = getPath(root, CLUSTER_PAGE_MAPPINGS.token);
  return {
    apps: apps2,
    token: typeof token === "string" ? token : void 0
  };
}
function createSimilar(getApp, resolveClient = clientFromOptions) {
  return async function similar2(options) {
    const parsed = parseOptions(similarOptionsSchema, options, SIMILAR_CONTEXT);
    const client = resolveClient(parsed);
    const clusterPath = findSimilarClusterPath(parseScriptData(await client.request({ url: similarDetailsUrl(parsed.appId, parsed.country) }), similarDetailsScriptDataSelection), parsed.onIntegrityEvent);
    if (clusterPath === void 0) return array(similarAppSchema).parse([]);
    const page = extractClusterPage(resolveScriptRoot(parseScriptData(await client.request({ url: similarClusterUrl(clusterPath, parsed.lang, parsed.country) }), similarClusterScriptDataSelection), similarClusterPageRootSpec, "similar cluster page", parsed.onIntegrityEvent).root);
    const items = await fetchClusterApps({
      client,
      lang: parsed.lang,
      country: parsed.country,
      num: 100,
      initialApps: page.apps,
      initialToken: page.token,
      itemSpecs: clusterItemSpecs,
      appsPath: PAGINATION_MAPPINGS.apps,
      tokenPath: PAGINATION_MAPPINGS.token,
      context: SIMILAR_CONTEXT,
      onDegradation: parsed.onDegradation,
      onIntegrityEvent: parsed.onIntegrityEvent
    });
    if (parsed.fullDetail) return resolveFullDetail(items, parsed, getApp);
    return array(similarAppSchema).parse(items);
  };
}
var similar = createSimilar(app);
var reviewCriteriaSchema = object({
  criteria: string2(),
  rating: nullable(number2())
});
var reviewSchema = object({
  id: string2(),
  userName: string2(),
  userImage: optional(url()),
  date: iso_exports.datetime(),
  score: number2().check(_gte(1), _lte(5)),
  title: optional(nullable(string2())),
  text: optional(string2()),
  replyDate: optional(iso_exports.datetime()),
  replyText: optional(string2()),
  version: optional(string2()),
  thumbsUp: optional(number2()),
  criterias: _default(array(reviewCriteriaSchema), [])
});
var reviewsResultSchema = object({
  data: array(reviewSchema),
  nextPaginationToken: nullable(string2())
});
var REVIEWS_RPC_ID = "UsvDTd";
var REVIEWS_STATIC_QUERY = "rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0";
var REVIEWS_TRAILING_QUERY = "authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213";
function reviewsUrl(lang, country) {
  return `${BASE_URL}/_/PlayStoreUi/data/batchexecute?${REVIEWS_STATIC_QUERY}&hl=${lang}&gl=${country}&${REVIEWS_TRAILING_QUERY}`;
}
function buildInitialReviewsBody(sort2, appId) {
  return `f.req=%5B%5B%5B%22UsvDTd%22%2C%22%5Bnull%2Cnull%2C%5B2%2C${sort2.toString()}%2C%5B${150 .toString()}%2Cnull%2Cnull%5D%2Cnull%2C%5B%5D%5D%2C%5B%5C%22${appId}%5C%22%2C7%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D`;
}
function buildPaginatedReviewsBody(sort2, appId, withToken) {
  return `f.req=%5B%5B%5B%22UsvDTd%22%2C%22%5Bnull%2Cnull%2C%5B2%2C${sort2.toString()}%2C%5B${150 .toString()}%2Cnull%2C%5C%22${withToken}%5C%22%5D%2Cnull%2C%5B%5D%5D%2C%5B%5C%22${appId}%5C%22%2C7%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D`;
}
var REVIEWS_RESPONSE_PATHS = {
  reviews: [0],
  token: [1, 1]
};
var reviewsCollectionResponseSchema = union([
  literal(null),
  tuple([]),
  rawArrayPathSchema(REVIEWS_RESPONSE_PATHS.reviews, nullable(array(unknown())))
]);
var reviewsTokenResponseSchema = union([literal(null), rawOptionalArrayPathSchema(REVIEWS_RESPONSE_PATHS.token, nullable(string2()))]);
var shape = reviewSchema.shape;
var REQUIRED = required2();
var OPTIONAL = optional2();
var MILLISECONDS_PER_SECOND = 1e3;
var NANOSECONDS_PER_MILLISECOND = 1e6;
var dateTupleSchema = tuple([int().check(_gte(0)), optional(nullable(int().check(_gte(0), _lte(999999999))))], unknown());
function generateDate(value) {
  const parsed = dateTupleSchema.safeParse(value);
  if (!parsed.success) return;
  const [seconds, nanos] = parsed.data;
  const milliseconds = seconds * MILLISECONDS_PER_SECOND + Math.floor((nanos ?? 0) / NANOSECONDS_PER_MILLISECOND);
  const date3 = new Date(milliseconds);
  return Number.isNaN(date3.getTime()) ? void 0 : date3.toISOString();
}
function alwaysNull() {
  return null;
}
function emptyToUndefined(value) {
  return typeof value === "string" && value.length > 0 ? value : void 0;
}
function cleanReplyText(value) {
  return emptyToUndefined(sanitizeText(value));
}
function buildCriteria(entry) {
  if (!Array.isArray(entry)) return {
    criteria: void 0,
    rating: null
  };
  const fields = entry;
  const ratingHolder = fields[1];
  const ratingFields = Array.isArray(ratingHolder) ? ratingHolder : [];
  const rating = ratingFields.length > 0 ? ratingFields[0] : null;
  return {
    criteria: fields[0],
    rating
  };
}
function mapCriterias(value) {
  return Array.isArray(value) ? value.map(buildCriteria) : [];
}
var reviewItemSpecs = {
  id: {
    paths: [[0]],
    missing: REQUIRED,
    schema: shape.id
  },
  userName: {
    paths: [[1, 0]],
    missing: REQUIRED,
    schema: shape.userName
  },
  userImage: {
    paths: [[
      1,
      1,
      3,
      2
    ]],
    missing: OPTIONAL,
    schema: shape.userImage
  },
  date: {
    paths: [[5]],
    missing: REQUIRED,
    schema: shape.date,
    transform: generateDate
  },
  score: {
    paths: [[2]],
    missing: REQUIRED,
    schema: shape.score
  },
  title: {
    paths: [[0]],
    missing: REQUIRED,
    schema: shape.title,
    transform: alwaysNull
  },
  text: {
    paths: [[4]],
    missing: OPTIONAL,
    schema: shape.text,
    transform: sanitizeText
  },
  replyDate: {
    paths: [[7, 2]],
    missing: OPTIONAL,
    schema: shape.replyDate,
    transform: generateDate
  },
  replyText: {
    paths: [[7, 1]],
    missing: OPTIONAL,
    schema: shape.replyText,
    transform: cleanReplyText
  },
  version: {
    paths: [[10]],
    missing: OPTIONAL,
    schema: shape.version,
    transform: emptyToUndefined
  },
  thumbsUp: {
    paths: [[6]],
    missing: OPTIONAL,
    schema: shape.thumbsUp
  },
  criterias: {
    paths: [[12, 0]],
    missing: defaulted(() => []),
    schema: shape.criterias,
    transform: mapCriterias
  }
};
var REVIEWS_CONTEXT = "reviews";
var sortSchema = _default(union([
  literal(sort.NEWEST),
  literal(sort.RATING),
  literal(sort.HELPFULNESS)
]), sort.NEWEST);
var reviewsOptionsSchema = extend2(baseOptionsSchema, {
  appId: string2().check(_minLength(1)),
  sort: sortSchema,
  num: _default(int().check(_gte(1)), 150),
  paginate: _default(boolean2(), false),
  nextPaginationToken: optional(string2())
});
function reviewsBody(options, token) {
  return token === void 0 ? buildInitialReviewsBody(options.sort, options.appId) : buildPaginatedReviewsBody(options.sort, options.appId, token);
}
async function fetchReviewsPage(client, options, token) {
  const payload = parseBatchResponse(await client.request({
    url: reviewsUrl(options.lang, options.country),
    method: "POST",
    body: reviewsBody(options, token)
  }), REVIEWS_RPC_ID);
  parseRaw(reviewsCollectionResponseSchema, payload, `${REVIEWS_CONTEXT} collection response`);
  parseRaw(reviewsTokenResponseSchema, payload, `${REVIEWS_CONTEXT} token response`);
  const rawReviews = getPath(payload, REVIEWS_RESPONSE_PATHS.reviews);
  const reviews2 = Array.isArray(rawReviews) ? rawReviews.map((item) => extract(item, reviewItemSpecs, REVIEWS_CONTEXT)) : [];
  const rawToken = getPath(payload, REVIEWS_RESPONSE_PATHS.token);
  return {
    reviews: reviews2,
    token: typeof rawToken === "string" && rawToken.length > 0 ? rawToken : void 0
  };
}
async function fetchSinglePage(client, options) {
  const page = await fetchReviewsPage(client, options, options.nextPaginationToken);
  return reviewsResultSchema.parse({
    data: page.reviews,
    nextPaginationToken: page.token ?? null
  });
}
async function* reviewPages(client, options) {
  const seenTokens = /* @__PURE__ */ new Set();
  let token = options.nextPaginationToken;
  for (; ; ) {
    const page = await fetchReviewsPage(client, options, token);
    yield page;
    if (page.token === void 0) return;
    if (detectPaginationTokenCycle(seenTokens, page.token, REVIEWS_CONTEXT, options.onIntegrityEvent)) return;
    token = page.token;
  }
}
async function accumulateReviews(client, options) {
  const collected = [];
  for await (const page of reviewPages(client, options)) {
    for (const review of page.reviews) collected.push(review);
    if (collected.length >= options.num) break;
  }
  return reviewsResultSchema.parse({
    data: collected.slice(0, options.num),
    nextPaginationToken: null
  });
}
function createReviews(resolveClient = clientFromOptions) {
  return async function reviews2(options) {
    const parsed = parseOptions(reviewsOptionsSchema, options, REVIEWS_CONTEXT);
    const client = resolveClient(parsed);
    return parsed.paginate ? fetchSinglePage(client, parsed) : accumulateReviews(client, parsed);
  };
}
var reviews = createReviews();
var REVIEWS_ITERATOR_CONTEXT = "reviewsIterator";
var reviewsIteratorOptionsSchema = omit2(reviewsOptionsSchema, {
  num: true,
  paginate: true
});
var reviewArraySchema = array(reviewSchema);
async function* streamReviews(client, options) {
  for await (const page of reviewPages(client, options)) for (const review of reviewArraySchema.parse(page.reviews)) yield review;
}
function createReviewsIterator(resolveClient = clientFromOptions) {
  return function reviewsIterator2(options) {
    const parsed = parseOptions(reviewsIteratorOptionsSchema, options, REVIEWS_ITERATOR_CONTEXT);
    return streamReviews(resolveClient(parsed), parsed);
  };
}
var reviewsIterator = createReviewsIterator();
var REVIEWS_ALL_CONTEXT = "reviewsAll";
var reviewsAllOptionsSchema = extend2(reviewsIteratorOptionsSchema, { maxReviews: optional(int().check(_gte(1))) });
function createReviewsAll(resolveClient = clientFromOptions) {
  const reviewsIterator2 = createReviewsIterator(resolveClient);
  return async function reviewsAll2(options) {
    const { maxReviews, ...iteratorOptions } = parseOptions(reviewsAllOptionsSchema, options, REVIEWS_ALL_CONTEXT);
    const collected = [];
    for await (const review of reviewsIterator2(iteratorOptions)) {
      collected.push(review);
      if (maxReviews !== void 0 && collected.length >= maxReviews) break;
    }
    return collected;
  };
}
var reviewsAll = createReviewsAll();
var SEARCH_ITERATOR_CONTEXT = "searchIterator";
var searchIteratorOptionsSchema = omit2(searchOptionsSchema, {
  num: true,
  fullDetail: true
});
async function* streamSearch(options, resolveClient) {
  const { client, page } = await fetchSearchFirstPage(options, resolveClient);
  const pages = clusterPages({
    client,
    lang: options.lang,
    country: options.country,
    initialApps: page.apps,
    initialToken: page.token,
    itemSpecs: searchPageItemSpecs,
    appsPath: CLUSTER_MAPPINGS$1.apps,
    tokenPath: CLUSTER_MAPPINGS$1.token,
    context: SEARCH_CONTEXT,
    onDegradation: options.onDegradation,
    onIntegrityEvent: options.onIntegrityEvent
  });
  for await (const clusterPage of pages) for (const item of filterByPrice(clusterPage, options.price)) yield searchResultSchema.parse(item);
}
function createSearchIterator(resolveClient = clientFromOptions) {
  return function searchIterator2(options) {
    return streamSearch(parseOptions(searchIteratorOptionsSchema, options, SEARCH_ITERATOR_CONTEXT), resolveClient);
  };
}
var searchIterator = createSearchIterator();
var DEVELOPER_ITERATOR_CONTEXT = "developerIterator";
var developerIteratorOptionsSchema = omit2(developerOptionsSchema, {
  num: true,
  fullDetail: true
});
async function* streamDeveloper(options, resolveClient) {
  const { client, apps: apps2, token } = await fetchDeveloperFirstPage(options, resolveClient);
  const pages = clusterPages({
    client,
    lang: options.lang,
    country: options.country,
    initialApps: apps2,
    initialToken: token,
    itemSpecs: clusterItemSpecs,
    appsPath: CLUSTER_MAPPINGS.apps,
    tokenPath: CLUSTER_MAPPINGS.token,
    context: DEVELOPER_CONTEXT,
    onDegradation: options.onDegradation,
    onIntegrityEvent: options.onIntegrityEvent
  });
  for await (const page of pages) for (const item of page) yield developerAppSchema.parse(item);
}
function createDeveloperIterator(resolveClient = clientFromOptions) {
  return function developerIterator2(options) {
    return streamDeveloper(parseOptions(developerIteratorOptionsSchema, options, DEVELOPER_ITERATOR_CONTEXT), resolveClient);
  };
}
var developerIterator = createDeveloperIterator();
var permissionTypeSchema = union([literal(permission.COMMON), literal(permission.OTHER)]);
var permissionSchema = object({
  permission: string2(),
  type: permissionTypeSchema
});
var PERMISSIONS_RPC_ID = "xdSrCf";
var PERMISSIONS_STATIC_QUERY = "rpcids=qnKhOb&f.sid=-697906427155521722&bl=boq_playuiserver_20190903.08_p0";
var PERMISSIONS_TRAILING_QUERY = "authuser&soc-app=121&soc-platform=1&soc-device=1&_reqid=1065213";
function permissionsUrl(lang, country) {
  return `${BASE_URL}/_/PlayStoreUi/data/batchexecute?${PERMISSIONS_STATIC_QUERY}&hl=${lang}&gl=${country}&${PERMISSIONS_TRAILING_QUERY}`;
}
function buildPermissionsBody(appId) {
  return buildBatchBody(PERMISSIONS_RPC_ID, [[
    null,
    [appId, 7],
    []
  ]], [null, "1"]);
}
var PERMISSION_SECTIONS = [permission.COMMON, permission.OTHER];
var permissionSectionSchema = nullable(array(unknown()));
var commonPermissionsResponseSchema = union([literal(null), rawOptionalArrayPathSchema([permission.COMMON], permissionSectionSchema)]);
var otherPermissionsResponseSchema = union([literal(null), rawOptionalArrayPathSchema([permission.OTHER], permissionSectionSchema)]);
var GROUP_PERMISSIONS_PATH = [2];
var PERMISSION_TEXT_PATH = [1];
function sectionEntries(section, type) {
  if (!Array.isArray(section)) return [];
  const entries = [];
  for (const group of section) {
    const groupPermissions = getPath(group, GROUP_PERMISSIONS_PATH);
    if (!Array.isArray(groupPermissions)) continue;
    for (const groupPermission of groupPermissions) {
      const text = getPath(groupPermission, PERMISSION_TEXT_PATH);
      if (typeof text === "string" && text.length > 0) entries.push({
        permission: text,
        type
      });
    }
  }
  return entries;
}
function mapPermissions(payload) {
  if (!Array.isArray(payload)) return [];
  return PERMISSION_SECTIONS.flatMap((type) => sectionEntries(payload[type], type));
}
var PERMISSIONS_CONTEXT = "permissions";
var permissionsOptionsSchema = extend2(baseOptionsSchema, {
  appId: string2().check(_minLength(1)),
  short: _default(boolean2(), false)
});
var permissionsResultSchema = array(permissionSchema);
function createPermissions(resolveClient = clientFromOptions) {
  return async function permissions2(options) {
    const parsed = parseOptions(permissionsOptionsSchema, options, PERMISSIONS_CONTEXT);
    const payload = parseBatchResponse(await resolveClient(parsed).request({
      url: permissionsUrl(parsed.lang, parsed.country),
      method: "POST",
      body: buildPermissionsBody(parsed.appId)
    }), PERMISSIONS_RPC_ID);
    parseRaw(commonPermissionsResponseSchema, payload, `${PERMISSIONS_CONTEXT} common response`);
    parseRaw(otherPermissionsResponseSchema, payload, `${PERMISSIONS_CONTEXT} other response`);
    const entries = permissionsResultSchema.parse(mapPermissions(payload));
    if (!parsed.short) return entries;
    return entries.filter((entry) => entry.type === permission.COMMON).map((entry) => entry.permission);
  };
}
var permissions = createPermissions();
var dataEntrySchema = object({
  data: string2(),
  optional: boolean2(),
  purpose: optional(string2()),
  type: string2()
});
var securityPracticeSchema = object({
  practice: string2(),
  description: optional(string2())
});
var dataSafetySchema = object({
  sharedData: _default(array(dataEntrySchema), []),
  collectedData: _default(array(dataEntrySchema), []),
  securityPractices: _default(array(securityPracticeSchema), []),
  privacyPolicyUrl: optional(url())
});
var DATA_SAFETY_RPC_ID = "Ws7gDc";
var SHARED_DATA_PATH = [
  1,
  2,
  1,
  "138",
  4,
  0,
  0
];
var COLLECTED_DATA_PATH = [
  1,
  2,
  1,
  "138",
  4,
  1,
  0
];
var SECURITY_PRACTICES_PATH = [
  1,
  2,
  1,
  "138",
  9,
  2
];
var PRIVACY_POLICY_PATH = [
  1,
  2,
  1,
  "100",
  0,
  5,
  2
];
var ENTRY_TYPE_PATH = [0, 1];
var ENTRY_DETAILS_PATH = [4];
var DETAIL_DATA_PATH = [0];
var DETAIL_OPTIONAL_PATH = [1];
var DETAIL_PURPOSE_PATH = [2];
var PRACTICE_LABEL_PATH = [1];
var PRACTICE_DESCRIPTION_PATH = [2, 1];
function isOptionalArray(value) {
  return value === void 0 || value === null || Array.isArray(value);
}
function isDataSafetyReportRoot(value) {
  const node = getPath(value, [
    1,
    2,
    1
  ]);
  if (!isRecord(node) || !("138" in node) && !("100" in node)) return false;
  return isOptionalArray(getPath(value, SHARED_DATA_PATH)) && isOptionalArray(getPath(value, COLLECTED_DATA_PATH)) && isOptionalArray(getPath(value, SECURITY_PRACTICES_PATH));
}
var dataSafetyRootSpec = {
  rpcId: DATA_SAFETY_RPC_ID,
  paths: [["ds:3"]],
  schema: union([tuple([]), custom(isDataSafetyReportRoot)]),
  missing: required2()
};
var dataSafetyScriptDataSelection = deriveScriptDataSelection([dataSafetyRootSpec]);
function mapDataEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const type = getPath(entry, ENTRY_TYPE_PATH);
    const details = getPath(entry, ENTRY_DETAILS_PATH);
    if (!Array.isArray(details)) return [];
    return details.map((detail) => ({
      data: getPath(detail, DETAIL_DATA_PATH),
      optional: Boolean(getPath(detail, DETAIL_OPTIONAL_PATH)),
      purpose: getPath(detail, DETAIL_PURPOSE_PATH),
      type
    }));
  });
}
function mapSecurityPractices(value) {
  if (!Array.isArray(value)) return [];
  return value.map((practice) => ({
    practice: getPath(practice, PRACTICE_LABEL_PATH),
    description: getPath(practice, PRACTICE_DESCRIPTION_PATH)
  }));
}
var dataSafetySpecs = {
  sharedData: {
    paths: [SHARED_DATA_PATH],
    missing: defaulted(() => []),
    schema: _default(array(dataEntrySchema), []),
    transform: mapDataEntries
  },
  collectedData: {
    paths: [COLLECTED_DATA_PATH],
    missing: defaulted(() => []),
    schema: _default(array(dataEntrySchema), []),
    transform: mapDataEntries
  },
  securityPractices: {
    paths: [SECURITY_PRACTICES_PATH],
    missing: defaulted(() => []),
    schema: _default(array(securityPracticeSchema), []),
    transform: mapSecurityPractices
  },
  privacyPolicyUrl: {
    paths: [PRIVACY_POLICY_PATH],
    missing: optional2(),
    schema: optional(url())
  }
};
var DATA_SAFETY_CONTEXT = "dataSafety";
var dataSafetyOptionsSchema = extend2(baseOptionsSchema, { appId: string2().check(_minLength(1)) });
var DATA_SAFETY_URL = `${BASE_URL}/store/apps/datasafety`;
var MISSING_APP_MARKER = "<title>Not Found</title>";
function emptyDataSafetyReport() {
  return dataSafetySchema.parse({
    sharedData: [],
    collectedData: [],
    securityPractices: [],
    privacyPolicyUrl: void 0
  });
}
function createDataSafety(resolveClient = clientFromOptions) {
  return async function dataSafety2(options) {
    const parsed = parseOptions(dataSafetyOptionsSchema, options, DATA_SAFETY_CONTEXT);
    const params = new URLSearchParams({
      id: parsed.appId,
      hl: parsed.lang
    });
    const url2 = `${DATA_SAFETY_URL}?${params.toString()}`;
    const html = await resolveClient(parsed).request({ url: url2 });
    if (html.includes(MISSING_APP_MARKER)) return emptyDataSafetyReport();
    const extracted = extract(resolveScriptRoot(parseScriptData(html, dataSafetyScriptDataSelection), dataSafetyRootSpec, `${DATA_SAFETY_CONTEXT} root`, parsed.onIntegrityEvent).root, dataSafetySpecs, DATA_SAFETY_CONTEXT);
    return dataSafetySchema.parse(extracted);
  };
}
var dataSafety = createDataSafety();
var DEFAULT_MAX_AGE_MS = 1e3 * 60 * 5;
var clientOptionsSchema = object({
  lang: optional(string2().check(_minLength(2), _maxLength(7))),
  country: optional(string2().check(_length(2))),
  throttle: optional(number2().check(_positive(), _lte(50))),
  requestOptions: optional(requestOptionsSchema)
});
var CLIENT_CONTEXT = "client";
function mergeRequestOptions(base, override) {
  if (base === void 0 || override === void 0) return override ?? base;
  return {
    ...base,
    ...override
  };
}
function createClient(options) {
  const parsed = parseOptions(clientOptionsSchema, options ?? {}, CLIENT_CONTEXT);
  const limiter = parsed.throttle !== void 0 ? createRateLimiter(parsed.throttle) : void 0;
  const resolveClient = (opts) => {
    const requestOptions = mergeRequestOptions(parsed.requestOptions, opts.requestOptions);
    if (limiter !== void 0) return createHttpClient({
      limiter,
      fetchImpl: requestOptions?.fetchImpl,
      retries: requestOptions?.retries,
      timeoutMs: requestOptions?.timeoutMs,
      headers: requestOptions?.headers,
      signal: requestOptions?.signal,
      onRequest: requestOptions?.onRequest,
      onResponse: requestOptions?.onResponse,
      onRetry: requestOptions?.onRetry
    });
    return clientFromOptions({
      throttle: opts.throttle,
      requestOptions
    });
  };
  const mergeDefaults = (callOptions) => {
    const merged = { ...callOptions };
    if (merged.lang === void 0 && parsed.lang !== void 0) merged.lang = parsed.lang;
    if (merged.country === void 0 && parsed.country !== void 0) merged.country = parsed.country;
    return merged;
  };
  const boundApp = createApp(resolveClient);
  const boundApps = createApps(boundApp);
  const boundAvailability = createAvailability(resolveClient);
  const boundSearch = createSearch(boundApp, resolveClient);
  const boundList = createList(boundApp, resolveClient);
  const boundDeveloper = createDeveloper(boundApp, resolveClient);
  const boundSimilar = createSimilar(boundApp, resolveClient);
  const boundSuggest = createSuggest(resolveClient);
  const boundReviews = createReviews(resolveClient);
  const boundReviewsIterator = createReviewsIterator(resolveClient);
  const boundReviewsAll = createReviewsAll(resolveClient);
  const boundSearchIterator = createSearchIterator(resolveClient);
  const boundDeveloperIterator = createDeveloperIterator(resolveClient);
  const boundPermissions = createPermissions(resolveClient);
  const boundDataSafety = createDataSafety(resolveClient);
  return {
    BASE_URL,
    age,
    category,
    clusters,
    collection,
    permission,
    sort,
    app: (callOptions) => boundApp(mergeDefaults(callOptions)),
    apps: (callOptions) => boundApps(mergeDefaults(callOptions)),
    availability: (callOptions) => boundAvailability(mergeDefaults(callOptions)),
    search: (callOptions) => boundSearch(mergeDefaults(callOptions)),
    suggest: (callOptions) => boundSuggest(mergeDefaults(callOptions)),
    list: (callOptions) => boundList(mergeDefaults(callOptions)),
    categories: (callOptions) => categories(callOptions),
    developer: (callOptions) => boundDeveloper(mergeDefaults(callOptions)),
    similar: (callOptions) => boundSimilar(mergeDefaults(callOptions)),
    reviews: (callOptions) => boundReviews(mergeDefaults(callOptions)),
    reviewsIterator: (callOptions) => boundReviewsIterator(mergeDefaults(callOptions)),
    reviewsAll: (callOptions) => boundReviewsAll(mergeDefaults(callOptions)),
    searchIterator: (callOptions) => boundSearchIterator(mergeDefaults(callOptions)),
    developerIterator: (callOptions) => boundDeveloperIterator(mergeDefaults(callOptions)),
    permissions: (callOptions) => boundPermissions(mergeDefaults(callOptions)),
    dataSafety: (callOptions) => boundDataSafety(mergeDefaults(callOptions))
  };
}

// src/connectors/google.js
var googlePlayConnector = defineConnector({
  id: "google-play",
  name: "Google Play public reviews",
  version: "1",
  supports: (source) => source?.store === "google-play",
  fetch: fetchGoogleReviews
});
async function fetchGoogleReviews(source, options = {}) {
  const country = (options.country ?? source.country ?? "US").toLowerCase();
  const language = normalizeLanguage(options.language ?? source.language ?? "en");
  const limit = clamp3(options.limit ?? 300, 1, 2e3);
  const client = createClient({ country, lang: language, throttle: clamp3(options.throttle ?? 2, 0, 20) });
  try {
    const app2 = await client.app({ appId: source.appId, requestOptions: { signal: options.signal } });
    const result = await client.reviews({
      appId: source.appId,
      sort: sort.NEWEST,
      num: limit,
      requestOptions: { signal: options.signal }
    });
    return {
      app: {
        id: source.appId,
        name: app2.title,
        icon: app2.icon ?? null,
        developer: app2.developer ?? null,
        url: app2.url ?? source.canonicalUrl,
        store: "google-play"
      },
      reviews: result.data.map((review) => normalizeGoogleReview(review, source, { country, language })),
      metadata: {
        connector: googlePlayConnector.id,
        connectorVersion: googlePlayConnector.version,
        country: country.toUpperCase(),
        language,
        hasNextPage: Boolean(result.nextPaginationToken),
        package: "@mradex77/google-play-scraper"
      }
    };
  } catch (error) {
    if (error instanceof ConnectorError) throw error;
    if (error?.name === "NotFoundError") throw new ConnectorError("google-play", "Google Play application not found.", { status: 404, cause: error });
    if (error?.name === "RateLimitError" || error?.name === "BlockedError") {
      throw new ConnectorError("google-play", "Google Play temporarily limited the request. Retry later.", { status: 429, retryable: true, cause: error });
    }
    const aborted2 = options.signal?.aborted || error?.name === "AbortError" || error?.name === "TimeoutError";
    throw new ConnectorError("google-play", aborted2 ? "Google Play request was aborted." : `Google Play request failed: ${error instanceof Error ? error.message : String(error)}`, {
      retryable: !aborted2,
      cause: error
    });
  }
}
function normalizeGoogleReview(review, source, { country = "us", language = "en" } = {}) {
  return normalizeReview({
    source: "google-play",
    appId: source.appId,
    reviewId: review.id,
    title: review.title,
    body: review.text,
    rating: review.score,
    language,
    country: country.toUpperCase(),
    appVersion: review.version,
    author: review.userName,
    helpfulCount: review.thumbsUp,
    reply: review.replyText ? { body: review.replyText, createdAt: review.replyDate ?? null } : null,
    sourceUrl: source.canonicalUrl,
    createdAt: review.date,
    updatedAt: review.date
  });
}
function normalizeLanguage(value) {
  return String(value).toLowerCase().split(/[-_]/)[0] || "en";
}
function clamp3(value, min, max) {
  const number4 = Number.parseInt(value, 10);
  return Number.isInteger(number4) ? Math.min(max, Math.max(min, number4)) : min;
}

// src/connectors/index.js
function createDefaultRegistry({ includeDemo = false } = {}) {
  const connectors = [appleConnector, googlePlayConnector];
  if (includeDemo) connectors.push(demoConnector);
  return new ConnectorRegistry(connectors);
}

// src/source-ref.js
var APPLE_HOSTS = /* @__PURE__ */ new Set(["apps.apple.com", "itunes.apple.com"]);
var GOOGLE_HOSTS = /* @__PURE__ */ new Set(["play.google.com"]);
var UnsupportedStoreUrlError = class extends Error {
  constructor(input2) {
    super(`Unsupported App Store or Google Play URL: ${input2}`);
    this.name = "UnsupportedStoreUrlError";
    this.input = input2;
  }
};
function parseSourceRef(input2) {
  let url2;
  try {
    url2 = new URL(input2);
  } catch {
    throw new UnsupportedStoreUrlError(input2);
  }
  if (!["http:", "https:"].includes(url2.protocol)) throw new UnsupportedStoreUrlError(input2);
  const host = url2.hostname.toLowerCase();
  if (APPLE_HOSTS.has(host)) {
    const match = url2.pathname.match(/\/id(\d+)(?:\/|$)/i);
    if (!match) throw new UnsupportedStoreUrlError(input2);
    return {
      store: "apple-app-store",
      appId: match[1],
      country: getAppleCountry(url2),
      canonicalUrl: `https://apps.apple.com/app/id${match[1]}`
    };
  }
  if (GOOGLE_HOSTS.has(host) && url2.pathname.replace(/\/$/, "") === "/store/apps/details") {
    const appId = url2.searchParams.get("id")?.trim();
    if (!appId) throw new UnsupportedStoreUrlError(input2);
    return {
      store: "google-play",
      appId,
      country: url2.searchParams.get("gl")?.toUpperCase() ?? null,
      language: url2.searchParams.get("hl") ?? null,
      canonicalUrl: `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`
    };
  }
  throw new UnsupportedStoreUrlError(input2);
}
function getAppleCountry(url2) {
  const firstSegment = url2.pathname.split("/").filter(Boolean)[0];
  return firstSegment && /^[a-z]{2}$/i.test(firstSegment) ? firstSegment.toUpperCase() : null;
}

// src/run-analysis.js
async function analyze(input2, options = {}) {
  const source = toSource(input2);
  const registry = options.registry ?? createDefaultRegistry();
  const primary = await fetchDataset(registry, source, options);
  const competitorSource = options.competitor ? toSource(options.competitor) : null;
  if (competitorSource && sameSource(source, competitorSource)) throw new TypeError("Competitor must be different from the primary application.");
  const competitor = competitorSource ? await fetchDataset(registry, competitorSource, options) : null;
  return analyzeDataset(primary, {
    source,
    competitorDataset: competitor,
    competitorSource,
    generatedAt: options.generatedAt
  });
}
function analyzeDataset(dataset, options = {}) {
  validateDataset(dataset, "primary");
  const source = options.source ?? inferSource(dataset);
  const reviews2 = deduplicateReviews(dataset.reviews);
  if (!reviews2.length) throw new RangeError("The primary dataset contains no analyzable reviews.");
  let report = buildReport({ reviews: reviews2, app: dataset.app, source, generatedAt: options.generatedAt });
  let competitor = null;
  let competitorReviews = [];
  if (options.competitorDataset) {
    validateDataset(options.competitorDataset, "competitor");
    competitor = options.competitorDataset;
    competitorReviews = deduplicateReviews(competitor.reviews);
    if (!competitorReviews.length) throw new RangeError("The competitor dataset contains no analyzable reviews.");
    const competitorReport = buildReport({
      reviews: competitorReviews,
      app: competitor.app,
      source: options.competitorSource ?? inferSource(competitor),
      generatedAt: options.generatedAt
    });
    report = { ...report, comparison: buildComparison(report, competitorReport) };
  }
  const generatedAt = report.generatedAt;
  report = {
    ...report,
    provenance: {
      generatedAt,
      datasets: [
        provenanceFor("primary", source, dataset, reviews2),
        competitor ? provenanceFor("competitor", options.competitorSource ?? inferSource(competitor), competitor, competitorReviews) : null
      ].filter(Boolean)
    }
  };
  return {
    report,
    datasets: {
      primary: { ...dataset, reviews: reviews2 },
      competitor: competitor ? { ...competitor, reviews: competitorReviews } : null
    }
  };
}
async function fetchDataset(registry, source, options) {
  const connector = registry.resolve(source);
  const dataset = await connector.fetch(source, {
    country: options.country,
    language: options.language,
    limit: normalizeLimit(options.limit),
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    attempts: options.attempts,
    userAgent: options.userAgent,
    throttle: options.throttle
  });
  validateDataset(dataset, connector.id);
  return dataset;
}
function validateDataset(dataset, label) {
  if (!dataset || typeof dataset !== "object") throw new TypeError(`${label} connector returned no dataset.`);
  if (!dataset.app || typeof dataset.app.id !== "string" || typeof dataset.app.name !== "string") throw new TypeError(`${label} dataset has invalid app metadata.`);
  if (!Array.isArray(dataset.reviews)) throw new TypeError(`${label} dataset reviews must be an array.`);
}
function toSource(value) {
  if (typeof value === "string") return parseSourceRef(value);
  if (value && typeof value === "object" && typeof value.store === "string" && typeof value.appId === "string") return { ...value };
  throw new TypeError("Source must be an app-store URL or a source object with store and appId.");
}
function inferSource(dataset) {
  return { store: dataset.app.store, appId: dataset.app.id, canonicalUrl: dataset.app.url };
}
function provenanceFor(role, source, dataset, reviews2) {
  return {
    role,
    source: source.store,
    appId: source.appId,
    reviewCount: reviews2.length,
    contentHash: (0, import_node_crypto3.createHash)("sha256").update(stableStringify(reviews2)).digest("hex"),
    connector: dataset.metadata?.connector ?? source.store,
    connectorVersion: dataset.metadata?.connectorVersion ?? null,
    metadata: dataset.metadata ?? {}
  };
}
function stableStringify(value) {
  return JSON.stringify(sortObject(value));
}
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
  return value;
}
function sameSource(left, right) {
  return left.store === right.store && left.appId === right.appId;
}
function normalizeLimit(value) {
  const number4 = Number.parseInt(value ?? "300", 10);
  return Number.isInteger(number4) ? Math.min(2e3, Math.max(1, number4)) : 300;
}

// src/regression.js
var DEFAULT_POLICY = Object.freeze({
  minVersionReviews: 10,
  maxRatingDrop: 0.4,
  maxNegativeShareIncrease: 0.15,
  maxThemeShareIncrease: 0.18,
  maxDiscoveredIssueShare: 0.05,
  minThemeReviews: 3
});
function evaluateRegression(report, options = {}) {
  if (!report?.app || !Array.isArray(report.versions)) throw new TypeError("A valid App Verbatim report is required.");
  const policy = normalizePolicy(options);
  const current = report.versions[0] ?? null;
  const currentEligible = current && current.count >= policy.minVersionReviews;
  const baseline = currentEligible ? report.versions.slice(1).find((version2) => version2.version !== current.version && version2.count >= policy.minVersionReviews) ?? null : null;
  if (!currentEligible || !baseline) {
    const summary = !current ? `Need at least ${policy.minVersionReviews} reviews for the newest version and one earlier baseline; found no version data.` : !currentEligible ? `Newest version ${current.version} has ${current.count} reviews; need at least ${policy.minVersionReviews} before comparing it.` : `Need at least ${policy.minVersionReviews} reviews for an earlier baseline version.`;
    return {
      schemaVersion: 1,
      status: "insufficient-data",
      app: report.app,
      source: report.source,
      evaluatedAt: report.generatedAt,
      currentVersion: current?.version ?? null,
      baselineVersion: baseline?.version ?? null,
      policy,
      metrics: null,
      violations: [],
      summary
    };
  }
  const ratingDrop = round3(baseline.averageRating - current.averageRating, 3);
  const negativeShareIncrease = round3(current.negativeShare - baseline.negativeShare, 3);
  const currentThemes = new Map((current.themeSignals ?? []).map((theme) => [theme.id, theme]));
  const baselineThemes = new Map((baseline.themeSignals ?? []).map((theme) => [theme.id, theme]));
  const themeChanges = [...currentThemes.values()].map((theme) => {
    const previous = baselineThemes.get(theme.id);
    return {
      id: theme.id,
      label: theme.label,
      count: theme.count,
      currentShare: theme.share,
      baselineShare: previous?.share ?? 0,
      shareIncrease: round3(theme.share - (previous?.share ?? 0), 3),
      evidence: theme.evidence ?? []
    };
  }).sort((left, right) => right.shareIncrease - left.shareIncrease || right.count - left.count);
  const discoveredIssueChanges = (report.discoveredIssues ?? []).map((issue2) => {
    const currentVersion = issue2.versions?.find((item) => item.version === current.version);
    const baselineVersion = issue2.versions?.find((item) => item.version === baseline.version);
    const currentCount = currentVersion?.count ?? 0;
    const baselineCount = baselineVersion?.count ?? 0;
    const currentShare = currentCount / current.count;
    const baselineShare = baselineCount / baseline.count;
    return {
      id: issue2.id,
      label: issue2.label,
      currentCount,
      baselineCount,
      currentShare: round3(currentShare, 3),
      baselineShare: round3(baselineShare, 3),
      shareIncrease: round3(currentShare - baselineShare, 3),
      evidence: currentVersion?.evidence ?? (issue2.evidence ?? []).filter((item) => item.appVersion === current.version)
    };
  }).sort((left, right) => right.shareIncrease - left.shareIncrease || right.currentCount - left.currentCount);
  const violations = [];
  if (ratingDrop > policy.maxRatingDrop) {
    violations.push({
      id: "rating-drop",
      severity: ratingDrop >= policy.maxRatingDrop * 1.75 ? "high" : "medium",
      title: `Average rating dropped by ${ratingDrop.toFixed(2)}`,
      message: `Version ${current.version} averages ${current.averageRating} stars versus ${baseline.averageRating} for ${baseline.version}.`,
      value: ratingDrop,
      threshold: policy.maxRatingDrop,
      unit: "stars",
      evidence: current.evidence ?? []
    });
  }
  if (negativeShareIncrease > policy.maxNegativeShareIncrease) {
    violations.push({
      id: "negative-share-increase",
      severity: negativeShareIncrease >= policy.maxNegativeShareIncrease * 1.75 ? "high" : "medium",
      title: `Low-rating share increased by ${percent(negativeShareIncrease)}`,
      message: `One- and two-star reviews are ${percent(current.negativeShare)} for ${current.version} versus ${percent(baseline.negativeShare)} for ${baseline.version}.`,
      value: negativeShareIncrease,
      threshold: policy.maxNegativeShareIncrease,
      unit: "share",
      evidence: current.evidence ?? []
    });
  }
  for (const theme of themeChanges) {
    if (theme.count < policy.minThemeReviews || theme.shareIncrease <= policy.maxThemeShareIncrease) continue;
    violations.push({
      id: `theme-${theme.id}`,
      severity: theme.shareIncrease >= policy.maxThemeShareIncrease * 1.75 ? "high" : "medium",
      title: `${theme.label} complaints increased by ${percent(theme.shareIncrease)}`,
      message: `${theme.count} reviews in ${current.version} mention this theme (${percent(theme.currentShare)}) versus ${percent(theme.baselineShare)} in ${baseline.version}.`,
      value: theme.shareIncrease,
      threshold: policy.maxThemeShareIncrease,
      unit: "share",
      evidence: theme.evidence
    });
  }
  for (const issue2 of discoveredIssueChanges) {
    if (issue2.currentCount < policy.minThemeReviews || issue2.shareIncrease <= policy.maxDiscoveredIssueShare) continue;
    violations.push({
      id: issue2.id,
      severity: issue2.baselineCount === 0 ? "high" : "medium",
      title: `New complaint fingerprint: ${issue2.label}`,
      message: `${issue2.currentCount} reviews in ${current.version} share this previously uncategorized language (${percent(issue2.currentShare)}) versus ${issue2.baselineCount} in ${baseline.version}.`,
      value: issue2.shareIncrease,
      threshold: policy.maxDiscoveredIssueShare,
      unit: "share",
      evidence: issue2.evidence
    });
  }
  const status = violations.length ? "fail" : "pass";
  return {
    schemaVersion: 1,
    status,
    app: report.app,
    source: report.source,
    evaluatedAt: report.generatedAt,
    currentVersion: current.version,
    baselineVersion: baseline.version,
    policy,
    metrics: {
      current: pickVersionMetrics(current),
      baseline: pickVersionMetrics(baseline),
      ratingDrop,
      negativeShareIncrease,
      themeChanges,
      discoveredIssueChanges
    },
    violations,
    summary: status === "fail" ? `${violations.length} release regression ${violations.length === 1 ? "signal exceeds" : "signals exceed"} the configured policy.` : `Version ${current.version} is within the configured regression policy compared with ${baseline.version}.`
  };
}
function regressionToMarkdown(result) {
  if (!result?.status) throw new TypeError("A regression result is required.");
  const icon = result.status === "pass" ? "\u2705" : result.status === "fail" ? "\u274C" : "\u26AA";
  const lines = [
    `# ${icon} ${escapeMarkdown(result.app.name)} review regression check`,
    "",
    `**Status:** ${result.status.toUpperCase()} \xB7 ${escapeMarkdown(result.summary)}`,
    ""
  ];
  if (result.metrics) {
    lines.push(
      `Compared **v${escapeMarkdown(result.currentVersion)}** with **v${escapeMarkdown(result.baselineVersion)}**.`,
      "",
      "| Metric | Current | Baseline | Change | Policy |",
      "| --- | ---: | ---: | ---: | ---: |",
      `| Average rating | ${result.metrics.current.averageRating} | ${result.metrics.baseline.averageRating} | ${signed(result.metrics.ratingDrop * -1, 2)} | drop \u2264 ${result.policy.maxRatingDrop} |`,
      `| One- and two-star share | ${percent(result.metrics.current.negativeShare)} | ${percent(result.metrics.baseline.negativeShare)} | ${signedPercent(result.metrics.negativeShareIncrease)} | increase \u2264 ${percent(result.policy.maxNegativeShareIncrease)} |`,
      ""
    );
  }
  if (result.violations.length) {
    lines.push("## Regression signals", "");
    for (const violation of result.violations) {
      lines.push(`### ${violation.severity === "high" ? "\u{1F534}" : "\u{1F7E0}"} ${escapeMarkdown(violation.title)}`, "", escapeMarkdown(violation.message), "");
      for (const item of violation.evidence.slice(0, 3)) {
        lines.push(`- ${ratingLabel(item.rating)} \xB7 ${item.appVersion ? `v${escapeMarkdown(item.appVersion)} \xB7 ` : ""}${String(item.createdAt).slice(0, 10)} \u2014 \u201C${escapeMarkdown(item.excerpt)}\u201D`);
      }
      lines.push("");
    }
  }
  lines.push(
    "<sub>Generated by [App Verbatim](https://github.com/Nike232/app-verbatim-core). Every signal links back to source reviews; no AI key required.</sub>",
    ""
  );
  return `${lines.join("\n")}
`;
}
function normalizePolicy(options) {
  return {
    minVersionReviews: integer2(options.minVersionReviews, DEFAULT_POLICY.minVersionReviews, 1, 2e3, "minVersionReviews"),
    maxRatingDrop: number3(options.maxRatingDrop, DEFAULT_POLICY.maxRatingDrop, 0, 4, "maxRatingDrop"),
    maxNegativeShareIncrease: number3(options.maxNegativeShareIncrease, DEFAULT_POLICY.maxNegativeShareIncrease, 0, 1, "maxNegativeShareIncrease"),
    maxThemeShareIncrease: number3(options.maxThemeShareIncrease, DEFAULT_POLICY.maxThemeShareIncrease, 0, 1, "maxThemeShareIncrease"),
    maxDiscoveredIssueShare: number3(options.maxDiscoveredIssueShare, DEFAULT_POLICY.maxDiscoveredIssueShare, 0, 1, "maxDiscoveredIssueShare"),
    minThemeReviews: integer2(options.minThemeReviews, DEFAULT_POLICY.minThemeReviews, 1, 2e3, "minThemeReviews")
  };
}
function pickVersionMetrics(version2) {
  return {
    version: version2.version,
    count: version2.count,
    averageRating: version2.averageRating,
    negativeShare: version2.negativeShare
  };
}
function integer2(value, fallback, min, max, name) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  return parsed;
}
function number3(value, fallback, min, max, name) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new RangeError(`${name} must be between ${min} and ${max}.`);
  return parsed;
}
function round3(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
function percent(value) {
  return `${Math.round(value * 100)}%`;
}
function signed(value, digits) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}
function signedPercent(value) {
  return `${value > 0 ? "+" : ""}${Math.round(value * 100)} pp`;
}
function ratingLabel(value) {
  return `${value} ${Number(value) === 1 ? "star" : "stars"}`;
}
function escapeMarkdown(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("@", "@\u200B").replaceAll("|", "\\|").replace(/([*_`[\]])/g, "\\$1");
}

// src/action.js
main().catch((error) => {
  console.error(`::error title=App Verbatim failed::${commandEscape(error instanceof Error ? error.message : String(error))}`);
  process.exitCode = 1;
});
async function main() {
  const demo = booleanInput("demo", false);
  const appUrl = input("app-url");
  if (!demo && !appUrl) throw new Error("The app-url input is required.");
  const analysis = demo ? analyzeDataset(createDemoDataset(numberInput("limit", 96)), {
    source: { store: "demo", appId: "primary", canonicalUrl: "demo://primary" }
  }) : await analyze(appUrl, {
    country: optionalInput("country"),
    language: optionalInput("language"),
    limit: numberInput("limit", 300)
  });
  const result = evaluateRegression(analysis.report, {
    minVersionReviews: numberInput("min-version-reviews", 10),
    maxRatingDrop: numberInput("max-rating-drop", 0.4),
    maxNegativeShareIncrease: numberInput("max-negative-increase", 0.15),
    maxThemeShareIncrease: numberInput("max-theme-increase", 0.18),
    maxDiscoveredIssueShare: numberInput("max-discovered-share", 0.05),
    minThemeReviews: numberInput("min-theme-reviews", 3)
  });
  const markdown = regressionToMarkdown(result);
  const outputPath = import_node_path.default.resolve(input("output", "app-verbatim-regression.json"));
  const reportPath = import_node_path.default.resolve(input("report-output", "app-verbatim-report.json"));
  await Promise.all([
    write(outputPath, `${JSON.stringify(result, null, 2)}
`),
    write(reportPath, `${JSON.stringify(analysis.report, null, 2)}
`),
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
  const body = `${marker}
${markdown}`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "app-verbatim-action"
  };
  const base = `https://api.github.com/repos/${repository}`;
  const list2 = await github(`${base}/issues?state=open&per_page=100`, { headers });
  const existing = list2.find((issue2) => !issue2.pull_request && issue2.body?.includes(marker));
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
async function github(url2, options) {
  const response = await fetch(url2, options);
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}
async function write(file, content) {
  await (0, import_promises.mkdir)(import_node_path.default.dirname(file), { recursive: true });
  await (0, import_promises.writeFile)(file, content, "utf8");
}
async function appendSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) await (0, import_promises.appendFile)(process.env.GITHUB_STEP_SUMMARY, markdown, "utf8");
}
function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return Promise.resolve();
  const delimiter = `app_verbatim_${(0, import_node_crypto4.randomUUID)()}`;
  return (0, import_promises.appendFile)(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}
${value}
${delimiter}
`, "utf8");
}
function optionalInput(name) {
  const value = process.env[`INPUT_${name.toUpperCase()}`] ?? process.env[`INPUT_${name.toUpperCase().replaceAll("-", "_")}`];
  return value?.trim() || void 0;
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
