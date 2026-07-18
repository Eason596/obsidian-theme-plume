import {
  arrayBufferToBase64,
  requestUrl,
  type App,
  type RequestUrlParam,
  type RequestUrlResponse
} from "obsidian";

const DEFAULT_ICON_SIZE = 16;
const FAVICON_CLASS = "vp-link-favicon";
const MAX_FAVICON_HOST_CACHE = 128;
const FAVICON_SUCCESS_TTL_MS = 24 * 60 * 60 * 1000;
const FAVICON_FAILURE_TTL_MS = 10 * 60 * 1000;
const MAX_FAVICON_BYTES = 256 * 1024;
const MAX_FAVICON_CONCURRENCY = 6;

export interface LinkIconOptions {
  enabled: boolean;
  size: number;
}

export interface LinkFaviconContext {
  app: App;
  sourcePath: string;
  /** Current Markdown text, used while MetadataCache is still catching up. */
  sourceText?: string;
  /** Optional async-lifecycle guard supplied by the section render pipeline. */
  isCurrent?: () => boolean;
}

export type FaviconRequester = (
  request: RequestUrlParam | string
) => Promise<RequestUrlResponse>;

interface FaviconCacheEntry {
  pending: Promise<string | null>;
  expiresAt: number;
}

const faviconDataByHost = new Map<string, FaviconCacheEntry>();
let activeFaviconRequests = 0;
const faviconRequestQueue: Array<() => void> = [];
const faviconRetryTimers = new Set<number>();

export function clearFaviconCache(): void {
  faviconDataByHost.clear();
}

export function clearFaviconRetryTimers(): void {
  for (const id of faviconRetryTimers) {
    window.clearTimeout(id);
  }
  faviconRetryTimers.clear();
}

function parseTruthy(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }
  return false;
}

function parseSize(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(?:px)?$/i);
    if (match) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > 0) {
        return Math.round(n);
      }
    }
  }
  return DEFAULT_ICON_SIZE;
}

function faviconSz(size: number): number {
  if (size <= 16) return 16;
  if (size <= 32) return 32;
  return 64;
}

export function readLinkIconOptionsFromText(sourceText: string): LinkIconOptions | null {
  const frontmatter = sourceText.match(
    /^\uFEFF?---[\t ]*\r?\n([\s\S]*?)\r?\n---[\t ]*(?:\r?\n|$)/
  );
  if (!frontmatter) return null;

  let enabledValue: string | undefined;
  let sizeValue: string | undefined;
  for (const line of frontmatter[1].split(/\r?\n/)) {
    const match = line.match(
      /^[\t ]*(link-icons|linkIcons|link-icon-size|linkIconSize)[\t ]*:[\t ]*(.*?)[\t ]*$/
    );
    if (!match) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, "$1$2");
    if (match[1] === "link-icons" || match[1] === "linkIcons") {
      enabledValue = value;
    } else {
      sizeValue = value;
    }
  }
  if (enabledValue === undefined && sizeValue === undefined) return null;
  return {
    enabled: parseTruthy(enabledValue),
    size: parseSize(sizeValue)
  };
}

export function readLinkIconOptions(
  app: App,
  sourcePath: string,
  sourceText?: string
): LinkIconOptions {
  // Live note text wins — hyphenated frontmatter keys are easy for MetadataCache to miss.
  const textOptions = sourceText ? readLinkIconOptionsFromText(sourceText) : null;
  if (textOptions) {
    return textOptions;
  }

  const cache = app.metadataCache.getCache(sourcePath);
  const fm = cache?.frontmatter;
  if (!fm) {
    return { enabled: false, size: DEFAULT_ICON_SIZE };
  }
  return {
    enabled: parseTruthy(fm["link-icons"] ?? fm.linkIcons),
    size: parseSize(fm["link-icon-size"] ?? fm.linkIconSize)
  };
}

function isExternalHttpLink(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute("href")?.trim() ?? "";
  if (!href) return false;
  if (anchor.classList.contains("internal-link")) return false;
  if (anchor.classList.contains("external-link")) return true;
  return /^https?:\/\//i.test(href);
}

function hostnameFromHref(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname || null;
  } catch {
    return null;
  }
}

/** Brand host aliases for favicon lookup (CN mirrors → global). */
export function faviconLookupHosts(hostname: string, href: string): string[] {
  const h = hostname.toLowerCase();
  const hosts: string[] = [];
  const push = (value: string): void => {
    const v = value.toLowerCase();
    if (!v || hosts.includes(v)) return;
    hosts.push(v);
  };

  push(h);
  if (h.startsWith("www.")) push(h.slice(4));

  try {
    const path = new URL(href).pathname.toLowerCase();
    if (h === "www.google.cn" || h === "google.cn") {
      if (path.includes("chrome")) {
        push("www.google.com");
        push("chrome.google.com");
      } else {
        push("www.google.com");
      }
    } else if (h.endsWith(".google.cn")) {
      push(h.replace(/\.google\.cn$/i, ".google.com"));
    }
  } catch {
    if (h === "www.google.cn" || h === "google.cn") push("www.google.com");
  }

  if (h.endsWith("asus.com.cn")) {
    push("www.asus.com");
    push("asus.com");
  }
  if (h.endsWith("xunlei.com")) {
    push("www.xunlei.com");
    push("xunlei.com");
  }
  if (h === "copilot.tencent.com") {
    push("cloud.tencent.com");
    push("www.tencent.com");
  }

  return hosts;
}

/**
 * Fetch candidates for Obsidian `requestUrl` (img CDN tags are often blocked in preview).
 * Order: site → Yandex → Google (short list; DDG is slow/unreliable here).
 */
export function buildFaviconCandidates(href: string, hostname: string, size: number): string[] {
  const sz = faviconSz(size);
  const hosts = faviconLookupHosts(hostname, href);
  const preferred = hosts.at(-1) ?? hostname;
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (url: string): void => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  try {
    push(`${new URL(href).origin}/favicon.ico`);
  } catch {
    /* ignore */
  }
  push(`https://favicon.yandex.net/favicon/${preferred}?size=${sz}`);
  push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(preferred)}&sz=${sz}`);

  return out;
}

async function withFaviconRequestSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeFaviconRequests >= MAX_FAVICON_CONCURRENCY) {
    await new Promise<void>((resolve) => faviconRequestQueue.push(resolve));
  }
  activeFaviconRequests += 1;
  try {
    return await task();
  } finally {
    activeFaviconRequests -= 1;
    faviconRequestQueue.shift()?.();
  }
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string): string | null {
  if (buffer.byteLength < 16 || buffer.byteLength > MAX_FAVICON_BYTES) return null;
  return `data:${mimeType};base64,${arrayBufferToBase64(buffer)}`;
}

function sniffImageMime(buffer: ArrayBuffer, declared: string): string | null {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 4
    && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return "image/gif";
  }
  if (bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "image/webp";
  }
  if (bytes.length >= 4
    && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00) {
    return "image/x-icon";
  }
  if (bytes.length >= 4
    && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x02 && bytes[3] === 0x00) {
    return "image/x-icon";
  }
  if (declared.startsWith("image/")) return declared;
  return null;
}

async function loadFaviconDataUrl(
  candidates: string[],
  requester: FaviconRequester
): Promise<string | null> {
  return withFaviconRequestSlot(async () => {
    for (const url of candidates) {
      try {
        const response = await requester({ url, method: "GET" });
        if (response.status < 200 || response.status >= 300) continue;
        const declared = (
          response.headers["content-type"]
          ?? response.headers["Content-Type"]
          ?? ""
        ).split(";")[0].trim().toLowerCase();
        const mime = sniffImageMime(response.arrayBuffer, declared);
        if (!mime) continue;
        const dataUrl = arrayBufferToDataUrl(response.arrayBuffer, mime);
        if (dataUrl) return dataUrl;
      } catch {
        continue;
      }
    }
    return null;
  });
}

function getFaviconDataUrl(
  hostname: string,
  candidates: string[],
  requester: FaviconRequester
): Promise<string | null> {
  const key = hostname.toLowerCase();
  const cached = faviconDataByHost.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    faviconDataByHost.delete(key);
    faviconDataByHost.set(key, cached);
    return cached.pending;
  }
  if (cached) faviconDataByHost.delete(key);

  const entry: FaviconCacheEntry = {
    pending: loadFaviconDataUrl(candidates, requester),
    expiresAt: Date.now() + FAVICON_SUCCESS_TTL_MS
  };
  faviconDataByHost.set(key, entry);
  while (faviconDataByHost.size > MAX_FAVICON_HOST_CACHE) {
    const oldest = faviconDataByHost.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    faviconDataByHost.delete(oldest);
  }
  void entry.pending.then((dataUrl) => {
    if (faviconDataByHost.get(key) === entry) {
      entry.expiresAt = Date.now() + (dataUrl ? FAVICON_SUCCESS_TTL_MS : FAVICON_FAILURE_TTL_MS);
    }
  });
  return entry.pending;
}

async function ensureFavicon(
  anchor: HTMLAnchorElement,
  size: number,
  requester: FaviconRequester
): Promise<void> {
  if (anchor.querySelector(`:scope > .${FAVICON_CLASS}`)) {
    const existing = anchor.querySelector(`:scope > img.${FAVICON_CLASS}`) as HTMLImageElement | null;
    if (existing) {
      existing.style.setProperty("--vp-link-favicon-size", `${size}px`);
    }
    return;
  }

  const href = anchor.getAttribute("href")?.trim() ?? "";
  const host = hostnameFromHref(href);
  if (!host) return;

  const candidates = buildFaviconCandidates(href, host, size);
  if (candidates.length === 0) return;

  const img = anchor.ownerDocument.createElement("img");
  img.className = FAVICON_CLASS;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.decoding = "async";
  img.draggable = false;
  img.style.setProperty("--vp-link-favicon-size", `${size}px`);
  img.style.visibility = "hidden";
  anchor.insertBefore(img, anchor.firstChild);

  const dataUrl = await getFaviconDataUrl(host, candidates, requester);
  if (img.parentElement !== anchor) {
    img.remove();
    return;
  }
  if (!dataUrl) {
    img.remove();
    return;
  }
  img.src = dataUrl;
  img.style.visibility = "";
}

function collectExternalLinks(root: HTMLElement): HTMLAnchorElement[] {
  return Array.from(root.querySelectorAll<HTMLAnchorElement>("a[href]")).filter((anchor) => {
    if (anchor.closest(".vp-link-card")) return false;
    return isExternalHttpLink(anchor);
  });
}

/**
 * Apply link favicons via Obsidian `requestUrl` → data URL.
 * Remote `<img src="https://…">` is unreliable in Obsidian preview (often blocked).
 */
export async function applyLinkFavicons(
  root: HTMLElement,
  options: LinkIconOptions,
  requester: FaviconRequester = requestUrl
): Promise<void> {
  if (!options.enabled) return;
  const anchors = collectExternalLinks(root);
  await Promise.all(anchors.map((anchor) => ensureFavicon(anchor, options.size, requester)));
}

/**
 * Prepend favicons to external links. Network work is concurrent+cached;
 * DOM collection happens at execution time (and once more after masonry settles).
 */
export function processLinkFavicons(root: HTMLElement, ctx: LinkFaviconContext): void {
  const options = readLinkIconOptions(ctx.app, ctx.sourcePath, ctx.sourceText);
  if (!options.enabled) return;

  const run = (): void => {
    if (ctx.isCurrent && !ctx.isCurrent()) return;
    const ownerPath = root.dataset.plumeSourcePath;
    if (ownerPath && ownerPath !== ctx.sourcePath) return;
    if (collectExternalLinks(root).length === 0) return;
    void applyLinkFavicons(root, options).catch((err) => {
      console.error("[theme-plume] link favicons failed", err);
    });
  };

  run();
  // Masonry/grid may still be packing columns — retry only then.
  if (!root.querySelector(".vp-card-masonry, .vp-card-grid")) {
    return;
  }
  const schedule = (delayMs: number): void => {
    const id = window.setTimeout(() => {
      faviconRetryTimers.delete(id);
      run();
    }, delayMs);
    faviconRetryTimers.add(id);
  };
  schedule(120);
  schedule(400);
}
