import {
  analyze,
  ConnectorRegistry,
  defineConnector,
  normalizeReview
} from "../src/index.js";

const connector = defineConnector({
  id: "example",
  name: "Offline example connector",
  version: "1",
  supports: (source) => source.store === "example",
  async fetch(source) {
    return {
      app: { id: source.appId, name: "Example Tasks", store: "example", url: "https://example.test/apps/tasks" },
      reviews: [
        normalizeReview({
          source: "example",
          appId: source.appId,
          reviewId: "review-1",
          body: "The app crashes after the latest update.",
          rating: 1,
          appVersion: "2.0.0",
          author: "Example user",
          createdAt: "2026-08-20T10:00:00.000Z",
          sourceUrl: "https://example.test/reviews/1"
        })
      ],
      metadata: { connector: "example", connectorVersion: "1", fixture: true }
    };
  }
});

const registry = new ConnectorRegistry([connector]);
const { report } = await analyze({ store: "example", appId: "tasks" }, { registry });
console.log(JSON.stringify(report, null, 2));
