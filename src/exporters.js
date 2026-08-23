const FORMATS = new Set(["json", "csv", "md", "html"]);

export function resolveExportFormat(value, outputPath) {
  if (value) {
    const normalized = String(value).toLowerCase().replace(/^markdown$/, "md");
    if (!FORMATS.has(normalized)) throw new TypeError(`Unsupported format: ${value}. Use json, csv, md, or html.`);
    return normalized;
  }
  const extension = outputPath?.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return FORMATS.has(extension) ? extension : "json";
}

export function exportReport(report, format, options = {}) {
  const normalized = resolveExportFormat(format);
  if (normalized === "json") return `${JSON.stringify(report, null, 2)}\n`;
  if (normalized === "md") return reportToMarkdown(report);
  if (normalized === "html") return reportToHtml(report);
  return reportToCsv(options.reviews ?? []);
}

export function reportToCsv(reviews) {
  const rows = [["source", "app_id", "review_id", "rating", "created_at", "version", "country", "language", "author", "title", "body", "source_url"]];
  for (const review of reviews) {
    rows.push([
      review.source,
      review.appId,
      review.reviewId,
      review.rating,
      review.createdAt,
      review.appVersion,
      review.country,
      review.language,
      review.author,
      review.title,
      review.body,
      review.sourceUrl
    ]);
  }
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function reportToMarkdown(report) {
  const lines = [
    `# ${escapeMarkdown(report.app.name)} review intelligence`,
    "",
    `> Generated ${report.generatedAt}. ${report.sample.total} deduplicated reviews; average rating ${report.sample.averageRating || "n/a"}.`,
    "",
    "## Signals",
    ""
  ];
  for (const insight of report.insights) {
    lines.push(`### ${escapeMarkdown(insight.title)}`, "", escapeMarkdown(insight.statement), "", `**Recommendation:** ${escapeMarkdown(insight.recommendation)}`, "", "Evidence:", "");
    for (const item of insight.evidence) {
      lines.push(`- ${item.rating} stars · ${item.appVersion ? `v${escapeMarkdown(item.appVersion)} · ` : ""}${String(item.createdAt).slice(0, 10)} — “${escapeMarkdown(item.excerpt)}”`);
    }
    lines.push("");
  }
  lines.push("## Themes", "", "| Theme | Reviews | Share | Low ratings | Average | Change |", "| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const theme of report.themes) {
    lines.push(`| ${escapeMarkdown(theme.label)} | ${theme.count} | ${Math.round(theme.share * 100)}% | ${theme.negativeCount} | ${theme.averageRating || "n/a"} | ${theme.trendPercent > 0 ? "+" : ""}${theme.trendPercent}% |`);
  }
  if (report.comparison) {
    lines.push("", `## Comparison with ${escapeMarkdown(report.comparison.competitor.name)}`, "", `Average-rating gap: ${report.comparison.ratingGap > 0 ? "+" : ""}${report.comparison.ratingGap}.`, "");
    for (const item of report.comparison.opportunities) lines.push(`- **${escapeMarkdown(item.title)}:** ${escapeMarkdown(item.statement)}`);
  }
  lines.push("", "## Methodology", "", escapeMarkdown(report.methodology.evidenceRule), "", escapeMarkdown(report.methodology.caveat), "");
  return `${lines.join("\n")}\n`;
}

export function reportToHtml(report) {
  const insights = report.insights.map((insight) => `<article><span class="priority">${escapeHtml(severityLabel(insight.severity))}</span><h2>${escapeHtml(insight.title)}</h2><p>${escapeHtml(insight.statement)}</p><p class="recommendation"><strong>Recommendation</strong> ${escapeHtml(insight.recommendation)}</p><details><summary>${insight.evidence.length} source reviews</summary>${insight.evidence.map((item) => `<blockquote><p>“${escapeHtml(item.excerpt)}”</p><footer>${item.rating} stars · ${escapeHtml(item.appVersion ? `v${item.appVersion} · ` : "")}${escapeHtml(String(item.createdAt).slice(0, 10))}</footer></blockquote>`).join("")}</details></article>`).join("");
  const themeRows = report.themes.map((theme) => `<tr><td>${escapeHtml(theme.label)}</td><td>${theme.count}</td><td>${Math.round(theme.share * 100)}%</td><td>${theme.negativeCount}</td><td>${theme.averageRating || "n/a"}</td><td>${theme.trendPercent > 0 ? "+" : ""}${theme.trendPercent}%</td></tr>`).join("");
  const comparison = report.comparison ? `<section><p class="kicker">Competitor comparison</p><h2>${escapeHtml(report.comparison.competitor.name)}</h2><p>Average-rating gap: ${report.comparison.ratingGap > 0 ? "+" : ""}${report.comparison.ratingGap}.</p>${report.comparison.opportunities.map((item) => `<p><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.statement)}</p>`).join("")}</section>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.app.name)} review intelligence</title><style>body{max-width:920px;margin:0 auto;padding:64px 28px 90px;color:#171717;background:#fff;font:15px/1.65 system-ui,sans-serif}header{padding-bottom:28px;border-bottom:1px solid #ddd}h1{margin:0;font-size:40px;letter-spacing:-.04em}h2{margin:5px 0 9px;font-size:20px}section{margin-top:52px}.kicker,.priority{color:#276749;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.metrics{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid #ddd}.metrics p{padding:20px;border-left:1px solid #eee}.metrics p:first-child{border-left:0}.metrics strong{display:block;font-size:25px}article{padding:25px 0;border-bottom:1px solid #e8e8e5}.recommendation{color:#6e6e69}details{margin-top:14px}summary{color:#276749;cursor:pointer}blockquote{margin:15px 0;padding-left:15px;border-left:2px solid #ddd}blockquote footer{color:#777;font-size:12px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #e8e8e5;text-align:left}th{color:#777;font-size:12px}@media(max-width:600px){body{padding:35px 18px}.metrics{grid-template-columns:1fr}.metrics p{border-left:0;border-top:1px solid #eee}}</style></head><body><header><p class="kicker">App Verbatim · Evidence report</p><h1>${escapeHtml(report.app.name)}</h1><p>${escapeHtml(report.app.developer ?? "")} · ${escapeHtml(report.generatedAt)}</p></header><div class="metrics"><p>Review sample<strong>${report.sample.total}</strong></p><p>Average rating<strong>${report.sample.averageRating || "n/a"} / 5</strong></p><p>One- and two-star<strong>${Math.round(report.sample.negativeShare * 100)}%</strong></p></div><section><p class="kicker">Signals</p>${insights}</section><section><p class="kicker">Themes</p><table><thead><tr><th>Theme</th><th>Reviews</th><th>Share</th><th>Low ratings</th><th>Average</th><th>Change</th></tr></thead><tbody>${themeRows}</tbody></table></section>${comparison}<section><p class="kicker">Methodology</p><p>${escapeHtml(report.methodology.evidenceRule)}</p><p>${escapeHtml(report.methodology.caveat)}</p></section></body></html>`;
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function escapeMarkdown(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/([*_`[\]])/g, "\\$1");
}

function severityLabel(value) {
  return value === "high" ? "High priority" : value === "medium" ? "Watch" : "Observe";
}
