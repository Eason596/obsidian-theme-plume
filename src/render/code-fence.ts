import { setIcon } from "obsidian";
import { resolveNodeIcon } from "../icons";
import type { FileTreeIconMode } from "../types";
import {
  highlightSourceLines,
  resolveCodeLanguage
} from "./code-highlight";
import { prepareIconifyIconElement, processIconifyIcons } from "./iconify-online";

export const CODE_TITLE_PROCESSED_ATTR = "data-vp-code-title-done";
export const CODE_FEATURES_PROCESSED_ATTR = "data-vp-code-features-done";

export interface CodeFenceMeta {
  title?: string;
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

  return { title, highlightLines, lineNumbers, lineNumbersStart, collapsedLines };
}

export function scanCodeFenceTitles(markdown: string): Array<{ title?: string }> {
  return scanCodeFences(markdown).map((f) => ({ title: f.title }));
}

export function scanCodeFences(markdown: string): CodeFenceMeta[] {
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

/** Match a rendered code block to fence meta by comparing stripped body lines. */
function findFenceForPre(pre: HTMLElement, fences: CodeFenceMeta[]): CodeFenceMeta | undefined {
  const code = pre.querySelector("code");
  if (!(code instanceof HTMLElement)) return undefined;
  const rendered = normalizeCodeText(code.textContent ?? "");
  const renderedLines = rendered.split("\n").map(stripNotationFromLine);

  let best: CodeFenceMeta | undefined;
  let bestScore = -1;

  for (const fence of fences) {
    const body = fence.bodyLines.map(stripNotationFromLine);
    if (body.length === 0 && renderedLines.length === 0) {
      return fence;
    }
    if (body.length === 0) continue;

    // Exact match on stripped lines
    if (body.length === renderedLines.length && body.every((l, i) => l === renderedLines[i])) {
      return fence;
    }

    // Soft match: same length and majority equal
    if (body.length === renderedLines.length) {
      let eq = 0;
      for (let i = 0; i < body.length; i += 1) {
        if (body[i] === renderedLines[i]) eq += 1;
      }
      if (eq > bestScore) {
        bestScore = eq;
        best = fence;
      }
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

function applyWordHighlightHtml(lineHtml: string, word: string | undefined): string {
  if (!word) return lineHtml;
  const needle = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return lineHtml.replace(new RegExp(needle, "g"), (m) => {
      return `<span class="highlighted-word">${m}</span>`;
    });
  } catch {
    return lineHtml;
  }
}

function applyFeatureDom(pre: HTMLElement, meta: CodeFenceMeta, decorated: LineDecoration[]): void {
  const code = pre.querySelector("code");
  if (!(code instanceof HTMLElement)) return;

  const lang = resolveCodeLanguage(code, pre);
  const cleanedSource = decorated.map((d) => d.text).join("\n");
  const hlLines = highlightSourceLines(lang, cleanedSource);

  const hasFocus = decorated.some((d) => d.classes.includes("focused"));
  const hasLineDecor =
    decorated.some(
      (d) =>
        d.classes.includes("highlighted")
        || d.classes.includes("diff")
        || d.classes.includes("focused")
        || d.word
    ) || meta.highlightLines.length > 0;

  // Pad / trim hl lines to match decorated line count
  while (hlLines.length < decorated.length) hlLines.push("");
  if (hlLines.length > decorated.length) {
    hlLines.length = decorated.length;
  }

  // Join without raw newlines — `.line` is block-level (avoids inline-block whitespace drift)
  const html = decorated
    .map((d, i) => {
      const cls = d.classes.join(" ");
      const inner = applyWordHighlightHtml(hlLines[i] ?? escapeHtml(d.text), d.word);
      return `<span class="${cls}">${inner || "\u200b"}</span>`;
    })
    .join("");

  pre.dataset.vpCodeWriting = "1";
  code.classList.add("hljs", `language-${lang}`);
  code.innerHTML = html;
  pre.setAttribute(CODE_FEATURES_PROCESSED_ATTR, "1");
  delete pre.dataset.vpCodeWriting;

  // Always wrap for highlight chrome (line numbers / collapse / hljs tokens)
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
  if (!code.classList.contains("hljs")) return false;
  if (meta.highlightLines.length > 0 && !code.querySelector(".highlighted")) return false;
  if (meta.bodyLines.some((l) => /\[!code\s+(?:\+\+|--)/.test(l)) && !code.querySelector(".diff")) {
    return false;
  }
  if (meta.bodyLines.some((l) => /\[!code\s+focus/.test(l)) && !code.querySelector(".focused")) {
    return false;
  }
  return true;
}

function scheduleFenceReapply(pre: HTMLElement): void {
  const raw = pre.dataset.vpFenceMeta;
  if (!raw) return;
  let meta: CodeFenceMeta;
  try {
    meta = JSON.parse(raw) as CodeFenceMeta;
  } catch {
    return;
  }
  const run = (): void => {
    if (!pre.isConnected) return;
    const code = pre.querySelector("code");
    if (!(code instanceof HTMLElement)) return;
    if (!looksAlreadyDecorated(code, meta)) {
      const sourceLines =
        meta.bodyLines.length > 0
          ? meta.bodyLines
          : normalizeCodeText(code.textContent ?? "").split("\n");
      applyFeatureDom(pre, meta, buildDecoratedLines(sourceLines, meta));
    }
  };
  window.requestAnimationFrame(() => {
    run();
    window.setTimeout(run, 0);
    window.setTimeout(run, 50);
    window.setTimeout(run, 200);
    window.setTimeout(run, 500);
  });
}

function watchFenceAgainstHighlighter(pre: HTMLElement): void {
  if (pre.dataset.vpFenceWatch === "1") return;
  pre.dataset.vpFenceWatch = "1";
  const code = pre.querySelector("code");
  if (!(code instanceof HTMLElement)) return;

  const obs = new MutationObserver(() => {
    if (pre.dataset.vpCodeWriting === "1") return;
    scheduleFenceReapply(pre);
  });
  obs.observe(code, { childList: true, characterData: true, subtree: true });
}

/**
 * Apply VuePress/Shiki-like decorations: `{n}` highlights, `[!code …]`, line numbers, collapse.
 * Re-applies after Obsidian's async syntax highlighter rewrites `<code>` contents.
 */
export function decorateCodeBlockFeatures(
  container: HTMLElement,
  fences: CodeFenceMeta[]
): void {
  const pres = listCodeBlockPres(container);
  if (pres.length === 0) return;

  const used = new Set<CodeFenceMeta>();

  for (const pre of pres) {
    let meta = findFenceForPre(pre, fences);
    // Index fallback when content match fails (e.g. empty / mismatched highlighter output)
    if (!meta) {
      const idx = pres.indexOf(pre);
      if (idx >= 0 && idx < fences.length && !used.has(fences[idx])) {
        meta = fences[idx];
      }
    }
    if (!meta) {
      // Indented tip bodies become accidental <pre>; never wrap those in fence chrome.
      if (pre.closest(".obsidian-vuepress-prompt-container")) {
        continue;
      }
      const codeEl = pre.querySelector("code");
      if (!(codeEl instanceof HTMLElement)) continue;
      meta = {
        highlightLines: [],
        lineNumbers: null,
        lineNumbersStart: 1,
        collapsedLines: null,
        openLine: -1,
        closeLine: -1,
        bodyLines: normalizeCodeText(codeEl.textContent ?? "").split("\n")
      };
    }
    if (used.has(meta)) continue;
    used.add(meta);

    const code = pre.querySelector("code");
    if (!(code instanceof HTMLElement)) continue;

    const sourceLines =
      meta.bodyLines.length > 0
        ? meta.bodyLines
        : normalizeCodeText(code.textContent ?? "").split("\n");

    pre.dataset.vpFenceMeta = JSON.stringify({
      title: meta.title,
      highlightLines: meta.highlightLines,
      lineNumbers: meta.lineNumbers,
      lineNumbersStart: meta.lineNumbersStart,
      collapsedLines: meta.collapsedLines,
      openLine: meta.openLine,
      closeLine: meta.closeLine,
      bodyLines: meta.bodyLines
    } satisfies CodeFenceMeta);

    applyFeatureDom(pre, meta, buildDecoratedLines(sourceLines, meta));
    watchFenceAgainstHighlighter(pre);
    scheduleFenceReapply(pre);
  }
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
  fences: Array<{ title?: string }>,
  mode: FileTreeIconMode
): void {
  const pres = listCodeBlockPres(container);
  let preIndex = 0;

  for (let fi = 0; fi < fences.length; fi += 1) {
    const newTitle = fences[fi].title;
    if (preIndex >= pres.length) {
      break;
    }
    const pre = pres[preIndex];
    preIndex += 1;
    // After features wrap, parent is `.vp-code-features` — use closest so we
    // don't insert a second title bar on nested re-decorate (e.g. ::: window).
    const existing = pre.closest(".vp-code-block-title") as HTMLElement | null;

    if (existing) {
      if (!newTitle) {
        const shell = pre.closest(".vp-code-features") ?? pre;
        existing.replaceWith(shell);
        pre.removeAttribute(CODE_TITLE_PROCESSED_ATTR);
        continue;
      }
      if (existing.dataset.title !== newTitle) {
        updateWrapperTitle(existing, newTitle, mode);
      }
      pre.setAttribute(CODE_TITLE_PROCESSED_ATTR, "1");
      continue;
    }

    if (!newTitle) {
      pre.removeAttribute(CODE_TITLE_PROCESSED_ATTR);
      continue;
    }

    if (pre.getAttribute(CODE_TITLE_PROCESSED_ATTR) === "1") {
      continue;
    }

    pre.setAttribute(CODE_TITLE_PROCESSED_ATTR, "1");
    wrapPreWithTitle(pre, newTitle, mode);
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
export function decorateSubtreeCodeFences(
  root: HTMLElement,
  markdown: string,
  mode: FileTreeIconMode
): void {
  if (!markdown.trim()) {
    return;
  }
  const fences = scanCodeFences(markdown);
  decorateCodeBlockTitles(root, fences, mode);
  decorateCodeBlockFeatures(root, fences);
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
