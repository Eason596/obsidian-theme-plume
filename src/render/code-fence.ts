import { setIcon } from "obsidian";
import { resolveNodeIcon } from "../icons";
import type { FileTreeIconMode } from "../types";
import { prepareIconifyIconElement, processIconifyIcons } from "./iconify-online";

export const CODE_TITLE_PROCESSED_ATTR = "data-vp-code-title-done";

export function scanCodeFenceTitles(markdown: string): Array<{ title?: string }> {
  return scanCodeFences(markdown).map((f) => ({ title: f.title }));
}

export function scanCodeFences(
  markdown: string
): Array<{ title?: string; openLine: number; closeLine: number }> {
  const lines = markdown.split(/\r?\n/);
  const result: Array<{ title?: string; openLine: number; closeLine: number }> = [];
  let fenceChar = "";
  let fenceLen = 0;
  let openLine = -1;
  let currentTitle: string | undefined;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (fenceLen > 0) {
      const closeRe = new RegExp(`^\\s*${fenceChar}{${fenceLen},}\\s*$`);
      if (closeRe.test(line)) {
        result.push({ title: currentTitle, openLine, closeLine: i });
        fenceChar = "";
        fenceLen = 0;
        openLine = -1;
        currentTitle = undefined;
      }
      continue;
    }
    const open = line.match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!open) continue;
    fenceChar = open[2][0];
    fenceLen = open[2].length;
    openLine = i;
    const info = open[3] ?? "";
    const tm = info.match(/\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/);
    currentTitle = tm ? (tm[1] ?? tm[2] ?? tm[3]) : undefined;
  }
  if (fenceLen > 0 && openLine >= 0) {
    result.push({ title: currentTitle, openLine, closeLine: lines.length - 1 });
  }
  return result;
}

function listCodeBlockPres(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("pre")).filter((pre) => {
    const first = pre.firstElementChild;
    return first != null && first.tagName === "CODE";
  });
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
    const existing = pre.parentElement?.classList.contains("vp-code-block-title")
      ? (pre.parentElement as HTMLElement)
      : null;

    if (existing) {
      if (!newTitle) {
        existing.replaceWith(pre);
        pre.removeAttribute(CODE_TITLE_PROCESSED_ATTR);
        continue;
      }
      if (existing.dataset.title !== newTitle) {
        updateWrapperTitle(existing, newTitle, mode);
      }
      continue;
    }

    if (!newTitle) {
      pre.removeAttribute(CODE_TITLE_PROCESSED_ATTR);
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

/** Decorate any fenced code with titles inside a rendered subtree (e.g. after nested blocks). */
export function decorateSubtreeCodeFences(
  root: HTMLElement,
  markdown: string,
  mode: FileTreeIconMode
): void {
  if (!markdown.trim()) {
    return;
  }
  decorateCodeBlockTitles(root, scanCodeFenceTitles(markdown), mode);
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
  const parent = pre.parentElement;
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
  parent.insertBefore(wrapper, pre);
  wrapper.appendChild(bar);
  wrapper.appendChild(pre);
}
