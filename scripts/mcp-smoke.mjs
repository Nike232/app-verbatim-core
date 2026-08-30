import assert from "node:assert/strict";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import packageMetadata from "../package.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const client = new Client({ name: "app-verbatim-smoke", version: "1.0.0" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, "src", "mcp.js")],
  cwd: root,
  stderr: "pipe"
});

try {
  await client.connect(transport);
  assert.equal(client.getServerVersion()?.version, packageMetadata.version);
  const listed = await client.listTools();
  assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), [
    "analyze_app_reviews",
    "check_release_regression",
    "compare_app_reviews"
  ]);
  const called = await client.callTool({
    name: "check_release_regression",
    arguments: { demo: true, limit: 96 }
  });
  assert.equal(called.isError, undefined);
  assert.match(called.content[0].text, /4 release regression signals/);
  assert.equal(called.structuredContent.result.status, "fail");
  console.log("MCP stdio handshake, tool discovery, and tool call passed.");
} finally {
  await client.close();
}
