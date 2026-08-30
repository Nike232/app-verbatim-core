import {
  analyze,
  classifyReleaseLink,
  ConnectorRegistry,
  defineConnector,
  evaluateRegression,
  exportReport,
  normalizeReview,
  type ReviewDataset,
  type RegressionResult,
  type SourceRef
} from "../../src/index.js";

const connector = defineConnector({
  id: "typed-example",
  name: "Typed example",
  version: "1",
  supports(source: SourceRef) {
    return source.store === "typed-example";
  },
  async fetch(source: SourceRef): Promise<ReviewDataset> {
    return {
      app: { id: source.appId, name: "Typed", store: "typed-example" },
      reviews: [normalizeReview({
        source: "typed-example",
        appId: source.appId,
        reviewId: "one",
        body: "Typed review",
        rating: 5,
        createdAt: "2026-08-24T00:00:00.000Z"
      })]
    };
  }
});

const registry = new ConnectorRegistry([connector]);
const result = await analyze({ store: "typed-example", appId: "app" }, { registry });
const html: string = exportReport(result.report, "html");
const count: number = result.report.sample.total;
const check: RegressionResult = evaluateRegression(result.report, { maxRatingDrop: 0.25 });
const releaseKind: string = classifyReleaseLink({ body: "Broken after the update." }).kind;
void html;
void count;
void check;
void releaseKind;
