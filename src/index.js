export {
  THEME_RULES,
  buildComparison,
  buildReport,
  classifyReview,
  deduplicateReviews,
  normalizeReview
} from "./analysis.js";
export { analyze, analyzeDataset } from "./run-analysis.js";
export { discoverIssues } from "./discovery.js";
export { classifyReleaseLink } from "./release-link.js";
export {
  ConnectorDefinitionError,
  ConnectorNotFoundError,
  ConnectorRegistry,
  defineConnector
} from "./connector-registry.js";
export {
  appleConnector,
  ConnectorError,
  createDefaultRegistry,
  createDemoCompetitorDataset,
  createDemoDataset,
  demoConnector,
  fetchAppleReviews,
  fetchGoogleReviews,
  googlePlayConnector,
  normalizeAppleEntry,
  normalizeGoogleReview
} from "./connectors/index.js";
export {
  exportReport,
  reportToCsv,
  reportToHtml,
  reportToMarkdown,
  resolveExportFormat
} from "./exporters.js";
export { DEFAULT_POLICY, evaluateRegression, regressionToMarkdown } from "./regression.js";
export { parseSourceRef, UnsupportedStoreUrlError } from "./source-ref.js";
export { VERSION } from "./version.js";
