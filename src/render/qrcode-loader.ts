/**
 * Loads sibling `qrcode-lib.cjs` from the plugin folder.
 * Plain `import("./…")` resolves to `app://obsidian.md/…` and fails;
 * `.cjs` avoids `"type":"module"` treating the chunk as an empty ESM namespace.
 */

import { FileSystemAdapter, type App } from "obsidian";
import type { QrcodeContainerAttrs } from "../types";

type QrcodeModule = {
  generateQrDataUrl: (
    text: string,
    attrs: QrcodeContainerAttrs
  ) => Promise<string>;
};

type NodeRequire = (id: string) => unknown;

const QRCODE_LIB_FILENAME = "qrcode-lib.cjs";

let appRef: App | null = null;
let manifestDir: string | null = null;
let qrcodeModulePromise: Promise<QrcodeModule> | null = null;

/** Call once from plugin onload with `this.app` / `this.manifest.dir`. */
export function configureQrcodeLoader(app: App, pluginManifestDir: string): void {
  appRef = app;
  manifestDir = pluginManifestDir;
  qrcodeModulePromise = null;
}

function resolveQrcodeLibPath(): string | null {
  if (!appRef || !manifestDir) return null;
  const adapter = appRef.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) return null;
  const base = adapter.getBasePath();
  return `${base}/${manifestDir}/${QRCODE_LIB_FILENAME}`.replace(/\\/g, "/");
}

function getNodeRequire(): NodeRequire | null {
  const w = window as unknown as { require?: NodeRequire };
  if (typeof w.require === "function") {
    return w.require;
  }
  return null;
}

function asQrcodeModule(raw: unknown): QrcodeModule | null {
  if (!raw || typeof raw !== "object") return null;
  const mod = raw as Record<string, unknown>;
  const fn =
    (typeof mod.generateQrDataUrl === "function" ? mod.generateQrDataUrl : null)
    ?? (
      mod.default
      && typeof mod.default === "object"
      && typeof (mod.default as { generateQrDataUrl?: unknown }).generateQrDataUrl === "function"
        ? (mod.default as { generateQrDataUrl: QrcodeModule["generateQrDataUrl"] }).generateQrDataUrl
        : null
    );
  if (!fn) return null;
  return { generateQrDataUrl: fn as QrcodeModule["generateQrDataUrl"] };
}

function importQrcodeLib(): Promise<QrcodeModule> {
  const fullPath = resolveQrcodeLibPath();
  const req = getNodeRequire();
  if (!fullPath || !req) {
    return Promise.reject(
      new Error(
        "QR code requires desktop Obsidian (FileSystemAdapter + require). Mobile is not supported for this embed."
      )
    );
  }
  try {
    const mod = asQrcodeModule(req(fullPath));
    if (!mod) {
      return Promise.reject(
        new Error(`qrcode-lib.cjs loaded but generateQrDataUrl is missing (${fullPath})`)
      );
    }
    return Promise.resolve(mod);
  } catch (err) {
    return Promise.reject(
      err instanceof Error
        ? err
        : new Error(`Failed to load ${QRCODE_LIB_FILENAME} from ${fullPath}`)
    );
  }
}

export function loadQrcodeModule(): Promise<QrcodeModule> {
  if (!qrcodeModulePromise) {
    qrcodeModulePromise = importQrcodeLib().catch((err) => {
      // Do not cache failures — allow retry after install/copy.
      qrcodeModulePromise = null;
      throw err;
    });
  }
  return qrcodeModulePromise;
}

export async function generateQrDataUrl(
  text: string,
  attrs: QrcodeContainerAttrs
): Promise<string> {
  const mod = await loadQrcodeModule();
  return mod.generateQrDataUrl(text, attrs);
}
