import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import GithubSlugger from "github-slugger";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const path = join(root, "examples", "plume-components.md");
const slugger = new GithubSlugger();
const lines = readFileSync(path, "utf8").split(/\r?\n/);
const out = [];

for (const line of lines) {
  const match = line.match(/^(#{2,6})\s+(.+)$/);
  if (match && match[1].length === 2 && match[2].trim() !== "目录") {
    const plain = match[2].replace(/`([^`]+)`/g, "$1").trim();
    const id = slugger.slug(plain);
    const prev = out[out.length - 1] ?? "";
    if (!prev.includes(`id="${id}"`)) {
      out.push(`<a id="${id}"></a>`);
    }
  }
  out.push(line);
}

writeFileSync(path, out.join("\n"), "utf8");
console.log("Injected anchors into examples/plume-components.md");
