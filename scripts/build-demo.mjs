import * as esbuild from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outfile = path.join(root, "scripts", "demo", ".build-demo.mjs");

await esbuild.build({
  entryPoints: [path.join(root, "scripts", "demo", "build-page.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  packages: "bundle",
  external: ["happy-dom"],
  alias: {
    obsidian: path.join(root, "scripts", "demo", "obsidian-shim.ts")
  },
  logLevel: "info"
});

const run = spawnSync(process.execPath, [outfile], { stdio: "inherit", cwd: root });
if (run.status !== 0) {
  process.exit(run.status ?? 1);
}
