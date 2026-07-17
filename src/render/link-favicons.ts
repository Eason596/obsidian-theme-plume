import type { App } from "obsidian";

const DEFAULT_ICON_SIZE = 16;
const FAVICON_CLASS = "vp-link-favicon";

export interface LinkIconOptions {
  enabled: boolean;
  size: number;
}

export interface LinkFaviconContext {
  app: App;
  sourcePath: string;
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

/** Favicon CDN size bucket (Google s2 accepts 16 / 32 / 64). */
function faviconSz(size: number): number {
  if (size <= 16) {
    return 16;
  }
  if (size <= 32) {
    return 32;
  }
  return 64;
}

export function readLinkIconOptions(app: App, sourcePath: string): LinkIconOptions {
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
  if (!href) {
    return false;
  }
  if (anchor.classList.contains("internal-link")) {
    return false;
  }
  if (anchor.classList.contains("external-link")) {
    return true;
  }
  return /^https?:\/\//i.test(href);
}

function hostnameFromHref(href: string): string | null {
  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.hostname || null;
  } catch {
    return null;
  }
}

function faviconUrl(hostname: string, size: number): string {
  const sz = faviconSz(size);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=${sz}`;
}

function ensureFavicon(anchor: HTMLAnchorElement, size: number): void {
  if (anchor.querySelector(`:scope > .${FAVICON_CLASS}`)) {
    const existing = anchor.querySelector(`:scope > img.${FAVICON_CLASS}`) as HTMLImageElement | null;
    if (existing) {
      existing.style.setProperty("--vp-link-favicon-size", `${size}px`);
    }
    return;
  }

  const href = anchor.getAttribute("href")?.trim() ?? "";
  const host = hostnameFromHref(href);
  if (!host) {
    return;
  }

  const img = anchor.ownerDocument.createElement("img");
  img.className = FAVICON_CLASS;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.decoding = "async";
  img.loading = "lazy";
  img.draggable = false;
  img.src = faviconUrl(host, size);
  img.style.setProperty("--vp-link-favicon-size", `${size}px`);
  anchor.insertBefore(img, anchor.firstChild);
}

/**
 * When `link-icons: true` is set on the note, prepend site favicons to external links.
 * Idempotent: safe to run after Plume block re-renders.
 */
export function processLinkFavicons(root: HTMLElement, ctx: LinkFaviconContext): void {
  const options = readLinkIconOptions(ctx.app, ctx.sourcePath);
  if (!options.enabled) {
    return;
  }

  const anchors = root.querySelectorAll("a[href]");
  for (const node of Array.from(anchors)) {
    const anchor = node as HTMLAnchorElement;
    if (anchor.closest(".vp-link-card")) {
      continue;
    }
    if (!isExternalHttpLink(anchor)) {
      continue;
    }
    ensureFavicon(anchor, options.size);
  }
}
