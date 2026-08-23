# Connector API

A connector converts one external review source into the normalized App Verbatim dataset. It must not perform analysis or mutate global state.

## Contract

```js
const connector = {
  id: "store-id",
  name: "Human-readable name",
  version: "1",
  supports(source) {
    return source.store === "store-id";
  },
  async fetch(source, options) {
    return {
      app: {
        id: source.appId,
        name: "Application name",
        store: "store-id",
        url: "https://example.com/app"
      },
      reviews: [],
      metadata: {
        connector: "store-id",
        connectorVersion: "1"
      }
    };
  }
};
```

Use `defineConnector()` to validate a definition and `ConnectorRegistry` to register it. Connector IDs are unique lowercase kebab-case strings.

## Options

Core passes these optional fields to `fetch()`:

| Field | Meaning |
| --- | --- |
| `country` | Storefront ISO country code |
| `language` | Preferred language code |
| `limit` | Maximum requested reviews |
| `signal` | `AbortSignal` for cancellation |
| `timeoutMs` | Per-request timeout hint |
| `attempts` | Retry-count hint |
| `userAgent` | HTTP user-agent override |
| `throttle` | Source-specific request pacing hint |

A connector may cap unsupported values but must document the cap in `metadata`.

## Normalized review

Call `normalizeReview()` for every source review. Required inputs are `source`, `appId`, `reviewId`, `body`, `rating`, and `createdAt`. The normalized output also contains title, author, locale, version, helpful count, optional developer reply, source URL, and an update timestamp.

Connector code must:

- produce stable review IDs;
- preserve the source timestamp and rating;
- return only reviews belonging to the requested application;
- pass cancellation signals to network calls;
- throw `ConnectorError` for source failures;
- avoid logging review bodies, credentials, or tokens;
- include `connector` and `connectorVersion` in metadata.

## Compatibility

Changing normalized meaning is a connector-version change. Removing a field or changing Core input/output shape requires a Core semver change. Add an offline normalization fixture and an opt-in live contract test for every bundled connector.

See [`examples/custom-connector.mjs`](../examples/custom-connector.mjs).
