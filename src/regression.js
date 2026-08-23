const DEFAULT_POLICY = Object.freeze({
  minVersionReviews: 5,
  maxRatingDrop: 0.4,
  maxNegativeShareIncrease: 0.15,
  maxThemeShareIncrease: 0.18,
  maxDiscoveredIssueShare: 0.05,
  minThemeReviews: 3
});

export function evaluateRegression(report, options = {}) {
  if (!report?.app || !Array.isArray(report.versions)) throw new TypeError("A valid App Verbatim report is required.");
  const policy = normalizePolicy(options);
  const eligible = report.versions.filter((version) => version.count >= policy.minVersionReviews);
  const current = eligible[0] ?? null;
  const baseline = eligible.find((version) => version.version !== current?.version) ?? null;

  if (!current || !baseline) {
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
      summary: `Need at least ${policy.minVersionReviews} reviews for two distinct app versions; found ${eligible.length}.`
    };
  }

  const ratingDrop = round(baseline.averageRating - current.averageRating, 3);
  const negativeShareIncrease = round(current.negativeShare - baseline.negativeShare, 3);
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
      shareIncrease: round(theme.share - (previous?.share ?? 0), 3),
      evidence: theme.evidence ?? []
    };
  }).sort((left, right) => right.shareIncrease - left.shareIncrease || right.count - left.count);
  const discoveredIssueChanges = (report.discoveredIssues ?? []).map((issue) => {
    const currentVersion = issue.versions?.find((item) => item.version === current.version);
    const baselineVersion = issue.versions?.find((item) => item.version === baseline.version);
    const currentCount = currentVersion?.count ?? 0;
    const baselineCount = baselineVersion?.count ?? 0;
    const currentShare = currentCount / current.count;
    const baselineShare = baselineCount / baseline.count;
    return {
      id: issue.id,
      label: issue.label,
      currentCount,
      baselineCount,
      currentShare: round(currentShare, 3),
      baselineShare: round(baselineShare, 3),
      shareIncrease: round(currentShare - baselineShare, 3),
      evidence: currentVersion?.evidence ?? (issue.evidence ?? []).filter((item) => item.appVersion === current.version)
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
  for (const issue of discoveredIssueChanges) {
    if (issue.currentCount < policy.minThemeReviews || issue.shareIncrease <= policy.maxDiscoveredIssueShare) continue;
    violations.push({
      id: issue.id,
      severity: issue.baselineCount === 0 ? "high" : "medium",
      title: `New complaint fingerprint: ${issue.label}`,
      message: `${issue.currentCount} reviews in ${current.version} share this previously uncategorized language (${percent(issue.currentShare)}) versus ${issue.baselineCount} in ${baseline.version}.`,
      value: issue.shareIncrease,
      threshold: policy.maxDiscoveredIssueShare,
      unit: "share",
      evidence: issue.evidence
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
    summary: status === "fail"
      ? `${violations.length} release regression ${violations.length === 1 ? "signal exceeds" : "signals exceed"} the configured policy.`
      : `Version ${current.version} is within the configured regression policy compared with ${baseline.version}.`
  };
}

export function regressionToMarkdown(result) {
  if (!result?.status) throw new TypeError("A regression result is required.");
  const icon = result.status === "pass" ? "✅" : result.status === "fail" ? "❌" : "⚪";
  const lines = [
    `# ${icon} ${escapeMarkdown(result.app.name)} review regression check`,
    "",
    `**Status:** ${result.status.toUpperCase()} · ${escapeMarkdown(result.summary)}`,
    ""
  ];
  if (result.metrics) {
    lines.push(
      `Compared **v${escapeMarkdown(result.currentVersion)}** with **v${escapeMarkdown(result.baselineVersion)}**.`,
      "",
      "| Metric | Current | Baseline | Change | Policy |",
      "| --- | ---: | ---: | ---: | ---: |",
      `| Average rating | ${result.metrics.current.averageRating} | ${result.metrics.baseline.averageRating} | ${signed(result.metrics.ratingDrop * -1, 2)} | drop ≤ ${result.policy.maxRatingDrop} |`,
      `| One- and two-star share | ${percent(result.metrics.current.negativeShare)} | ${percent(result.metrics.baseline.negativeShare)} | ${signedPercent(result.metrics.negativeShareIncrease)} | increase ≤ ${percent(result.policy.maxNegativeShareIncrease)} |`,
      ""
    );
  }
  if (result.violations.length) {
    lines.push("## Regression signals", "");
    for (const violation of result.violations) {
      lines.push(`### ${violation.severity === "high" ? "🔴" : "🟠"} ${escapeMarkdown(violation.title)}`, "", escapeMarkdown(violation.message), "");
      for (const item of violation.evidence.slice(0, 3)) {
        lines.push(`- ${ratingLabel(item.rating)} · ${item.appVersion ? `v${escapeMarkdown(item.appVersion)} · ` : ""}${String(item.createdAt).slice(0, 10)} — “${escapeMarkdown(item.excerpt)}”`);
      }
      lines.push("");
    }
  }
  lines.push(
    "<sub>Generated by [App Verbatim](https://github.com/Nike232/app-verbatim-core). Every signal links back to source reviews; no AI key required.</sub>",
    ""
  );
  return `${lines.join("\n")}\n`;
}

export { DEFAULT_POLICY };

function normalizePolicy(options) {
  return {
    minVersionReviews: integer(options.minVersionReviews, DEFAULT_POLICY.minVersionReviews, 1, 2_000, "minVersionReviews"),
    maxRatingDrop: number(options.maxRatingDrop, DEFAULT_POLICY.maxRatingDrop, 0, 4, "maxRatingDrop"),
    maxNegativeShareIncrease: number(options.maxNegativeShareIncrease, DEFAULT_POLICY.maxNegativeShareIncrease, 0, 1, "maxNegativeShareIncrease"),
    maxThemeShareIncrease: number(options.maxThemeShareIncrease, DEFAULT_POLICY.maxThemeShareIncrease, 0, 1, "maxThemeShareIncrease"),
    maxDiscoveredIssueShare: number(options.maxDiscoveredIssueShare, DEFAULT_POLICY.maxDiscoveredIssueShare, 0, 1, "maxDiscoveredIssueShare"),
    minThemeReviews: integer(options.minThemeReviews, DEFAULT_POLICY.minThemeReviews, 1, 2_000, "minThemeReviews")
  };
}

function pickVersionMetrics(version) {
  return {
    version: version.version,
    count: version.count,
    averageRating: version.averageRating,
    negativeShare: version.negativeShare
  };
}

function integer(value, fallback, min, max, name) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new RangeError(`${name} must be an integer between ${min} and ${max}.`);
  return parsed;
}

function number(value, fallback, min, max, name) {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new RangeError(`${name} must be between ${min} and ${max}.`);
  return parsed;
}

function round(value, digits = 0) {
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
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "@\u200B")
    .replaceAll("|", "\\|")
    .replace(/([*_`[\]])/g, "\\$1");
}
