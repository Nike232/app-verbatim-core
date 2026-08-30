export type StoreId = "apple-app-store" | "google-play" | "demo" | (string & {});

export interface SourceRef {
  store: StoreId;
  appId: string;
  country?: string | null;
  language?: string | null;
  canonicalUrl?: string;
}

export interface DeveloperReply {
  body: string;
  createdAt?: string | null;
}

export interface Review {
  source: StoreId;
  appId: string;
  reviewId: string;
  title: string;
  body: string;
  rating: number;
  language: string | null;
  country: string | null;
  appVersion: string | null;
  author: string;
  helpfulCount: number;
  reply: DeveloperReply | null;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppMetadata {
  id: string;
  name: string;
  icon?: string | null;
  developer?: string | null;
  url?: string | null;
  store: StoreId;
}

export interface ReviewDataset {
  app: AppMetadata;
  reviews: Review[];
  metadata?: Record<string, unknown>;
}

export interface ConnectorOptions {
  country?: string;
  language?: string;
  limit?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  attempts?: number;
  userAgent?: string;
  throttle?: number;
}

export interface Connector {
  id: string;
  name: string;
  version?: string;
  supports(source: SourceRef): boolean;
  fetch(source: SourceRef, options?: ConnectorOptions): Promise<ReviewDataset>;
}

export interface Evidence {
  reviewId: string;
  rating: number;
  appVersion: string | null;
  createdAt: string;
  excerpt: string;
  author: string;
  helpfulCount: number;
  sourceUrl?: string | null;
}

export interface Insight {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  statement: string;
  recommendation: string;
  evidence: Evidence[];
}

export interface ThemeSummary {
  id: string;
  label: string;
  count: number;
  share: number;
  negativeCount: number;
  averageRating: number;
  trendPercent: number;
  evidence: Evidence[];
}

export interface Report {
  schemaVersion: number;
  generatedAt: string;
  source: SourceRef;
  app: AppMetadata;
  sample: {
    total: number;
    averageRating: number;
    negativeShare: number;
    firstReviewAt: string | null;
    lastReviewAt: string | null;
    countries: Array<{ value: string; count: number }>;
    languages: Array<{ value: string; count: number }>;
  };
  ratingDistribution: Array<{ rating: number; count: number }>;
  timeline: Array<{ period: string; count: number; averageRating: number; negativeCount: number }>;
  themes: ThemeSummary[];
  versions: Array<Record<string, unknown>>;
  keywords: Array<Record<string, unknown>>;
  discoveredIssues: Array<Record<string, any>>;
  insights: Insight[];
  comparison?: Record<string, any>;
  methodology: Record<string, any>;
  provenance?: Record<string, any>;
  aiSummary?: unknown;
}

export interface RegressionPolicy {
  minVersionReviews?: number;
  maxRatingDrop?: number;
  maxNegativeShareIncrease?: number;
  maxThemeShareIncrease?: number;
  maxDiscoveredIssueShare?: number;
  minThemeReviews?: number;
}

export interface RegressionViolation {
  id: string;
  severity: "high" | "medium";
  title: string;
  message: string;
  value: number;
  threshold: number;
  unit: "stars" | "share";
  evidence: Evidence[];
}

export interface VersionEvidenceStatus {
  ready: boolean;
  requiredPerVersion: number;
  current: { version: string | null; count: number; missingReviews: number };
  baseline: { version: string | null; count: number; missingReviews: number };
}

export interface RegressionResult {
  schemaVersion: number;
  status: "pass" | "fail" | "insufficient-data";
  app: AppMetadata;
  source: SourceRef;
  evaluatedAt: string;
  currentVersion: string | null;
  baselineVersion: string | null;
  versionEvidence: VersionEvidenceStatus;
  policy: Required<RegressionPolicy>;
  metrics: Record<string, any> | null;
  violations: RegressionViolation[];
  summary: string;
}

export interface AnalyzeOptions extends ConnectorOptions {
  competitor?: string | SourceRef;
  registry?: ConnectorRegistry;
  generatedAt?: string;
}

export interface AnalysisResult {
  report: Report;
  datasets: { primary: ReviewDataset; competitor: ReviewDataset | null };
}

export const VERSION: string;
export const THEME_RULES: ReadonlyArray<Record<string, any>>;

export class UnsupportedStoreUrlError extends Error {
  input: unknown;
}
export class ConnectorError extends Error {
  store: StoreId;
  status: number;
  retryable: boolean;
}
export class ConnectorDefinitionError extends TypeError {}
export class ConnectorNotFoundError extends Error {
  source: SourceRef;
}
export class ConnectorRegistry {
  constructor(connectors?: Connector[]);
  register(connector: Connector): this;
  unregister(id: string): boolean;
  get(id: string): Connector | null;
  resolve(source: SourceRef): Connector;
  list(): Array<{ id: string; name: string; version?: string }>;
}

export function defineConnector(connector: Connector): Readonly<Connector>;
export function createDefaultRegistry(options?: { includeDemo?: boolean }): ConnectorRegistry;
export function parseSourceRef(input: string): SourceRef;
export function normalizeReview(review: Partial<Review> & Pick<Review, "source" | "appId" | "reviewId" | "body" | "rating" | "createdAt">): Review;
export function deduplicateReviews(reviews: Review[]): Review[];
export function classifyReview(review: Pick<Review, "title" | "body">): Array<Record<string, any>>;
export function discoverIssues(reviews: Review[], options?: { totalReviews?: number; anchor?: number; limit?: number }): Array<Record<string, any>>;
export function buildReport(input: { reviews: Review[]; app: AppMetadata; source: SourceRef; generatedAt?: string; aiSummary?: unknown }): Report;
export function buildComparison(primary: Report, competitor: Report): Record<string, any>;
export const DEFAULT_POLICY: Readonly<Required<RegressionPolicy>>;
export function evaluateRegression(report: Report, options?: RegressionPolicy): RegressionResult;
export function regressionToMarkdown(result: RegressionResult): string;
export function analyze(input: string | SourceRef, options?: AnalyzeOptions): Promise<AnalysisResult>;
export function analyzeDataset(dataset: ReviewDataset, options?: { source?: SourceRef; competitorDataset?: ReviewDataset | null; competitorSource?: SourceRef | null; generatedAt?: string }): AnalysisResult;

export const appleConnector: Connector;
export const googlePlayConnector: Connector;
export const demoConnector: Connector;
export function fetchAppleReviews(source: SourceRef, options?: ConnectorOptions): Promise<ReviewDataset>;
export function fetchGoogleReviews(source: SourceRef, options?: ConnectorOptions): Promise<ReviewDataset>;
export function createDemoDataset(limit?: number): ReviewDataset;
export function createDemoCompetitorDataset(limit?: number): ReviewDataset;
export function normalizeAppleEntry(entry: Record<string, any>, source: SourceRef, country?: string): Review;
export function normalizeGoogleReview(review: Record<string, any>, source: SourceRef, locale?: { country?: string; language?: string }): Review;

export type ExportFormat = "json" | "csv" | "md" | "html";
export function resolveExportFormat(value?: string, outputPath?: string): ExportFormat;
export function exportReport(report: Report, format: ExportFormat, options?: { reviews?: Review[] }): string;
export function reportToCsv(reviews: Review[]): string;
export function reportToMarkdown(report: Report): string;
export function reportToHtml(report: Report): string;
