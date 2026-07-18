import esbuild from "esbuild";
import process from "node:process";

const isProduction = process.argv.includes("production");

const shared = {
  bundle: true,
  format: "cjs",
  target: "es2020",
  sourcemap: isProduction ? false : "inline",
  minify: isProduction,
  logLevel: "info"
};

const mainContext = await esbuild.context({
  ...shared,
  entryPoints: ["main.ts"],
  outfile: "main.js",
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/language",
    // Sibling CJS chunk — never inline the `qrcode` package into main.js
    "./qrcode-lib.cjs",
    "./src/render/qrcode-lib.cjs"
  ],
  plugins: [
    {
      name: "external-qrcode-lib",
      setup(build) {
        build.onResolve({ filter: /qrcode-lib\.cjs$/ }, () => ({
          path: "./qrcode-lib.cjs",
          external: true
        }));
      }
    }
  ]
});

const qrcodeContext = await esbuild.context({
  ...shared,
  entryPoints: ["src/render/qrcode.ts"],
  outfile: "qrcode-lib.cjs",
  platform: "browser",
  external: ["obsidian"]
});

if (isProduction) {
  await Promise.all([mainContext.rebuild(), qrcodeContext.rebuild()]);
  await Promise.all([mainContext.dispose(), qrcodeContext.dispose()]);
} else {
  await Promise.all([mainContext.watch(), qrcodeContext.watch()]);
}
