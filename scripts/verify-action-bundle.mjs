import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist", "action.cjs");
const result = await build({
  entryPoints: [path.join(root, "src", "action.js")],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  outfile: output,
  legalComments: "external",
  write: false
});
const generated = result.outputFiles.find((file) => path.resolve(file.path) === path.resolve(output));
assert.ok(generated, "esbuild did not return the expected Action bundle.");
const committed = await readFile(output);
assert.equal(Buffer.compare(committed, Buffer.from(generated.contents)), 0, "dist/action.cjs is stale. Run npm run build:action and commit the result.");
console.log("Committed GitHub Action bundle matches its sources.");
