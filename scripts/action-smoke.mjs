import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const directory = await mkdtemp(path.join(os.tmpdir(), "app-verbatim-action-"));

try {
  const githubOutput = path.join(directory, "github-output.txt");
  const summary = path.join(directory, "summary.md");
  const resultFile = path.join(directory, "regression.json");
  const reportFile = path.join(directory, "report.json");
  const result = spawnSync(process.execPath, [path.join(root, "dist", "action.cjs")], {
    cwd: directory,
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      INPUT_DEMO: "true",
      INPUT_LIMIT: "96",
      "INPUT_FAIL-ON-REGRESSION": "false",
      INPUT_OUTPUT: resultFile,
      "INPUT_REPORT-OUTPUT": reportFile,
      GITHUB_OUTPUT: githubOutput,
      GITHUB_STEP_SUMMARY: summary
    }
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(JSON.parse(await readFile(resultFile, "utf8")).status, "fail");
  assert.equal(JSON.parse(await readFile(reportFile, "utf8")).app.name, "Pulse Notes");
  assert.match(await readFile(summary, "utf8"), /Regression signals/);
  const outputs = await readFile(githubOutput, "utf8");
  assert.match(outputs, /status/);
  assert.match(outputs, /release-link-level/);
  console.log("Bundled GitHub Action smoke test passed.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
