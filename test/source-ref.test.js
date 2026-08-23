import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSourceRef,
  UnsupportedStoreUrlError
} from "../src/index.js";

test("parses an Apple App Store URL", () => {
  assert.deepEqual(
    parseSourceRef("https://apps.apple.com/cn/app/example/id123456789?l=zh"),
    {
      store: "apple-app-store",
      appId: "123456789",
      country: "CN",
      canonicalUrl: "https://apps.apple.com/app/id123456789"
    }
  );
});

test("parses a Google Play URL", () => {
  assert.deepEqual(
    parseSourceRef(
      "https://play.google.com/store/apps/details?id=com.example.app&hl=zh_CN&gl=US"
    ),
    {
      store: "google-play",
      appId: "com.example.app",
      country: "US",
      language: "zh_CN",
      canonicalUrl:
        "https://play.google.com/store/apps/details?id=com.example.app"
    }
  );
});

test("rejects unknown and malformed URLs", () => {
  assert.throws(
    () => parseSourceRef("https://example.com/app/123"),
    UnsupportedStoreUrlError
  );
  assert.throws(() => parseSourceRef("not-a-url"), UnsupportedStoreUrlError);
});
