import { setIcon, type Component } from "obsidian";
import { resolveNodeIcon } from "../icons";
import type { FileTreeIconMode } from "../types";
import { hashString } from "../utils/hash";
import {
  getActiveShikiThemeId,
  highlightSourceLines,
  languageFromFilename,
  normalizeFenceLang,
  resolveCodeLanguage
} from "./code-highlight";
import { prepareIconifyIconElement, processIconifyIcons } from "./iconify-online";

export const CODE_TITLE_PROCESSED_ATTR = "data-vp-code-title-done";
export const CODE_FEATURES_PROCESSED_ATTR = "data-vp-code-features-done";

const SCAN_CACHE_MAX = 12;
const scanCache = new Map<string, CodeFenceMeta[]>();

/** Body lines kept off the DOM attribute (see writeFenceMetaAttr). */
const fenceBodyByPre = new WeakMap<HTMLElement, string[]>();
const fenceObserverByPre = new WeakMap<HTMLElement, MutationObserver>();

export interface CodeFenceMeta {
  title?: string;
  /** Fence language id from info string (e.g. vue, ts). */
  language?: string;
  /** 0-based line indices to highlight from `{1,3-5}` info syntax. */
  highlightLines: number[];
  lineNumbers: boolean | null;
  lineNumbersStart: number;
  collapsedLines: number | null;
  openLine: number;
  closeLine: number;
  /** Raw body lines between fences (for [!code] markers). */
  bodyLines: string[];
}

const CODE_NOTATION_RE =
  /(?:\/\/|#|--|\/\*|<!--)\s*\[!code\s+(highlight|focus(?::\d+)?|\+\+|--|warning|error|word:[^\]]+)\]\s*(?:\*\/|-->)?\s*$/;

function parseHighlightRanges(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number.parseInt(range[1], 10);
      const b = Number.parseInt(range[2], 10);
      const from = Math.min(a, b);
      const to = Math.max(a, b);
      for (let n = from; n <= to; n += 1) {
        if (n >= 1) out.add(n - 1);
      }
      continue;
    }
    const n = Number.parseInt(p, 10);
    if (Number.isFinite(n) && n >= 1) out.add(n - 1);
  }
  return Array.from(out).sort((a, b) => a - b);
}

function parseFenceInfo(info: string): Omit<CodeFenceMeta, "openLine" | "closeLine" | "bodyLines"> {
  const tm = info.match(/\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/);
  const title = tm ? (tm[1] ?? tm[2] ?? tm[3]) : undefined;

  const langToken = (info.trim().split(/\s+/)[0] ?? "").replace(/\{.*$/, "");
  const language =
    langToken
    && !langToken.startsWith(":")
    && !langToken.includes("=")
    && langToken !== "{}"
      ? normalizeFenceLang(langToken)
      : undefined;

  const highlightLines: number[] = [];
  const brace = info.match(/\{([^}]+)\}/);
  if (brace) {
    highlightLines.push(...parseHighlightRanges(brace[1]));
  }

  let lineNumbers: boolean | null = null;
  let lineNumbersStart = 1;
  if (/:no-line-numbers\b/i.test(info)) {
    lineNumbers = false;
  } else {
    const ln = info.match(/:line-numbers(?:=(\d+))?\b/i);
    if (ln) {
      lineNumbers = true;
      if (ln[1]) lineNumbersStart = Number.parseInt(ln[1], 10) || 1;
    }
  }

  let collapsedLines: number | null = null;
  if (/:no-collapsed-lines\b/i.test(info)) {
    collapsedLines = null;
  } else {
    const cl = info.match(/:collapsed-lines(?:=(\d+))?\b/i);
    if (cl) {
      collapsedLines = cl[1] ? Number.parseInt(cl[1], 10) : 10;
      if (!Number.isFinite(collapsedLines) || collapsedLines! < 1) collapsedLines = 10;
    }
  }

  return { title, language, highlightLines, lineNumbers, lineNumbersStart, collapsedLines };
}

/** Lightweight title scan — no bodyLines (for editor-change title reconcile). */
export function scanCodeFenceTitles(markdown: string): Array<{ title?: string }> {
  const lines = markdown.split(/\r?\n/);
  const result: Array<{ title?: string }> = [];
  let fenceChar = "";
  let fenceLen = 0;
  let currentTitle: string | undefined;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (fenceLen > 0) {
      const closeRe = new RegExp(`^\\s*${fenceChar}{${fenceLen},}\\s*$`);
      if (closeRe.test(line)) {
        result.push({ title: currentTitle });
        fenceChar = "";
        fenceLen = 0;
        currentTitle = undefined;
      }
      continue;
    }
    const open = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!open) continue;
    fenceChar = open[2][0];
    fenceLen = open[2].length;
    currentTitle = parseFenceInfo(open[3] ?? "").title;
  }
  if (fenceLen > 0) {
    result.push({ title: currentTitle });
  }
  return result;
}

function scanCacheKey(markdown: string): string {
  return `${markdown.length}:${hashString(markdown)}`;
}

export function clearCodeFenceScanCache(): void {
  scanCache.clear();
}

export function scanCodeFences(markdown: string): CodeFenceMeta[] {
  const key = scanCacheKey(markdown);
  const hit = scanCache.get(key);
  if (hit) return hit;

  const lines = markdown.split(/\r?\n/);
  const result: CodeFenceMeta[] = [];
  let fenceChar = "";
  let fenceLen = 0;
  let openLine = -1;
  let currentMeta: Omit<CodeFenceMeta, "openLine" | "closeLine" | "bodyLines"> | null = null;
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (fenceLen > 0) {
      const closeRe = new RegExp(`^\\s*${fenceChar}{${fenceLen},}\\s*$`);
      if (closeRe.test(line)) {
        result.push({
          ...(currentMeta ?? {
            highlightLines: [],
            lineNumbers: null,
            lineNumbersStart: 1,
            collapsedLines: null
          }),
          openLine,
          closeLine: i,
          bodyLines: bodyLines.slice()
        });
        fenceChar = "";
        fenceLen = 0;
        openLine = -1;
        currentMeta = null;
        bodyLines.length = 0;
      } else {
        bodyLines.push(line);
      }
      continue;
    }
    const open = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!open) continue;
    fenceChar = open[2][0];
    fenceLen = open[2].length;
    openLine = i;
    currentMeta = parseFenceInfo(open[3] ?? "");
    bodyLines.length = 0;
  }
  if (fenceLen > 0 && openLine >= 0 && currentMeta) {
    result.push({
      ...currentMeta,
      openLine,
      closeLine: lines.length - 1,
      bodyLines: bodyLines.slice()
    });
  }

  if (scanCache.size >= SCAN_CACHE_MAX) {
    const oldest = scanCache.keys().next().value;
    if (oldest !== undefined) scanCache.delete(oldest);
  }
  scanCache.set(key, result);
  return result;
}

interface LineDecoration {
  text: string;
  classes: string[];
  word?: string;
}

function parseLineNotation(raw: string): LineDecoration {
  const classes: string[] = ["line"];
  let text = raw;
  let word: string | undefined;
  const m = raw.match(CODE_NOTATION_RE);
  if (m) {
    text = raw.slice(0, m.index).replace(/\s+$/, "");
    const kind = m[1];
    if (kind === "highlight") classes.push("highlighted");
    else if (kind === "++") classes.push("diff", "add");
    else if (kind === "--") classes.push("diff", "remove");
    else if (kind === "warning") classes.push("highlighted", "warning");
    else if (kind === "error") classes.push("highlighted", "error");
    else if (kind.startsWith("focus")) classes.push("focused");
    else if (kind.startsWith("word:")) word = kind.slice(5);
  }
  return { text, classes, word };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function listCodeBlockPres(container: HTMLElement): HTMLElement[] {
  const found: HTMLElement[] = [];
  const consider = (pre: HTMLElement): void => {
    // Live Preview CM editable surface — do not rewrite
    if (pre.closest(".cm-content, .cm-editor .cm-scroller")) return;
    // Code-tree panel owns its header; never attach document fence titles here
    // (otherwise first Reading-view paint mis-pairs title="HelloWorld.vue" onto main.ts).
    if (
      pre.closest(
        ".vp-code-tree, .obsidian-vuepress-code-tree, .vp-code-tree-panel-content"
      )
      || pre.classList.contains("vp-code-tree-pre")
    ) {
      return;
    }
    const first = pre.firstElementChild;
    if (first != null && first.tagName === "CODE" && !found.includes(pre)) {
      found.push(pre);
    }
  };
  if (container.tagName === "PRE") {
    consider(container);
  }
  for (const pre of Array.from(container.querySelectorAll("pre"))) {
    if (pre instanceof HTMLElement) consider(pre);
  }
  return found;
}

function normalizeCodeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n$/, "");
}

function stripNotationFromLine(line: string): string {
  return line.replace(CODE_NOTATION_RE, "").replace(/\s+$/, "");
}

/**
 * Obsidian Reading view often renders fence bodies as sibling spans / tokens
 * without literal `\n` in `textContent`, so two lines become
 * `link-icons: truelink-icon-size: 16`. Prefer structured line children when
 * present; otherwise fall back to text with optional flat-match recovery.
 */
function getRenderedCodeLines(code: HTMLElement): string[] {
  const lineEls = code.querySelectorAll(":scope > .line");
  if (lineEls.length > 0) {
    return Array.from(lineEls).map((el) => normalizeCodeText(el.textContent ?? ""));
  }
  const html = code.innerHTML;
  if (/<br\s*\/?>/i.test(html)) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html.replace(/<br\s*\/?>/gi, "\n");
    return normalizeCodeText(tmp.textContent ?? "").split("\n");
  }
  return normalizeCodeText(code.textContent ?? "").split("\n");
}

interface FenceBodyIndex {
  byLines: Map<string, CodeFenceMeta[]>;
  byFlat: Map<string, CodeFenceMeta[]>;
  fences: CodeFenceMeta[];
}

function buildFenceBodyIndex(fences: CodeFenceMeta[]): FenceBodyIndex {
  const byLines = new Map<string, CodeFenceMeta[]>();
  const byFlat = new Map<string, CodeFenceMeta[]>();
  for (const fence of fences) {
    const stripped = fence.bodyLines.map(stripNotationFromLine);
    const key = stripped.join("\n");
    const list = byLines.get(key);
    if (list) list.push(fence);
    else byLines.set(key, [fence]);
    if (stripped.length > 1) {
      const flat = stripped.join("");
      const flatList = byFlat.get(flat);
      if (flatList) flatList.push(fence);
      else byFlat.set(flat, [fence]);
    }
  }
  return { byLines, byFlat, fences };
}

function takeUnusedFence(
  bucket: CodeFenceMeta[] | undefined,
  used: Set<CodeFenceMeta>
): CodeFenceMeta | undefined {
  if (!bucket) return undefined;
  for (const fence of bucket) {
    if (!used.has(fence)) return fence;
  }
  return undefined;
}

/** Match a rendered code block to fence meta via body hash index + soft fallback. */
function findFenceForPreIndexed(
  pre: HTMLElement,
  index: FenceBodyIndex,
  used: Set<CodeFenceMeta>
): CodeFenceMeta | undefined {
  const code = pre.querySelector("code");
  if (!(code instanceof HTMLElement)) return undefined;
  const renderedLines = getRenderedCodeLines(code).map(stripNotationFromLine);
  const renderedKey = renderedLines.join("\n");
  const renderedFlat = renderedLines.join("");

  const exact = takeUnusedFence(index.byLines.get(renderedKey), used);
  if (exact) return exact;

  // Obsidian ate newlines: flattened text still matches fence body
  if (renderedLines.length === 1 && renderedFlat) {
    const flatHit = takeUnusedFence(index.byFlat.get(renderedFlat), used);
    if (flatHit) return flatHit;
  }

  // Soft match: same length and majority equal (rare path)
  let best: CodeFenceMeta | undefined;
  let bestScore = -1;
  for (const fence of index.fences) {
    if (used.has(fence)) continue;
    const body = fence.bodyLines.map(stripNotationFromLine);
    if (body.length === 0 && renderedLines.length === 0) return fence;
    if (body.length === 0 || body.length !== renderedLines.length) continue;
    let eq = 0;
    for (let i = 0; i < body.length; i += 1) {
      if (body[i] === renderedLines[i]) eq += 1;
    }
    if (eq > bestScore) {
      bestScore = eq;
      best = fence;
    }
  }
  if (best && bestScore >= Math.max(1, Math.floor((best.bodyLines.length || 1) * 0.6))) {
    return best;
  }
  return undefined;
}

function buildDecoratedLines(sourceLines: string[], meta: CodeFenceMeta): LineDecoration[] {
  const decorated: LineDecoration[] = [];
  const focusFlags = new Array<boolean>(sourceLines.length).fill(false);
  for (let li = 0; li < sourceLines.length; li += 1) {
    const focusMatch = sourceLines[li].match(CODE_NOTATION_RE);
    if (focusMatch?.[1]?.startsWith("focus")) {
      const kind = focusMatch[1];
      const span =
        kind === "focus" ? 1 : Number.parseInt(kind.slice("focus:".length), 10) || 1;
      for (let k = 0; k < span && li + k < sourceLines.length; k += 1) {
        focusFlags[li + k] = true;
      }
    }
  }

  for (let li = 0; li < sourceLines.length; li += 1) {
    const parsed = parseLineNotation(sourceLines[li]);
    if (meta.highlightLines.includes(li) && !parsed.classes.includes("highlighted")) {
      parsed.classes.push("highlighted");
    }
    if (focusFlags[li] && !parsed.classes.includes("focused")) {
      parsed.classes.push("focused");
    }
    decorated.push(parsed);
  }
  return decorated;
}

function ensureFeatureShell(pre: HTMLElement, code: HTMLElement, lang: string): HTMLElement {
  const parent = pre.parentElement;
  if (!parent) return pre;
  let shell: HTMLElement | null = parent.classList.contains("vp-code-features")
    ? parent
    : null;
  if (!shell) {
    const found = pre.closest(".vp-code-features");
    shell = found instanceof HTMLElement ? found : null;
  }
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "vp-code-features";
    parent.insertBefore(shell, pre);
    shell.appendChild(pre);
  }

  const langId = lang || "text";
  shell.classList.add(`language-${langId}`);
  shell.removeAttribute("data-ext");
  return shell;
}

/**
 * Wrap occurrences of `word` in text nodes only — never run a regex over HTML
 * (that would match inside `style="color:…"` / tags).
 */
function applyWordHighlightHtml(lineHtml: string, word: string | undefined): string {
  if (!word) return lineHtml;
  const wrap = document.createElement("span");
  wrap.innerHTML = lineHtml || "\u200b";

  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(wrap, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    textNodes.push(node as Text);
  }

  for (const textNode of textNodes) {
    const value = textNode.nodeValue ?? "";
    if (!value.includes(word)) continue;

    const frag = document.createDocumentFragment();
    let remaining = value;
    let idx = remaining.indexOf(word);
    while (idx >= 0) {
      if (idx > 0) {
        frag.appendChild(document.createTextNode(remaining.slice(0, idx)));
      }
      const mark = document.createElement("span");
      mark.className = "highlighted-word";
      mark.textContent = word;
      frag.appendChild(mark);
      remaining = remaining.slice(idx + word.length);
      idx = remaining.indexOf(word);
    }
    if (remaining) {
      frag.appendChild(document.createTextNode(remaining));
    }
    textNode.parentNode?.replaceChild(frag, textNode);
  }

  return wrap.innerHTML;
}

async function applyFeatureDom(
  pre: HTMLElement,
  meta: CodeFenceMeta,
  decorated: LineDecoration[]
): Promise<void> {
  const code = pre.querySelector("code");
  if (!(code instanceof HTMLElement)) return;

  const jobId = String((Number(pre.dataset.vpHlJob ?? "0") || 0) + 1);
  pre.dataset.vpHlJob = jobId;

  const lang = meta.language
    ? normalizeFenceLang(meta.language)
    : resolveCodeLanguage(code, pre);
  const cleanedSource = decorated.map((d) => d.text).join("\n");
  const hlLines = await highlightSourceLines(lang, cleanedSource);

  // Abort if Obsidian replaced this <code>, or a newer highlight job started
  if (pre.querySelector("code") !== code) return;
  if (pre.dataset.vpHlJob !== jobId) return;

  const hasFocus = decorated.some((d) => d.classes.includes("focused"));
  const hasLineDecor =
    decorated.some(
      (d) =>
        d.classes.includes("highlighted")
        || d.classes.includes("diff")
        || d.classes.includes("focused")
        || d.word
    ) || meta.highlightLines.length > 0;

  while (hlLines.length < decorated.length) hlLines.push("");
  if (hlLines.length > decorated.length) {
    hlLines.length = decorated.length;
  }

  const html = decorated
    .map((d, i) => {
      const cls = d.classes.join(" ");
      const inner = applyWordHighlightHtml(hlLines[i] ?? escapeHtml(d.text), d.word);
      return `<span class="${cls}">${inner || "\u200b"}</span>`;
    })
    .join("");

  pre.dataset.vpCodeWriting = "1";
  code.classList.remove("hljs");
  code.classList.add("shiki", `language-${lang}`);
  code.dataset.vpShikiTheme = getActiveShikiThemeId();
  code.innerHTML = html;
  pre.setAttribute(CODE_FEATURES_PROCESSED_ATTR, "1");
  delete pre.dataset.vpCodeWriting;

  const featureHost = ensureFeatureShell(pre, code, lang);

  featureHost.classList.toggle("has-focused", hasFocus);
  featureHost.classList.toggle("has-line-decor", hasLineDecor);

  if (meta.lineNumbers === true) {
    featureHost.classList.add("line-numbers-mode");
    let gutter = featureHost.querySelector<HTMLElement>(":scope > .line-numbers");
    if (!gutter) {
      gutter = document.createElement("div");
      gutter.className = "line-numbers";
      gutter.setAttribute("aria-hidden", "true");
      featureHost.insertBefore(gutter, pre);
    }
    gutter.replaceChildren();
    featureHost.style.setProperty(
      "--vp-code-line-number-start",
      String(meta.lineNumbersStart - 1)
    );
    for (let n = 0; n < decorated.length; n += 1) {
      const span = document.createElement("span");
      span.className = "line-number";
      gutter.appendChild(span);
    }
  } else {
    featureHost.classList.remove("line-numbers-mode");
    featureHost.querySelector(":scope > .line-numbers")?.remove();
  }

  if (meta.collapsedLines != null && decorated.length > meta.collapsedLines) {
    featureHost.classList.add("has-collapsed-lines", "collapsed");
    featureHost.style.setProperty("--vp-collapsed-lines", String(meta.collapsedLines));
    let btn = featureHost.querySelector<HTMLButtonElement>(":scope > .collapsed-lines");
    if (!btn) {
      btn = document.createElement("button");
      btn.type = "button";
      btn.className = "collapsed-lines";
      btn.setAttribute("aria-label", "Expand code");
      btn.setAttribute("aria-expanded", "false");
      featureHost.appendChild(btn);
      btn.addEventListener("click", () => {
        const nowCollapsed = featureHost.classList.toggle("collapsed");
        btn!.setAttribute("aria-expanded", nowCollapsed ? "false" : "true");
        btn!.setAttribute("aria-label", nowCollapsed ? "Expand code" : "Collapse code");
      });
    }
  }
}

function looksAlreadyDecorated(code: HTMLElement, meta: CodeFenceMeta): boolean {
  if (code.textContent?.includes("[!code")) return false;
  if (!code.querySelector(".line")) return false;
  // Only Shiki counts as done — Obsidian hljs must still be upgraded
  if (!code.classList.contains("shiki")) return false;
  if (code.dataset.vpShikiTheme !== getActiveShikiThemeId()) return false;
  if (meta.highlightLines.length > 0 && !code.querySelector(".highlighted")) return false;
  if (meta.bodyLines.some((l) => /\[!code\s+(?:\+\+|--)/.test(l)) && !code.querySelector(".diff")) {
    return false;
  }
  if (meta.bodyLines.some((l) => /\[!code\s+focus/.test(l)) && !code.querySelector(".focused")) {
    return false;
  }
  return true;
}

const activeFenceObservers = new Set<MutationObserver>();
const activeFenceTimers = new Set<number>();

/** Attr payload without bodyLines — bodies live in fenceBodyByPre. */
interface FenceMetaAttr {
  title?: string;
  language?: string;
  highlightLines: number[];
  lineNumbers: boolean | null;
  lineNumbersStart: number;
  collapsedLines: number | null;
  openLine: number;
  closeLine: number;
}

function isHtmlElement(node: Element | null): node is HTMLElement {
  return !!node && typeof (node as HTMLElement).classList !== "undefined";
}

function writeFenceMetaAttr(pre: HTMLElement, meta: CodeFenceMeta): void {
  fenceBodyByPre.set(pre, meta.bodyLines);
  const lite: FenceMetaAttr = {
    title: meta.title,
    language: meta.language,
    highlightLines: meta.highlightLines,
    lineNumbers: meta.lineNumbers,
    lineNumbersStart: meta.lineNumbersStart,
    collapsedLines: meta.collapsedLines,
    openLine: meta.openLine,
    closeLine: meta.closeLine
  };
  pre.dataset.vpFenceMeta = JSON.stringify(lite);
}

function readFenceMeta(pre: HTMLElement): CodeFenceMeta | null {
  const raw = pre.dataset.vpFenceMeta;
  if (!raw) return null;
  try {
    const lite = JSON.parse(raw) as FenceMetaAttr;
    const bodyLines = fenceBodyByPre.get(pre) ?? [];
    return { ...lite, bodyLines };
  } catch {
    return null;
  }
}

function clearPreFenceTimers(pre: HTMLElement): void {
  for (const key of ["vpFenceTimer", "vpFenceTimer2"] as const) {
    const id = Number(pre.dataset[key] ?? 0) || 0;
    if (id) {
      window.clearTimeout(id);
      activeFenceTimers.delete(id);
      delete pre.dataset[key];
    }
  }
}

function disconnectFenceWatcher(pre: HTMLElement): void {
  const obs = fenceObserverByPre.get(pre);
  if (obs) {
    obs.disconnect();
    activeFenceObservers.delete(obs);
    fenceObserverByPre.delete(pre);
  }
  delete pre.dataset.vpFenceWatch;
  clearPreFenceTimers(pre);
}

function scheduleFenceReapply(pre: HTMLElement, component?: Component): void {
  const meta = readFenceMeta(pre);
  if (!meta) return;

  const gen = String((Number(pre.dataset.vpFenceGen ?? "0") || 0) + 1);
  pre.dataset.vpFenceGen = gen;
  clearPreFenceTimers(pre);

  const run = (): void => {
    if (pre.dataset.vpFenceGen !== gen) return;
    const code = pre.querySelector("code");
    if (!isHtmlElement(code)) return;
    if (looksAlreadyDecorated(code, meta)) {
      disconnectFenceWatcher(pre);
      return;
    }
    const sourceLines =
      meta.bodyLines.length > 0
        ? meta.bodyLines
        : normalizeCodeText(code.textContent ?? "").split("\n");
    void applyFeatureDom(pre, meta, buildDecoratedLines(sourceLines, meta)).then(() => {
      if (pre.dataset.vpFenceGen !== gen) return;
      const next = pre.querySelector("code");
      if (isHtmlElement(next) && looksAlreadyDecorated(next, meta)) {
        disconnectFenceWatcher(pre);
      }
    });
  };

  // One short settle pass — Obsidian hljs usually finishes within a frame.
  const timer = window.setTimeout(() => {
    activeFenceTimers.delete(timer);
    delete pre.dataset.vpFenceTimer;
    run();
  }, 60);
  activeFenceTimers.add(timer);
  pre.dataset.vpFenceTimer = String(timer);
  component?.register(() => {
    window.clearTimeout(timer);
    activeFenceTimers.delete(timer);
  });
}

function watchFenceAgainstHighlighter(pre: HTMLElement, component?: Component): void {
  if (typeof MutationObserver === "undefined") return;
  if (pre.dataset.vpFenceWatch === "1") return;
  const code = pre.querySelector("code");
  if (!isHtmlElement(code)) return;
  pre.dataset.vpFenceWatch = "1";

  const obs = new MutationObserver(() => {
    if (!pre.isConnected) {
      disconnectFenceWatcher(pre);
      return;
    }
    if (pre.dataset.vpCodeWriting === "1") return;
    scheduleFenceReapply(pre, component);
  });
  activeFenceObservers.add(obs);
  fenceObserverByPre.set(pre, obs);
  obs.observe(code, { childList: true, characterData: true, subtree: true });
  component?.register(() => {
    disconnectFenceWatcher(pre);
  });
}

/** Disconnect fence MutationObservers and pending reapply timers (plugin onunload). */
export function disconnectAllFenceWatchers(): void {
  for (const obs of activeFenceObservers) {
    obs.disconnect();
  }
  activeFenceObservers.clear();
  for (const id of activeFenceTimers) {
    window.clearTimeout(id);
  }
  activeFenceTimers.clear();
  clearCodeFenceScanCache();
}

/**
 * Whether to replace Obsidian's highlighter output with Shiki + Plume line chrome.
 * Safe when `bodyLines` come from the markdown scan (real newlines). Do not rewrite
 * from collapsed `textContent` alone — that was the Reading-view one-line bug.
 */
export function fenceNeedsFeatureRewrite(meta: CodeFenceMeta): boolean {
  if (meta.bodyLines.length > 0) return true;
  if (meta.highlightLines.length > 0) return true;
  if (meta.lineNumbers === true) return true;
  if (meta.collapsedLines != null) return true;
  if (meta.bodyLines.some((line) => CODE_NOTATION_RE.test(line))) return true;
  const lang = meta.language ?? (meta.title ? languageFromFilename(meta.title) : "");
  if (lang === "vue") return true;
  return false;
}

/** Soft-flush skip: avoid full decorate when titles/features are already applied. */
export function sectionNeedsFenceDecorate(
  root: HTMLElement,
  fences: CodeFenceMeta[]
): boolean {
  if (fences.length === 0) return false;
  if (!root.querySelector("pre")) return false;

  const titled = fences.filter((f) => !!f.title);
  if (titled.length > 0) {
    const bars = root.querySelectorAll(".vp-code-block-title, .vp-code-block-title-bar").length;
    if (bars < titled.length) return true;
  }

  const needsRewrite = fences.some(fenceNeedsFeatureRewrite);
  if (!needsRewrite) return titled.length > 0 && !root.querySelector(".vp-code-block-title");

  return !!root.querySelector(`pre:not([${CODE_FEATURES_PROCESSED_ATTR}])`);
}

export interface DecorateCodeFeaturesOptions {
  /**
   * When section-scoped matching fails (e.g. Reading view collapsed newlines),
   * retry against this broader fence list.
   */
  fallbackFences?: CodeFenceMeta[];
}

/**
 * Apply Shiki highlighting + VuePress decorations: `{n}` highlights, `[!code …]`,
 * line numbers, collapse. Unmatched Obsidian fences (no scanned meta) are left alone.
 */
export async function decorateCodeBlockFeatures(
  container: HTMLElement,
  fences: CodeFenceMeta[],
  component?: Component,
  options?: DecorateCodeFeaturesOptions
): Promise<void> {
  const pres = listCodeBlockPres(container);
  if (pres.length === 0) return;

  const used = new Set<CodeFenceMeta>();
  const primaryIndex = buildFenceBodyIndex(fences);
  const fallbackIndex = options?.fallbackFences
    ? buildFenceBodyIndex(options.fallbackFences)
    : null;
  const jobs: Array<Promise<void>> = [];

  for (let idx = 0; idx < pres.length; idx += 1) {
    const pre = pres[idx];
    let meta = findFenceForPreIndexed(pre, primaryIndex, used);
    if (!meta && fallbackIndex) {
      meta = findFenceForPreIndexed(pre, fallbackIndex, used);
    }
    // Positional fallback when fence list is scoped 1:1 with DOM pres
    if (
      !meta
      && fences.length === pres.length
      && idx < fences.length
      && !used.has(fences[idx])
    ) {
      meta = fences[idx];
    }
    if (!meta) {
      // Indented tip bodies become accidental <pre>; never wrap those in fence chrome.
      if (pre.closest(".obsidian-vuepress-prompt-container")) {
        continue;
      }
      // No scanned fence and no Plume meta — do not rewrite Obsidian's DOM.
      continue;
    }
    if (used.has(meta)) continue;
    used.add(meta);

    if (!fenceNeedsFeatureRewrite(meta)) {
      continue;
    }

    const code = pre.querySelector("code");
    if (!(code instanceof HTMLElement)) continue;

    // Skip second decorate pass when Shiki + features are already stable.
    if (
      pre.getAttribute(CODE_FEATURES_PROCESSED_ATTR) === "1"
      && looksAlreadyDecorated(code, meta)
    ) {
      continue;
    }

    const sourceLines =
      meta.bodyLines.length > 0
        ? meta.bodyLines
        : normalizeCodeText(code.textContent ?? "").split("\n");

    writeFenceMetaAttr(pre, meta);
    watchFenceAgainstHighlighter(pre, component);
    jobs.push(
      (async () => {
        await applyFeatureDom(pre, meta, buildDecoratedLines(sourceLines, meta));
        const next = pre.querySelector("code");
        if (isHtmlElement(next) && looksAlreadyDecorated(next, meta)) {
          // One settle check for late Obsidian hljs clobber, then disconnect.
          scheduleFenceReapply(pre, component);
          return;
        }
        scheduleFenceReapply(pre, component);
      })()
    );
  }

  await Promise.all(jobs);
}

function resolveCodeBlockIconFilename(title: string, pre: HTMLElement | null): string {
  const trimmed = title.trim();
  if (trimmed.includes(".")) {
    return trimmed;
  }
  const code = pre?.querySelector("code");
  const langMatch = code?.className.match(/\blanguage-([\w+#-]+)\b/i);
  const lang = langMatch?.[1]?.replace(/[#+].*$/, "");
  if (lang && lang !== "plaintext" && lang !== "text") {
    return `${trimmed || "file"}.${lang}`;
  }
  return trimmed || "file.txt";
}

function applyCodeTitleIcon(
  host: HTMLElement,
  title: string,
  mode: FileTreeIconMode,
  pre?: HTMLElement | null
): void {
  const fileName = resolveCodeBlockIconFilename(title, pre ?? null);
  const desc = resolveNodeIcon(fileName, "file", false, mode);
  host.className = "vp-code-block-title-icon ft-icon";
  if (desc.colorClass) {
    host.classList.add(desc.colorClass);
  }
  host.empty();
  if (desc.iconifyId) {
    prepareIconifyIconElement(host, desc.iconifyId);
    void processIconifyIcons(host);
    return;
  }
  try {
    setIcon(host, desc.icon);
  } catch {
    /* Lucide id may be missing */
  }
}

export function decorateCodeBlockTitles(
  container: HTMLElement,
  fences: CodeFenceMeta[],
  mode: FileTreeIconMode
): void {
  // Unwrap title chrome wrongly attached to code-tree panels
  for (const wrapper of Array.from(
    container.querySelectorAll<HTMLElement>(
      ".vp-code-tree .vp-code-block-title, .obsidian-vuepress-code-tree .vp-code-block-title, .vp-code-tree-panel-content .vp-code-block-title"
    )
  )) {
    const pre = wrapper.querySelector("pre");
    if (!(pre instanceof HTMLElement)) {
      wrapper.remove();
      continue;
    }
    const shell = pre.closest(".vp-code-features") ?? pre;
    wrapper.replaceWith(shell);
    pre.removeAttribute(CODE_TITLE_PROCESSED_ATTR);
  }

  // Drop orphan title bars (title chrome with no real code) — e.g. hello.js above H1
  for (const wrapper of Array.from(
    container.querySelectorAll<HTMLElement>(".vp-code-block-title")
  )) {
    if (wrapper.closest(".vp-code-tree, .obsidian-vuepress-code-tree")) continue;
    const pre = wrapper.querySelector("pre");
    const body = pre ? normalizeCodeText(pre.textContent ?? "").trim() : "";
    if (!(pre instanceof HTMLElement) || !body) {
      if (pre instanceof HTMLElement) {
        const shell = pre.closest(".vp-code-features") ?? pre;
        wrapper.replaceWith(shell);
        pre.removeAttribute(CODE_TITLE_PROCESSED_ATTR);
      } else {
        wrapper.remove();
      }
    }
  }

  const titled = fences.filter((f) => !!f.title);
  const used = new Set<CodeFenceMeta>();
  const titledIndex = buildFenceBodyIndex(titled);
  const pres = listCodeBlockPres(container);

  for (const pre of pres) {
    const meta = findFenceForPreIndexed(pre, titledIndex, used);
    const existing = pre.closest(".vp-code-block-title") as HTMLElement | null;

    if (!meta?.title) {
      if (existing) {
        const shell = pre.closest(".vp-code-features") ?? pre;
        existing.replaceWith(shell);
        pre.removeAttribute(CODE_TITLE_PROCESSED_ATTR);
      }
      continue;
    }

    used.add(meta);

    if (existing) {
      if (existing.dataset.title !== meta.title) {
        updateWrapperTitle(existing, meta.title, mode);
      }
      pre.setAttribute(CODE_TITLE_PROCESSED_ATTR, "1");
      continue;
    }

    if (pre.getAttribute(CODE_TITLE_PROCESSED_ATTR) === "1") {
      continue;
    }

    pre.setAttribute(CODE_TITLE_PROCESSED_ATTR, "1");
    wrapPreWithTitle(pre, meta.title, mode);
  }

  for (const wrapper of Array.from(
    container.querySelectorAll<HTMLElement>(".vp-code-block-title")
  )) {
    const title = wrapper.dataset.title;
    if (!title) continue;
    const pre = wrapper.querySelector("pre");
    const label = wrapper.querySelector(".vp-code-block-title-text");
    if (!label) continue;
    const iconHost = label.querySelector(".vp-code-block-title-icon");
    if (!(iconHost instanceof HTMLElement)) continue;
    const hasSvg =
      iconHost.classList.contains("ft-icon-online") && iconHost.querySelector("svg");
    const hasLucide = iconHost.querySelector("svg");
    if (hasSvg || hasLucide) continue;
    applyCodeTitleIcon(iconHost, title, mode, pre);
  }
}

/** Decorate fenced code titles + Shiki-like features inside a rendered subtree. */
export async function decorateSubtreeCodeFences(
  root: HTMLElement,
  markdown: string,
  mode: FileTreeIconMode,
  component?: Component
): Promise<void> {
  if (!markdown.trim()) {
    return;
  }
  const fences = scanCodeFences(markdown);
  decorateCodeBlockTitles(root, fences, mode);
  await decorateCodeBlockFeatures(root, fences, component);
}

/** Recolor already decorated fences after an Obsidian light/dark or theme change. */
export async function refreshDecoratedCodeFences(root: HTMLElement): Promise<void> {
  const jobs: Array<Promise<void>> = [];
  for (const pre of Array.from(root.querySelectorAll<HTMLElement>("pre[data-vp-fence-meta]"))) {
    const meta = readFenceMeta(pre);
    if (!meta) continue;
    const code = pre.querySelector("code");
    if (!(code instanceof HTMLElement)) continue;

    let sourceLines = meta.bodyLines;
    if (sourceLines.length === 0) {
      // WeakMap empty after reload — prefer structured .line children.
      // Never fall back to flat textContent (Reading-view one-line bug).
      const lineCount = code.querySelectorAll(":scope > .line").length;
      if (lineCount === 0) {
        continue;
      }
      sourceLines = getRenderedCodeLines(code);
      fenceBodyByPre.set(pre, sourceLines);
    }

    jobs.push(applyFeatureDom(pre, meta, buildDecoratedLines(sourceLines, meta)));
  }
  await Promise.all(jobs);
}

function updateWrapperTitle(wrapper: HTMLElement, title: string, mode: FileTreeIconMode): void {
  wrapper.dataset.title = title;
  const label = wrapper.querySelector(".vp-code-block-title-text");
  if (!label) return;
  const pre = wrapper.querySelector("pre");
  while (label.firstChild) label.removeChild(label.firstChild);
  const iconHost = document.createElement("span");
  applyCodeTitleIcon(iconHost, title, mode, pre);
  label.appendChild(iconHost);
  label.appendChild(document.createTextNode(title));
}

function wrapPreWithTitle(pre: HTMLElement, title: string, mode: FileTreeIconMode): void {
  // Prefer wrapping the features shell so title sits above `.vp-code-features > pre`.
  const target =
    pre.parentElement?.classList.contains("vp-code-features")
      ? pre.parentElement
      : pre;
  const parent = target.parentElement;
  if (!parent) return;
  const wrapper = document.createElement("div");
  wrapper.className = "vp-code-block-title";
  wrapper.dataset.title = title;
  const bar = document.createElement("div");
  bar.className = "vp-code-block-title-bar";
  const label = document.createElement("span");
  label.className = "vp-code-block-title-text";
  const iconHost = document.createElement("span");
  applyCodeTitleIcon(iconHost, title, mode, pre);
  label.appendChild(iconHost);
  label.appendChild(document.createTextNode(title));
  bar.appendChild(label);
  parent.insertBefore(wrapper, target);
  wrapper.appendChild(bar);
  wrapper.appendChild(target);
}
