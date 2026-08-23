import assert from "node:assert/strict";
import test from "node:test";

import {
  analyze,
  ConnectorDefinitionError,
  ConnectorNotFoundError,
  ConnectorRegistry,
  defineConnector,
  normalizeReview
} from "../src/index.js";

function exampleConnector() {
  return defineConnector({
    id: "example",
    name: "Example",
    version: "1",
    supports: (source) => source.store === "example",
    async fetch(source) {
      return {
        app: { id: source.appId, name: "Example App", store: "example", url: "https://example.test/app" },
        reviews: [normalizeReview({
          source: "example",
          appId: source.appId,
          reviewId: "one",
          body: "The app crashes after every update.",
          rating: 1,
          author: "Test user",
          createdAt: "2026-08-20T00:00:00.000Z"
        })],
        metadata: { connector: "example", connectorVersion: "1" }
      };
    }
  });
}

test("registers and resolves a third-party connector", async () => {
  const registry = new ConnectorRegistry([exampleConnector()]);
  assert.equal(registry.resolve({ store: "example" }).id, "example");
  const result = await analyze({ store: "example", appId: "app" }, { registry, generatedAt: "2026-08-24T00:00:00.000Z" });
  assert.equal(result.report.sample.total, 1);
  assert.equal(result.report.provenance.datasets[0].connector, "example");
  assert.match(result.report.provenance.datasets[0].contentHash, /^[a-f0-9]{64}$/);
});

test("rejects invalid and duplicate connectors", () => {
  assert.throws(() => defineConnector({ id: "Bad Id" }), ConnectorDefinitionError);
  const connector = exampleConnector();
  const registry = new ConnectorRegistry([connector]);
  assert.throws(() => registry.register(connector), ConnectorDefinitionError);
  assert.throws(() => registry.resolve({ store: "missing" }), ConnectorNotFoundError);
});
