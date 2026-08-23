import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(import.meta.dirname, "..");
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("Run this smoke test through npm run check:pack.");
const directory = await mkdtemp(path.join(os.tmpdir(), "app-verbatim-package-"));

try {
  const packed = run(process.execPath, [npmCli, "pack", "--json", "--pack-destination", directory], root);
  const [{ filename }] = JSON.parse(packed.stdout);
  const tarball = path.join(directory, filename);
  const consumer = path.join(directory, "consumer");
  await mkdir(consumer, { recursive: true });
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }), "utf8");
  await writeFile(path.join(consumer, "smoke.mjs"), `
    import assert from "node:assert/strict";
    import { analyzeDataset, createDemoDataset, VERSION } from "app-verbatim";
    const { report } = analyzeDataset(createDemoDataset(8), { source: { store: "demo", appId: "primary" } });
    assert.equal(VERSION, "0.4.0");
    assert.equal(report.sample.total, 8);
  `, "utf8");
  run(process.execPath, [npmCli, "install", "--ignore-scripts", tarball], consumer);
  run(process.execPath, ["smoke.mjs"], consumer);
  const output = path.join(consumer, "report.json");
  const installedCli = path.join(consumer, "node_modules", "app-verbatim", "src", "cli.js");
  run(process.execPath, [installedCli, "demo", "--limit", "8", "--output", output], consumer);
  const report = JSON.parse(await readFile(output, "utf8"));
  assert.equal(report.sample.total, 8);
  const client = new Client({ name: "packed-app-verbatim-smoke", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: process.execPath, args: [installedCli, "mcp"], cwd: consumer, stderr: "pipe" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "check_release_regression"));
  } finally {
    await client.close();
  }
  console.log("Packed-package import, CLI, and MCP smoke tests passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed\n${result.error?.message ?? ""}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  return result;
}
