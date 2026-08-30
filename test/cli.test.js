import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import packageMetadata from "../package.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const cli = path.join(root, "src", "cli.js");

test("prints help and version", () => {
  const help = run(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Evidence-backed/);
  const version = run(["--version"]);
  assert.equal(version.stdout.trim(), packageMetadata.version);
});

test("writes an offline report and refuses accidental overwrite", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "app-verbatim-core-"));
  try {
    const output = path.join(directory, "report.html");
    const first = run(["demo", "--compare", "--limit", "32", "--output", output]);
    assert.equal(first.status, 0, first.stderr);
    assert.match(await readFile(output, "utf8"), /<!doctype html>/);
    const second = run(["demo", "--output", output]);
    assert.equal(second.status, 2);
    assert.match(second.stderr, /already exists/);
    const forced = run(["demo", "--output", output, "--force"]);
    assert.equal(forced.status, 0, forced.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("uses exit code 2 for invalid CLI input", () => {
  const result = run(["analyze", "--limit", "wrong"]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /must be an integer|Usage/);
});

test("turns the offline release regression into a failing quality gate", () => {
  const result = run(["check", "--demo"]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /review regression check/);
  assert.match(result.stdout, /Regression signals/);
});

test("supports machine-readable release check output", () => {
  const result = run(["check", "--demo", "--format", "json"]);
  assert.equal(result.status, 1, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "fail");
  assert.equal(output.currentVersion, "4.8.0");
});

test("scaffolds a ready-to-run GitHub Actions workflow", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "app-verbatim-init-"));
  try {
    const args = [
      "init",
      "https://play.google.com/store/apps/details?id=com.example.app&hl=fr&gl=CA",
      "--observe-only",
      "--create-issue"
    ];
    const first = run(args, directory);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stderr, /Mode: observe-only/);
    assert.match(first.stderr, /Issues: enabled/);
    assert.match(first.stderr, /Next: commit the workflow/);

    const workflow = await readFile(path.join(directory, ".github", "workflows", "app-verbatim.yml"), "utf8");
    assert.match(workflow, /uses: Nike232\/app-verbatim-core@v0/);
    assert.match(workflow, /app-url: "https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.example\.app"/);
    assert.match(workflow, /country: "CA"/);
    assert.match(workflow, /language: "fr"/);
    assert.match(workflow, /fail-on-regression: false/);
    assert.match(workflow, /issues: write/);
    assert.match(workflow, /github-token: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);

    const duplicate = run(args, directory);
    assert.equal(duplicate.status, 2);
    assert.match(duplicate.stderr, /already exists/);

    const forced = run([...args, "--force"], directory);
    assert.equal(forced.status, 0, forced.stderr);

    const apple = run([
      "init",
      "https://apps.apple.com/us/app/example/id123456789",
      "--observe-only",
      "--output",
      "apple-review-regression.yml"
    ], directory);
    assert.equal(apple.status, 0, apple.stderr);
    assert.match(apple.stderr, /Apple note: public fallback reviews may not include app versions/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: "utf8", windowsHide: true });
}
