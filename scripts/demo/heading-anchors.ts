import GithubSlugger from "github-slugger";

const slugger = new GithubSlugger();

/** GitHub-style slug from a markdown heading line (without leading ##). */
export function slugifyHeadingText(headingText: string): string {
  slugger.reset();
  const plain = headingText
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return slugger.slug(plain);
}

/** Insert `<a id="...">` before each `##` section heading (skips `## 目录`). */
export function injectHeadingAnchors(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{2,6})\s+(.+)$/);
    if (!match) {
      out.push(line);
      continue;
    }
    const level = match[1].length;
    const text = match[2];
    if (level === 2 && text.trim() === "目录") {
      out.push(line);
      continue;
    }
    const id = slugifyHeadingText(text);
    if (id) {
      out.push(`<a id="${id}"></a>`);
    }
    out.push(line);
  }

  return out.join("\n");
}

/** Ensure every h1–h6 in the demo page has an id (for TOC / hash navigation). */
export function assignHeadingIds(root: HTMLElement): void {
  const sluggerLocal = new GithubSlugger();
  for (const heading of Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
    if (!(heading instanceof HTMLElement)) {
      continue;
    }
    if (heading.id) {
      sluggerLocal.slug(heading.id);
      continue;
    }
    const text = heading.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!text) {
      continue;
    }
    heading.id = sluggerLocal.slug(text);
  }
}

/** Fix `1. [text](#1-foo)` → `href="##1-foo"` from marked ordered-list parsing. */
export function fixTocHashLinks(root: HTMLElement): void {
  for (const anchor of Array.from(root.querySelectorAll('a[href^="#"]'))) {
    if (anchor.tagName !== "A") {
      continue;
    }
    const href = anchor.getAttribute("href");
    if (!href || !href.startsWith("#")) {
      continue;
    }
    let fragment = href.slice(1);
    while (fragment.startsWith("#")) {
      fragment = fragment.slice(1);
    }
    if (fragment !== href.slice(1)) {
      anchor.setAttribute("href", `#${fragment}`);
    }
  }
}
