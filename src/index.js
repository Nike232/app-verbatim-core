export {
  THEME_RULES,
  buildComparison,
  buildReport,
  classifyReview,
  deduplicateReviews,
  normalizeReview
} from "./analysis.js";
export { analyze, analyzeDataset } from "./run-analysis.js";
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
export { parseSourceRef, UnsupportedStoreUrlError } from "./source-ref.js";

export const VERSION = "0.1.0";
