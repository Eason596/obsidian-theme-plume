import { build } from "esbuild";
import fs from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "vp-"));
const out = join(dir, "parser.mjs");
await build({
  entryPoints: ["src/parser.ts"],
  bundle: false,
  format: "esm",
  outfile: out,
  platform: "node",
  loader: { ".ts": "ts" }
});

const m = await import(pathToFileURL(out).href);
const sample = fs.readFileSync("../plume-complex-test.md", "utf8");
const match = sample.match(/:::: steps\n([\s\S]*?)\n::::/);
const steps = m.parseStepsRawContent(match[1]);
console.log("steps count:", steps.length);
for (let i = 0; i < steps.length; i += 1) {
  console.log(`  ${i + 1}:`, steps[i].body.split("\n")[0].slice(0, 50));
}
console.log("flex attrs:", m.parseFlexContainerAttrs('between center gap="16"'));
const step1 = steps[0].body;
console.log("step1 before dedent:\n", step1.slice(0, 120));
console.log("step1 after dedent:\n", m.dedentStepBody(step1).slice(0, 120));
const flexBody = `| 左 | 1 |\n| -- | - |\n\n| 右 | 2 |\n| -- | - |`;
console.log("flex segments:", m.splitFlexSegments(flexBody).length);
