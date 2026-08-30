const DEFAULT_POLICY = Object.freeze({
  minVersionReviews: 10,
  maxRatingDrop: 0.4,
  maxNegativeShareIncrease: 0.15,
  maxThemeShareIncrease: 0.18,
  maxDiscoveredIssueShare: 0.05,
  minThemeReviews: 3
});

export function evaluateRegression(report, options = {}) {
  if (!report?.app || !Array.isArray(report.versions)) throw new TypeError("A valid App Verbatim report is required.");
  const policy = normalizePolicy(options);
  const current = report.versions[0] ?? null;
  const currentEligible = current && current.count >= policy.minVersionReviews;
  const baselineCandidate = current
    ? report.versions.slice(1).find((version) => version.version !== current.version) ?? null
    : null;
  const baseline = currentEligible
    ? report.versions.slice(1).find((version) => version.version !== current.version && version.count >= policy.minVersionReviews) ?? null
    : null;
  const versionEvidence = buildVersionEvidence(current, baseline ?? baselineCandidate, policy.minVersionReviews, Boolean(currentEligible && baseline));
  const sourceEvidence = buildSourceEvidence(report);
  const releaseLinkEvidence = buildReleaseLinkEvidence(current);
  const actionabilityEvidence = buildActionabilityEvidence(current);

  if (!sourceEvidence.ready || !currentEligible || !baseline) {
    const summary = !sourceEvidence.ready
      ? `Public review source returned a partial sample (${sourceEvidence.reason}); release comparison is unsafe.`
      : !current
      ? `Need at least ${policy.minVersionReviews} reviews for the newest version and one earlier baseline; found no version data.`
      : !currentEligible
        ? `Newest version ${current.version} has ${reviewCount(current.count)}; need at least ${policy.minVersionReviews} before comparing it.`
        : baselineCandidate
          ? `Earlier version ${baselineCandidate.version} has ${reviewCount(baselineCandidate.count)}; need at least ${policy.minVersionReviews} for a baseline.`
          : `Need an earlier baseline version with at least ${policy.minVersionReviews} reviews.`;
    const triage = buildTriage("insufficient-data", actionabilityEvidence, []);
    return {
      schemaVersion: 1,
      status: "insufficient-data",
      app: report.app,
      source: report.source,
      evaluatedAt: report.generatedAt,
      currentVersion: current?.version ?? null,
      baselineVersion: baseline?.version ?? null,
      versionEvidence,
      sourceEvidence,
      releaseLinkEvidence,
      actionabilityEvidence,
      triage,
      policy,
      metrics: null,
      violations: [],
      summary
    };
  }

  const ratingDrop = round(baseline.averageRating - current.averageRating, 3);
  const negativeShareIncrease = round(current.negativeShare - baseline.negativeShare, 3);
  const currentThemes = new Map((current.themeSignals ?? []).map((theme) => [theme.id, theme]));
  const baselineThemes = new Map((baseline.themeSignals ?? []).map((theme) => [theme.id, theme]));
  const themeChanges = [...currentThemes.values()].map((theme) => {
    const previous = baselineThemes.get(theme.id);
    const currentComplaint = complaintThemeView(theme);
    const baselineComplaint = complaintThemeView(previous);
    return {
      id: theme.id,
      label: theme.label,
      intent: currentComplaint.intent,
      count: currentComplaint.count,
      baselineCount: baselineComplaint.count,
      currentShare: currentComplaint.share,
      baselineShare: baselineComplaint.share,
      shareIncrease: round(currentComplaint.share - baselineComplaint.share, 3),
      evidence: currentComplaint.evidence
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
    if (theme.intent === "request") continue;
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
  const triage = buildTriage(status, actionabilityEvidence, violations);
  return {
    schemaVersion: 1,
    status,
    app: report.app,
    source: report.source,
    evaluatedAt: report.generatedAt,
    currentVersion: current.version,
    baselineVersion: baseline.version,
    versionEvidence,
    sourceEvidence,
    releaseLinkEvidence,
    actionabilityEvidence,
    triage,
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
    summary: triage.reason
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
  if (result.triage) {
    lines.push(`**Triage:** ${triageLabel(result.triage.decision)}${result.triage.blocking ? " · blocking" : ""}`, "");
  }
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
  if (result.releaseLinkEvidence?.available) {
    const link = result.releaseLinkEvidence;
    lines.push(
      `**Release-link evidence:** ${releaseLinkLabel(link.level)} · ${link.linkedCount} of ${link.lowRatingReviewCount} one- to three-star reviews describe an update/version link or a before-and-after change (${link.explicitCount} explicit, ${link.changeCount} temporal).`,
      "",
      "<sub>This diagnostic changes confidence in release causality, not the rating-based gate. Store version attribution is correlation, not proof that a release caused a review.</sub>",
      ""
    );
  }
  if (result.actionabilityEvidence?.available) {
    const scope = result.actionabilityEvidence;
    lines.push(
      "## Current-version review scope",
      "",
      "| Software | Product policy | Community | Support | Unclear |",
      "| ---: | ---: | ---: | ---: | ---: |",
      `| ${scope.counts.software} | ${scope.counts["product-policy"]} | ${scope.counts.community} | ${scope.counts.support} | ${scope.counts.unclear} |`,
      ""
    );
  }
  if (result.triage?.issues?.length) {
    lines.push("## Repeated version-linked software symptoms", "");
    for (const issue of result.triage.issues) {
      lines.push(`### 🛠 ${escapeMarkdown(issue.label)}`, "", `${issue.count} software complaints; ${issue.releaseLinkedCount} describe change over time and ${issue.explicitReleaseCount} explicitly name an update or version.`, "");
      for (const item of issue.evidence.slice(0, 3)) {
        lines.push(`- ${ratingLabel(item.rating)} · ${item.appVersion ? `v${escapeMarkdown(item.appVersion)} · ` : ""}${String(item.createdAt).slice(0, 10)} — “${escapeMarkdown(item.excerpt)}”`);
      }
      lines.push("");
    }
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

function complaintThemeView(theme) {
  if (!theme) return { intent: "problem", count: 0, share: 0, evidence: [] };
  const hasComplaintMetrics = Number.isFinite(theme.complaintCount) && Number.isFinite(theme.complaintShare);
  return {
    intent: theme.intent ?? "problem",
    count: hasComplaintMetrics ? theme.complaintCount : theme.count ?? 0,
    share: hasComplaintMetrics ? theme.complaintShare : theme.share ?? 0,
    evidence: hasComplaintMetrics ? theme.complaintEvidence ?? [] : theme.evidence ?? []
  };
}

function buildVersionEvidence(current, baseline, requiredPerVersion, ready) {
  return {
    ready,
    requiredPerVersion,
    current: versionSample(current, requiredPerVersion),
    baseline: versionSample(baseline, requiredPerVersion)
  };
}

function buildSourceEvidence(report) {
  const dataset = report.provenance?.datasets?.find((item) => item.role === "primary") ?? report.provenance?.datasets?.[0];
  const metadata = dataset?.metadata ?? {};
  const partial = metadata.partialResults === true;
  return {
    ready: !partial,
    connector: metadata.connector ?? dataset?.connector ?? report.source?.store ?? null,
    reason: partial ? metadata.paginationStopReason ?? "partial-results" : null
  };
}

function buildReleaseLinkEvidence(version) {
  if (version?.releaseLinkEvidence) return { available: true, ...version.releaseLinkEvidence };
  return {
    available: false,
    level: "unknown",
    lowRatingReviewCount: 0,
    explicitCount: 0,
    changeCount: 0,
    linkedCount: 0,
    linkedShare: 0,
    evidence: []
  };
}

function buildActionabilityEvidence(version) {
  if (version?.actionabilityEvidence) return { available: true, ...version.actionabilityEvidence };
  return {
    available: false,
    lowRatingReviewCount: 0,
    counts: { software: 0, "product-policy": 0, community: 0, support: 0, unclear: 0 },
    shares: { software: 0, "product-policy": 0, community: 0, support: 0, unclear: 0 },
    softwareCount: 0,
    softwareShare: 0,
    releaseLinkedSoftwareCount: 0,
    explicitReleaseSoftwareCount: 0,
    actionableIssues: [],
    evidence: { software: [], "product-policy": [], community: [], support: [], unclear: [] }
  };
}

function buildTriage(status, actionability, violations) {
  if (status === "insufficient-data") {
    return {
      decision: "observe",
      blocking: false,
      reason: "Release evidence is incomplete; continue observing until the source and version samples are sufficient.",
      issues: []
    };
  }
  if (status === "pass") {
    return {
      decision: "observe",
      blocking: false,
      reason: "The newest version is within the configured review-outcome policy; continue observing with the same method.",
      issues: []
    };
  }
  const issues = (actionability.actionableIssues ?? []).filter((issue) => issue.supported);
  if (actionability.available && issues.length) {
    return {
      decision: "software-regression",
      blocking: true,
      reason: `${violations.length} review-outcome ${violations.length === 1 ? "signal exceeds" : "signals exceed"} policy and repeated version-linked software symptoms require engineering action.`,
      issues
    };
  }
  return {
    decision: "manual-review",
    blocking: true,
    reason: "Review outcomes exceed policy, but the retrieved text does not establish a repeated version-linked software failure; manual review is required.",
    issues: []
  };
}

function versionSample(version, required) {
  const count = version?.count ?? 0;
  return {
    version: version?.version ?? null,
    count,
    missingReviews: Math.max(0, required - count)
  };
}

function reviewCount(count) {
  return `${count} ${count === 1 ? "review" : "reviews"}`;
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

function releaseLinkLabel(value) {
  return value === "supported" ? "SUPPORTED" : value === "limited" ? "LIMITED" : "NONE FOUND";
}

function triageLabel(value) {
  return value === "software-regression" ? "SOFTWARE REGRESSION" : value === "manual-review" ? "MANUAL REVIEW" : "OBSERVE";
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
