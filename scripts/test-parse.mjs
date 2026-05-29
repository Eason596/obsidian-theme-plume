import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "vp-parse-"));
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
const text = readFileSync("../模块测试.md", "utf8");
const blocks = m.parseAllBlocks(text);
console.log("TOTAL BLOCKS:", blocks.length);
for (const b of blocks) {
  console.log(
    `${String(b.startLine + 1).padStart(4)}-${String(b.endLine + 1).padStart(4)}  ${b.type.padEnd(16)} ${JSON.stringify(b.attrs).slice(0, 100)}`
  );
}
