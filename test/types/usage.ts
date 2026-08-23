import {
  analyze,
  ConnectorRegistry,
  defineConnector,
  exportReport,
  normalizeReview,
  type ReviewDataset,
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
void html;
void count;
