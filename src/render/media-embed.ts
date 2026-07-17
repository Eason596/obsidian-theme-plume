/**
 * @[pdf] / @[bilibili] / @[youtube] embeds — VuePress Theme Plume parity (iframe).
 */

import type {
  BilibiliEmbedAttrs,
  PdfEmbedAttrs,
  YoutubeEmbedAttrs
} from "../types";

export type { BilibiliEmbedAttrs, PdfEmbedAttrs, YoutubeEmbedAttrs };

export function parseRect(str: string, unit = "px"): string {
  if (Number.parseFloat(str) === Number(str)) {
    return `${str}${unit}`;
  }
  return str;
}

export function timeToSeconds(time: string | undefined): number {
  if (!time) return 0;
  if (Number.parseFloat(time) === Number(time)) {
    return Number(time);
  }
  const [s, m, h = 0] = time
    .split(/\s*:\s*/)
    .reverse()
    .map((n) => Number(n) || 0);
  return s + m * 60 + h * 3600;
}

function parseAttr(text: string, key: string): string | undefined {
  const attrRegex = new RegExp(`${key}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, "i");
  const match = text.match(attrRegex);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3] ?? undefined;
}

function flagPresent(rest: string, name: string): boolean {
  return new RegExp(`(^|\\s)${name}(\\s|$|=)`, "i").test(rest);
}

export function parsePdfEmbed(info: string, src: string): PdfEmbedAttrs {
  const attrs: PdfEmbedAttrs = { src: src.trim() };
  let page = 1;
  for (const token of info.trim().split(/\s+/)) {
    if (/^\d+$/.test(token)) {
      page = Number(token);
    }
  }
  attrs.page = page;

  if (flagPresent(info, "no-toolbar") || flagPresent(info, "noToolbar")) {
    const v = parseAttr(info, "no-toolbar") ?? parseAttr(info, "noToolbar");
    attrs.noToolbar = v ? v !== "false" : true;
  }

  const zoom = parseAttr(info, "zoom");
  attrs.zoom = zoom ? Number(zoom) || 50 : 50;

  const width = parseAttr(info, "width");
  if (width) attrs.width = parseRect(width);
  const height = parseAttr(info, "height");
  if (height) attrs.height = parseRect(height);
  const ratio = parseAttr(info, "ratio");
  if (ratio) attrs.ratio = ratio;

  const title = parseAttr(info, "title");
  attrs.title = title || src.split(/[/\\]/).pop() || "PDF";
  return attrs;
}

export function parseBilibiliEmbed(info: string, source: string): BilibiliEmbedAttrs {
  const ids = source.trim().split(/\s+/).filter(Boolean);
  const bvid = ids.find((id) => /^BV/i.test(id));
  const rest = ids.filter((id) => !/^BV/i.test(id));
  const [aid, cid] = rest;

  const attrs: BilibiliEmbedAttrs = {
    bvid,
    aid,
    cid,
    title: parseAttr(info, "title") || "Bilibili",
    autoplay: false
  };

  if (flagPresent(info, "autoplay")) {
    const v = parseAttr(info, "autoplay");
    attrs.autoplay = v ? v !== "false" : true;
  }

  for (const token of info.trim().split(/\s+/)) {
    const m = token.match(/^p(\d+)$/i);
    if (m) attrs.page = Number(m[1]);
  }

  const time = parseAttr(info, "time");
  if (time) attrs.time = timeToSeconds(time);

  const width = parseAttr(info, "width");
  if (width) attrs.width = parseRect(width);
  const height = parseAttr(info, "height");
  if (height) attrs.height = parseRect(height);
  const ratio = parseAttr(info, "ratio");
  if (ratio) attrs.ratio = ratio;

  return attrs;
}

export function extractYoutubeId(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (/^[\w-]{6,}$/.test(s) && !/[/?&=]/.test(s)) {
    return s;
  }
  try {
    const url = new URL(s.startsWith("//") ? `https:${s}` : s);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\//, "").split("/")[0] || "";
    }
    const v = url.searchParams.get("v");
    if (v) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
  } catch {
    /* plain id */
  }
  return s;
}

export function parseYoutubeEmbed(info: string, idRaw: string): YoutubeEmbedAttrs {
  const attrs: YoutubeEmbedAttrs = {
    id: extractYoutubeId(idRaw),
    title: parseAttr(info, "title") || "YouTube",
    autoplay: false,
    loop: false
  };

  if (flagPresent(info, "autoplay")) {
    const v = parseAttr(info, "autoplay");
    attrs.autoplay = v ? v !== "false" : true;
  }
  if (flagPresent(info, "loop")) {
    const v = parseAttr(info, "loop");
    attrs.loop = v ? v !== "false" : true;
  }

  const start = parseAttr(info, "start");
  if (start) attrs.start = timeToSeconds(start);
  const end = parseAttr(info, "end");
  if (end) attrs.end = timeToSeconds(end);

  const width = parseAttr(info, "width");
  if (width) attrs.width = parseRect(width);
  const height = parseAttr(info, "height");
  if (height) attrs.height = parseRect(height);
  const ratio = parseAttr(info, "ratio");
  if (ratio) attrs.ratio = ratio;

  return attrs;
}

export function buildBilibiliSrc(attrs: BilibiliEmbedAttrs): string {
  const params = new URLSearchParams();
  if (attrs.bvid) params.set("bvid", attrs.bvid);
  if (attrs.aid) params.set("aid", attrs.aid);
  if (attrs.cid) params.set("cid", attrs.cid);
  if (attrs.page) params.set("p", String(attrs.page));
  if (attrs.time) params.set("t", String(attrs.time));
  params.set("autoplay", attrs.autoplay ? "1" : "0");
  params.set("high_quality", "1");
  return `https://player.bilibili.com/player.html?${params.toString()}`;
}

export function buildYoutubeSrc(attrs: YoutubeEmbedAttrs): string {
  const params = new URLSearchParams();
  if (attrs.autoplay) params.set("autoplay", "1");
  if (attrs.loop) {
    params.set("loop", "1");
    params.set("playlist", attrs.id);
  }
  if (attrs.start) params.set("start", String(attrs.start));
  if (attrs.end) params.set("end", String(attrs.end));
  const qs = params.toString();
  return `https://www.youtube.com/embed/${attrs.id}${qs ? `?${qs}` : ""}`;
}

export function buildPdfSrc(resolvedUrl: string, attrs: PdfEmbedAttrs): string {
  const page = attrs.page ?? 1;
  const toolbar = attrs.noToolbar ? 0 : 1;
  const zoom = attrs.zoom ?? 50;
  const hash = `page=${page}&toolbar=${toolbar}&zoom=${zoom}`;
  const base = resolvedUrl.split("#")[0];
  return `${base}#${hash}`;
}

const IFRAME_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture";

export function applyEmbedBoxSize(
  el: HTMLElement,
  opts: {
    width?: string;
    height?: string;
    ratio?: string;
    fallbackHeight?: string;
    defaultRatio?: string;
  }
): void {
  el.style.width = opts.width || "100%";
  el.style.maxWidth = "100%";
  el.style.border = "none";
  el.style.display = "block";

  if (opts.height) {
    el.style.height = opts.height;
    el.style.aspectRatio = "";
    return;
  }

  const ratio = opts.ratio || opts.defaultRatio;
  if (ratio) {
    const normalized = ratio.includes(":")
      ? ratio.replace(/\s*:\s*/, " / ")
      : ratio;
    el.style.aspectRatio = normalized;
    el.style.height = "auto";
    return;
  }

  if (opts.fallbackHeight) {
    el.style.height = opts.fallbackHeight;
  }
}

export function createVideoIframe(
  parent: HTMLElement,
  src: string,
  title: string,
  type: "bilibili" | "youtube",
  size: { width?: string; height?: string; ratio?: string }
): HTMLIFrameElement {
  const iframe = parent.createEl("iframe", {
    cls: `vp-video-iframe ${type}`,
    attr: {
      src,
      title,
      allow: IFRAME_ALLOW,
      allowfullscreen: "true",
      frameborder: "0",
      scrolling: "no",
      border: "0",
      framespacing: "0"
    }
  });
  applyEmbedBoxSize(iframe, {
    width: size.width,
    height: size.height,
    ratio: size.ratio,
    defaultRatio: "16:9"
  });
  return iframe;
}

export function createPdfIframe(
  parent: HTMLElement,
  src: string,
  title: string,
  size: { width?: string; height?: string; ratio?: string }
): HTMLIFrameElement {
  const iframe = parent.createEl("iframe", {
    cls: "vp-pdf-iframe",
    attr: {
      src,
      title,
      allowfullscreen: "true",
      frameborder: "0"
    }
  });
  applyEmbedBoxSize(iframe, {
    width: size.width,
    height: size.height,
    ratio: size.ratio,
    fallbackHeight: "600px"
  });
  return iframe;
}
