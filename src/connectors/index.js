import { ConnectorRegistry } from "../connector-registry.js";
import { appleConnector } from "./apple.js";
import { demoConnector } from "./demo.js";
import { googlePlayConnector } from "./google.js";

export { appleConnector, fetchAppleReviews, normalizeAppleEntry } from "./apple.js";
export { ConnectorError } from "./errors.js";
export { createDemoCompetitorDataset, createDemoDataset, demoConnector } from "./demo.js";
export { fetchGoogleReviews, googlePlayConnector, normalizeGoogleReview } from "./google.js";

export function createDefaultRegistry({ includeDemo = false } = {}) {
  const connectors = [appleConnector, googlePlayConnector];
  if (includeDemo) connectors.push(demoConnector);
  return new ConnectorRegistry(connectors);
}
