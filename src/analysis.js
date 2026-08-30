import { createHash } from "node:crypto";
import { discoverIssues } from "./discovery.js";
import { classifyReleaseLink } from "./release-link.js";

const DAY_MS = 86_400_000;

export const THEME_RULES = [
  {
    id: "stability",
    label: "Stability and failures",
    description: "Crashes, freezes, errors, launch failures, and broken functionality",
    intent: "problem",
    keywords: ["crash", "crashed", "crashing", "freeze", "frozen", "bug", "error", "broken", "won't open", "doesn't open", "崩溃", "闪退", "卡死", "错误", "打不开", "无法启动", "absturz", "abgestürzt", "stürzt", "hängt sich auf", "hängt", "friert ein", "friert", "funktioniert nicht", "lässt sich nicht öffnen", "öffnet nicht", "kaputt", "fehlermeldung", "plantage", "plante", "bloquea", "fallo", "クラッシュ", "強制終了", "落ちる"]
  },
  {
    id: "performance",
    label: "Performance and battery",
    description: "Speed, lag, heat, battery drain, and resource usage",
    intent: "problem",
    keywords: ["slow", "lag", "laggy", "battery", "drain", "overheat", "loading", "stutter", "卡顿", "很慢", "耗电", "发热", "加载", "langsam", "batterie", "akku", "ruckelt", "stockt", "träge", "wird heiß", "lädt ewig", "lädt sehr lange", "ladezeit", "verbraucht", "speicherverbrauch", "lent", "lente", "lenta", "batería", "遅い", "重い", "バッテリー"]
  },
  {
    id: "pricing",
    label: "Pricing and monetization",
    description: "Pricing, subscriptions, paywalls, advertising, renewals, and refunds",
    intent: "problem",
    keywords: ["price", "pricing", "expensive", "subscription", "subscribe", "paywall", "trial", "refund", "charged", "价格", "太贵", "订阅", "付费", "退款", "扣费", "续费", "teuer", "abonnement", "abo", "preis", "preise", "preiserhöhung", "kosten", "extrakosten", "bezahlen", "werbung", "werbeanzeigen", "kündigen", "kündigung", "kostenpflichtig", "cher", "caro", "suscripción", "高い", "課金", "サブスク"]
  },
  {
    id: "account",
    label: "Login and accounts",
    description: "Sign-in, registration, verification, and account access",
    intent: "problem",
    keywords: ["login", "log in", "sign in", "account", "password", "verification", "code", "登录", "账户", "账号", "密码", "验证码", "注册", "anmelden", "anmeldung", "einloggen", "konto", "benutzerkonto", "registrierung", "passwort", "bestätigungscode", "verifizierung", "kein zugang", "connexion", "inicio de sesión", "contraseña", "ログイン", "アカウント", "パスワード"]
  },
  {
    id: "sync",
    label: "Sync and data",
    description: "Cross-device sync, data loss, backup, import, and export",
    intent: "problem",
    keywords: ["sync", "lost data", "missing data", "backup", "restore", "import", "export", "同步", "数据丢失", "备份", "恢复", "导入", "导出", "synchron", "synchronisierung", "hochladen", "herunterladen", "upload funktioniert nicht", "uploads werden abgebrochen", "download funktioniert nicht", "datenverlust", "daten weg", "dateien weg", "gelöscht", "verschwunden", "wiederherstellen", "übertragung", "migrieren", "geräteübergreifend", "offline", "sauvegarde", "sincron", "copia de seguridad", "同期", "データ消失", "バックアップ"]
  },
  {
    id: "notifications",
    label: "Notifications and reminders",
    description: "Notification delivery, reminder timing, and interruptions",
    intent: "problem",
    keywords: ["notification", "notify", "reminder", "alert", "通知", "提醒", "推送", "benachrichtigung", "benachrichtigungen", "push", "erinnerung kommt nicht", "erinnerungen kommen nicht", "keine erinnerung", "benachrichtigung kommt nicht an", "benachrichtigungen kommen nicht an", "push kommt nicht an", "push nicht zugestellt", "notificación", "recordatorio", "リマインダー"]
  },
  {
    id: "usability",
    label: "Usability and interface",
    description: "Navigation, discoverability, readability, and interaction paths",
    intent: "problem",
    keywords: ["confusing", "hard to use", "difficult to use", "interface", "ui", "navigation", "can't find", "找不到", "难用", "界面", "操作", "导航", "复杂", "verwirrend", "schwer zu bedienen", "unübersichtlich", "umständlich", "kompliziert", "nicht intuitiv", "bedienung", "handhabung", "einstellung nicht finden", "finde die einstellung nicht", "finde keine einstellung", "menü nicht finden", "finde das menü nicht", "finde keine option", "versteckt", "zu viele klicks", "difficile", "confuso", "difícil de usar", "使いにくい", "分かりにくい"]
  },
  {
    id: "feature-request",
    label: "Feature requests",
    description: "Explicit requests for additions or improvements",
    intent: "request",
    keywords: ["please add", "wish", "would love", "need a", "feature", "can you", "could you", "希望", "建议增加", "能不能", "请添加", "功能", "需要支持", "bitte hinzufügen", "bitte ergänzen", "bitte einbauen", "wäre schön", "mir fehlt eine", "mir fehlt ein", "vermisse", "wünsche mir", "option fehlt", "finde keine option", "veuillez ajouter", "por favor añadan", "me gustaría", "追加して", "欲しい", "機能"]
  },
  {
    id: "privacy",
    label: "Privacy, security, and permissions",
    description: "Privacy, tracking, permissions, account compromise, and data usage",
    intent: "problem",
    keywords: ["privacy", "tracking", "permission", "data collection", "secure", "隐私", "追踪", "权限", "数据收集", "安全", "datenschutz", "unnötige berechtigung", "unnötige berechtigungen", "erzwingt berechtigungen", "berechtigung verlangt", "berechtigungen verlangt", "daten werden gesammelt", "daten sammelt", "überwachung", "getrackt", "sicherheitsrisiko", "datenmissbrauch", "gehackt", "spioniert", "confidentialité", "privacidad", "permiso", "プライバシー", "権限"]
  }
];

const REQUESTABLE_THEME_KEYWORDS = new Map([
  ["sync", new Set(["sync", "backup", "restore", "import", "export", "同步", "备份", "恢复", "导入", "导出", "synchron", "synchronisierung", "offline", "sauvegarde", "sincron", "copia de seguridad", "同期", "バックアップ"])],
  ["notifications", new Set(["notification", "notify", "reminder", "alert", "通知", "提醒", "推送", "benachrichtigung", "benachrichtigungen", "push", "notificación", "recordatorio", "リマインダー"])]
]);

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "was", "were", "you", "not", "but", "can", "has", "had", "its", "it's", "don", "doesn", "cannot", "how", "now", "such", "this", "that", "with", "have", "from", "just", "your", "very", "when", "what", "would", "could", "there", "their", "them", "these", "they", "been", "being", "does", "did", "app", "apps", "really", "after", "before", "because", "about", "into", "than", "then", "only", "also", "still", "even", "more", "some", "good", "great", "please", "using", "used", "use", "work", "works", "make", "much", "like", "love", "want", "need", "der", "die", "das", "den", "dem", "des", "ein", "eine", "einer", "einem", "einen", "und", "oder", "aber", "auch", "ist", "sind", "war", "waren", "wird", "werden", "mit", "ohne", "für", "von", "vom", "im", "in", "auf", "aus", "zu", "zur", "zum", "ich", "mir", "mich", "mein", "meine", "man", "wenn", "seit", "nach", "noch", "mehr", "sehr", "nicht", "kein", "keine", "nur", "schon", "immer", "wieder", "leider", "eigentlich", "wirklich", "jetzt", "gibt", "一个", "这个", "那个", "还是", "但是", "就是", "没有", "可以", "非常", "真的", "已经", "现在", "使用", "软件", "应用", "希望", "感觉", "问题"
]);

export function normalizeReview(review) {
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

export function deduplicateReviews(reviews) {
  const byKey = new Map();
  for (const review of reviews.map(normalizeReview)) {
    const key = `${review.source}:${review.appId}:${review.reviewId}`;
    const previous = byKey.get(key);
    if (!previous || Date.parse(review.updatedAt) > Date.parse(previous.updatedAt)) {
      byKey.set(key, review);
    }
  }
  return [...byKey.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function classifyReview(review) {
  const haystack = `${review.title} ${review.body}`.toLowerCase();
  return THEME_RULES.map((theme) => {
    const hits = theme.keywords.filter((keyword) => matchesKeyword(haystack, keyword));
    return hits.length ? { id: theme.id, intent: theme.intent, hits, confidence: Math.min(0.98, 0.56 + hits.length * 0.13) } : null;
  }).filter(Boolean);
}

function matchesKeyword(haystack, value) {
  const keyword = value.toLowerCase();
  if (/[^a-zà-öø-ÿ\s'-]/u.test(keyword)) return haystack.includes(keyword);
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const inflection = !keyword.includes(" ") && keyword.length >= 4 ? "(?:s|es|ed|ing)?" : "";
  return new RegExp(`(?:^|[^a-zà-öø-ÿ])${escaped}${inflection}(?=$|[^a-zà-öø-ÿ])`, "u").test(haystack);
}

export function buildReport({ reviews, app, source, generatedAt = new Date().toISOString(), aiSummary = null }) {
  const cleanReviews = deduplicateReviews(reviews).filter((review) => review.body);
  const anchor = cleanReviews.length ? Date.parse(cleanReviews[0].createdAt) : Date.parse(generatedAt);
  const recentStart = anchor - 30 * DAY_MS;
  const previousStart = anchor - 60 * DAY_MS;
  const themes = THEME_RULES.map((rule) => aggregateTheme(rule, cleanReviews, recentStart, previousStart))
    .filter((theme) => theme.count > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count);
  const distribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: cleanReviews.filter((review) => review.rating === rating).length
  }));
  const averageRating = round(mean(cleanReviews.map((review) => review.rating).filter(Boolean)), 2);
  const versions = aggregateVersions(cleanReviews);
  const timeline = aggregateTimeline(cleanReviews);
  const appTerms = new Set(`${app.name ?? ""} ${app.developer ?? ""}`.toLowerCase().match(/[a-z][a-z'-]{2,}|[\u4e00-\u9fff]{2,6}/g) ?? []);
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
      id: app.id,
      name: app.name,
      icon: app.icon ?? null,
      developer: app.developer ?? null,
      url: app.url,
      store: app.store
    },
    sample: {
      total: cleanReviews.length,
      averageRating,
      negativeShare: cleanReviews.length ? round(cleanReviews.filter((review) => review.rating <= 2).length / cleanReviews.length, 3) : 0,
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
      classifier: "deterministic-keyword-v2",
      discovery: "deterministic-phrase-mining-v2",
      releaseLink: "deterministic-release-link-v1",
      caveat: "Public store reviews are a sample. Store version metadata shows correlation; explicit update or change language strengthens a release link but does not prove causation."
    }
  };
}

export function buildComparison(primaryReport, competitorReport) {
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
      shareGap: round(competitorShare - primaryShare, 3),
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
    ratingGap: round((primaryReport.sample.averageRating || 0) - (competitorReport.sample.averageRating || 0), 2),
    gaps,
    opportunities
  };
}

function aggregateTheme(rule, reviews, recentStart, previousStart) {
  const matched = reviews.map((review) => ({ review, matches: classifyReview(review) }))
    .filter(({ matches }) => matches.some((match) => match.id === rule.id));
  const lowRated = matched.filter(({ review }) => review.rating <= 3);
  const requestOverlaps = rule.intent === "problem"
    ? lowRated.filter(({ matches }) => isRequestOnlyThemeMatch(matches, rule.id))
    : [];
  const requestOverlapReviews = new Set(requestOverlaps.map(({ review }) => review));
  const complaints = lowRated.filter(({ review }) => !requestOverlapReviews.has(review));
  const recent = matched.filter(({ review }) => Date.parse(review.createdAt) >= recentStart).length;
  const previous = matched.filter(({ review }) => {
    const time = Date.parse(review.createdAt);
    return time >= previousStart && time < recentStart;
  }).length;
  const recentComplaints = complaints.filter(({ review }) => Date.parse(review.createdAt) >= recentStart).length;
  const previousComplaints = complaints.filter(({ review }) => {
    const time = Date.parse(review.createdAt);
    return time >= previousStart && time < recentStart;
  }).length;
  const avgRating = round(mean(matched.map(({ review }) => review.rating)), 2);
  const complaintAverageRating = round(mean(complaints.map(({ review }) => review.rating)), 2);
  const evidence = matched
    .sort((a, b) => evidenceScore(b.review) - evidenceScore(a.review))
    .slice(0, 4)
    .map(({ review }) => evidenceRef(review));
  const complaintEvidence = complaints
    .sort((a, b) => evidenceScore(b.review) - evidenceScore(a.review))
    .slice(0, 4)
    .map(({ review }) => evidenceRef(review));
  const trendPercent = previous === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - previous) / previous) * 100);
  const complaintTrendPercent = previousComplaints === 0
    ? (recentComplaints > 0 ? 100 : 0)
    : Math.round(((recentComplaints - previousComplaints) / previousComplaints) * 100);
  const priorityItems = rule.intent === "request" ? matched.length : complaints.length;
  const priorityRating = rule.intent === "request" ? avgRating : complaintAverageRating;

  return {
    id: rule.id,
    label: rule.label,
    description: rule.description,
    intent: rule.intent,
    count: matched.length,
    share: reviews.length ? round(matched.length / reviews.length, 3) : 0,
    averageRating: avgRating,
    negativeCount: complaints.filter(({ review }) => review.rating <= 2).length,
    complaintCount: complaints.length,
    complaintShare: reviews.length ? round(complaints.length / reviews.length, 3) : 0,
    complaintAverageRating,
    requestOverlapCount: requestOverlaps.length,
    recentCount: recent,
    previousCount: previous,
    trendPercent,
    recentComplaintCount: recentComplaints,
    previousComplaintCount: previousComplaints,
    complaintTrendPercent,
    priorityScore: round(priorityItems * (6 - (priorityRating || 3)) * (1 + Math.max(0, rule.intent === "request" ? trendPercent : complaintTrendPercent) / 200), 1),
    complaintEvidence,
    evidence
  };
}

function aggregateVersions(reviews) {
  const groups = new Map();
  for (const review of reviews) {
    if (!review.appVersion) continue;
    const group = groups.get(review.appVersion) ?? [];
    group.push(review);
    groups.set(review.appVersion, group);
  }
  return [...groups.entries()].map(([version, items]) => {
    const sorted = [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const classified = items.map((review) => ({ review, matches: classifyReview(review) }));
    const themeSignals = THEME_RULES.map((rule) => {
      const matched = classified.filter(({ matches }) => matches.some((match) => match.id === rule.id));
      const lowRated = matched.filter(({ review }) => review.rating <= 3);
      const requestOverlaps = rule.intent === "problem"
        ? lowRated.filter(({ matches }) => isRequestOnlyThemeMatch(matches, rule.id))
        : [];
      const requestOverlapReviews = new Set(requestOverlaps.map(({ review }) => review));
      const complaints = lowRated.filter(({ review }) => !requestOverlapReviews.has(review));
      return {
        id: rule.id,
        label: rule.label,
        intent: rule.intent,
        count: matched.length,
        share: round(matched.length / items.length, 3),
        negativeCount: matched.filter(({ review }) => review.rating <= 2).length,
        complaintCount: complaints.length,
        complaintShare: round(complaints.length / items.length, 3),
        requestOverlapCount: requestOverlaps.length,
        complaintEvidence: complaints.map(({ review }) => review).sort((a, b) => evidenceScore(b) - evidenceScore(a)).slice(0, 3).map(evidenceRef),
        evidence: matched.map(({ review }) => review).sort((a, b) => evidenceScore(b) - evidenceScore(a)).slice(0, 3).map(evidenceRef)
      };
    }).filter((theme) => theme.count > 0).sort((a, b) => b.count - a.count);
    return {
      version,
      count: items.length,
      averageRating: round(mean(items.map((item) => item.rating)), 2),
      negativeShare: round(items.filter((item) => item.rating <= 2).length / items.length, 3),
      lastSeenAt: sorted[0].createdAt,
      releaseLinkEvidence: aggregateReleaseLinkEvidence(items),
      themeSignals,
      evidence: sorted.filter((item) => item.rating <= 2).slice(0, 3).map(evidenceRef)
    };
  }).sort((a, b) => compareVersionIdentifiers(b.version, a.version) || Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)).slice(0, 12);
}

function aggregateReleaseLinkEvidence(reviews) {
  const lowRated = reviews.filter((review) => review.rating <= 3).map((review) => ({
    review,
    link: classifyReleaseLink(review)
  }));
  const explicit = lowRated.filter(({ link }) => link.kind === "explicit");
  const change = lowRated.filter(({ link }) => link.kind === "change");
  const linked = [...explicit, ...change];
  const level = explicit.length >= 2 || (explicit.length >= 1 && linked.length >= 2)
    ? "supported"
    : linked.length
      ? "limited"
      : "none";
  const evidence = linked
    .sort((left, right) => (left.link.kind === "explicit" ? -1 : 1) - (right.link.kind === "explicit" ? -1 : 1) || evidenceScore(right.review) - evidenceScore(left.review))
    .slice(0, 4)
    .map(({ review, link }) => ({ ...evidenceRef(review), releaseLink: link }));
  return {
    level,
    lowRatingReviewCount: lowRated.length,
    explicitCount: explicit.length,
    changeCount: change.length,
    linkedCount: linked.length,
    linkedShare: lowRated.length ? round(linked.length / lowRated.length, 3) : 0,
    evidence
  };
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

function isRequestOnlyThemeMatch(matches, themeId) {
  if (!matches.some((match) => match.intent === "request")) return false;
  const requestable = REQUESTABLE_THEME_KEYWORDS.get(themeId);
  const theme = matches.find((match) => match.id === themeId);
  return Boolean(requestable && theme?.hits.length && theme.hits.every((hit) => requestable.has(hit)));
}

function aggregateTimeline(reviews) {
  const groups = new Map();
  for (const review of reviews) {
    const key = review.createdAt.slice(0, 7);
    const group = groups.get(key) ?? [];
    group.push(review);
    groups.set(key, group);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([period, items]) => ({
    period,
    count: items.length,
    averageRating: round(mean(items.map((item) => item.rating)), 2),
    negativeCount: items.filter((item) => item.rating <= 2).length
  }));
}

function aggregateValue(reviews, field, limit) {
  const counts = new Map();
  for (const review of reviews) {
    const value = review[field] || "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));
}

function extractKeywords(reviews, excluded = new Set()) {
  const counts = new Map();
  const bodies = reviews.filter((review) => review.rating <= 3).map((review) => review.body.toLowerCase());
  for (const body of bodies) {
    const words = body.match(/[a-z][a-z'-]{2,}|[\u4e00-\u9fff]{2,6}/g) ?? [];
    for (const word of new Set(words)) {
      if (!STOP_WORDS.has(word) && !excluded.has(word) && !/^\d+$/.test(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([term, count]) => ({ term, count }));
}

function buildInsights(themes, versions, reviews) {
  const results = [];
  const growing = themes.find((theme) => theme.intent === "problem" && theme.recentComplaintCount >= 2 && theme.complaintTrendPercent > 20);
  if (growing) {
    results.push({
      id: `trend-${growing.id}`,
      kind: "emerging",
      severity: growing.complaintAverageRating <= 2.2 ? "high" : "medium",
      title: `${growing.label} is increasing`,
      statement: `${growing.recentComplaintCount} complaint reviews appeared in the recent window, a ${formatPercent(growing.complaintTrendPercent)} change from the previous window.`,
      recommendation: "Reproduce the shared paths in the evidence first, then connect fixes to the next release.",
      evidence: growing.complaintEvidence
    });
  }
  const painful = themes.find((theme) => theme.intent === "problem" && theme.negativeCount >= 2);
  if (painful) {
    results.push({
      id: `pain-${painful.id}`,
      kind: "pain",
      severity: painful.negativeCount >= Math.max(4, painful.complaintCount * 0.6) ? "high" : "medium",
      title: `${painful.label} is the most concentrated pain point`,
      statement: `${painful.negativeCount} of ${painful.complaintCount} complaint reviews are one or two stars, with an average rating of ${painful.complaintAverageRating || "n/a"}.`,
      recommendation: "Rank reproduction paths from the source reviews and fix the broadest, lowest-rated root cause first.",
      evidence: painful.complaintEvidence
    });
  }
  const regressed = versions.find((version) => version.count >= 3 && version.averageRating <= 2.8);
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
  if (!results.length && reviews.length) {
    const evidence = reviews.slice(0, 3).map(evidenceRef);
    results.push({
      id: "baseline",
      kind: "baseline",
      severity: "low",
      title: "No concentrated risk is visible in this sample",
      statement: `${reviews.length} reviews were checked; no theme met both the volume and trend thresholds.`,
      recommendation: "Increase the sample or rerun after the next release, keeping the same method for comparison.",
      evidence
    });
  }
  return results.slice(0, 6);
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
  return (6 - review.rating) * 10 + Math.min(review.helpfulCount, 50) + Date.parse(review.createdAt) / 1e12;
}

function cleanText(value) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function toIso(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function stableId(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${value}%`;
}
