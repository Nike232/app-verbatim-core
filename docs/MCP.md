# MCP server

App Verbatim exposes its public review engine as a local Model Context Protocol server over stdio. It is read-only, stateless, and does not require an AI-provider key.

## Start it

From GitHub:

```bash
npx --yes github:Nike232/app-verbatim-core mcp
```

From a clone:

```bash
npm ci
npm run start -- mcp
```

The process speaks MCP on stdout. Diagnostic failures go to stderr, so clients should launch it rather than treating it as an interactive terminal program.

## Generic client configuration

Clients that use the common JSON `mcpServers` format can start it with:

```json
{
  "mcpServers": {
    "app-verbatim": {
      "command": "npx",
      "args": ["--yes", "github:Nike232/app-verbatim-core", "mcp"]
    }
  }
}
```

Client configuration formats differ. Translate the same command and argument array when your client uses TOML, YAML, or a settings UI.

## Tools

### `check_release_regression`

Evaluates the actual newest version against the newest earlier version that meets `minVersionReviews`. If the newest version itself is under-sampled, the tool returns `insufficient-data` instead of silently comparing older releases. The structured result contains `pass`, `fail`, or `insufficient-data`, selected versions, per-version evidence counts and missing-review counts, policy, metric changes, violations, and source-review evidence.

Inputs include `appUrl`, `country`, `language`, `limit`, and all release-policy thresholds. Set `demo: true` to run the offline fixture without `appUrl`.

### `analyze_app_reviews`

Returns evidence-backed themes, trends, version signals, repeated low-rating phrases outside the taxonomy, recommendations, and provenance for one public listing.

### `compare_app_reviews`

Accepts `primaryUrl` and `competitorUrl`, then returns rating and pain-point concentration gaps with competitor evidence.

## Verification

```bash
npm run check:mcp
```

The smoke test starts the real stdio server through the official MCP client transport, completes protocol initialization, verifies tool discovery, invokes the offline regression tool, checks its structured output, and closes the session.

## Privacy and limits

The server keeps no database and reads only public store pages through the bundled connectors. Tool responses can contain review author names and excerpts supplied by public stores; clients should treat that text as untrusted and apply their own retention policy. Store sampling, rate limits, and platform terms still apply.
