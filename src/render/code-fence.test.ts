import { afterEach, describe, expect, it } from "vitest";
import {
  decorateCodeBlockFeatures,
  decorateCodeBlockTitles,
  disconnectAllFenceWatchers,
  scanCodeFences
} from "./code-fence";

afterEach(() => {
  disconnectAllFenceWatchers();
});

describe("decorateCodeBlockFeatures", () => {
  it("leaves unmatched Obsidian fences alone when no fence meta", async () => {
    const root = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-yaml";
    code.textContent = "link-icons: true\nlink-icon-size: 16";
    pre.appendChild(code);
    root.appendChild(pre);

    await decorateCodeBlockFeatures(root, []);

    expect(code.querySelector(".line")).toBeNull();
    expect(code.textContent).toBe("link-icons: true\nlink-icon-size: 16");
    expect(pre.closest(".vp-code-features")).toBeNull();
  });

  it("uses Shiki for title-only fences (markdown body lines)", async () => {
    const md = ['```js title="hello.js"', "const x = 1;", "```"].join("\n");
    const fences = scanCodeFences(md);

    const root = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-js";
    code.textContent = "const x = 1;";
    pre.appendChild(code);
    root.appendChild(pre);

    await decorateCodeBlockFeatures(root, fences);

    expect(code.classList.contains("shiki")).toBe(true);
    expect(code.querySelector(":scope > .line")?.textContent).toBe("const x = 1;");
    expect(code.innerHTML).toMatch(/style="[^"]*color:/);
  }, 30_000);

  it("produces identical Shiki output for Live Preview and Reading view", async () => {
    const md = ["```ts", "const answer: number = 42;", "```"].join("\n");
    const fences = scanCodeFences(md);
    const makeRoot = (): HTMLElement => {
      const root = document.createElement("div");
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.className = "language-ts";
      code.textContent = "const answer: number = 42;";
      pre.appendChild(code);
      root.appendChild(pre);
      return root;
    };
    const livePreview = makeRoot();
    const readingView = makeRoot();

    await Promise.all([
      decorateCodeBlockFeatures(livePreview, fences),
      decorateCodeBlockFeatures(readingView, fences)
    ]);

    expect(livePreview.querySelector("code")?.innerHTML).toBe(
      readingView.querySelector("code")?.innerHTML
    );
    expect(livePreview.querySelector("code")?.classList.contains("shiki")).toBe(true);
  }, 30_000);

  it("rewrites from markdown body when highlight meta needs it", async () => {
    const md = ["```yaml {1}", "link-icons: true", "link-icon-size: 16", "```"].join("\n");
    const fences = scanCodeFences(md);

    const root = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-yaml";
    code.textContent = "link-icons: truelink-icon-size: 16";
    pre.appendChild(code);
    root.appendChild(pre);

    await decorateCodeBlockFeatures(root, fences);

    const lines = Array.from(code.querySelectorAll(":scope > .line")).map(
      (el) => el.textContent
    );
    expect(lines).toEqual(["link-icons: true", "link-icon-size: 16"]);
    expect(code.querySelector(".highlighted")).toBeTruthy();
    expect(code.classList.contains("shiki")).toBe(true);
  }, 30_000);

  it("highlights [!code word:] in text nodes without breaking style attrs", async () => {
    const md = [
      "```js",
      'const color = "blue"; // [!code word:color]',
      "```"
    ].join("\n");
    const fences = scanCodeFences(md);

    const root = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-js";
    code.textContent = 'const color = "blue";';
    pre.appendChild(code);
    root.appendChild(pre);

    await decorateCodeBlockFeatures(root, fences);

    const word = code.querySelector(".highlighted-word");
    expect(word?.textContent).toBe("color");
    // Must not wrap inside style="…color:…" attributes
    expect(code.innerHTML).not.toMatch(/style="[^"]*<span class="highlighted-word">/);
    expect(code.innerHTML).toMatch(/style="[^"]*color:/);
  }, 30_000);
});

describe("decorateCodeBlockTitles", () => {
  it("does not attach document fence titles onto code-tree panel pres", () => {
    const md = [
      '::: code-tree title="Vue App" entry="src/main.ts"',
      '```vue title="src/components/HelloWorld.vue"',
      "<template></template>",
      "```",
      '```ts title="src/main.ts"',
      "export {}",
      "```",
      ":::"
    ].join("\n");
    const fences = scanCodeFences(md);

    const root = document.createElement("div");
    const tree = document.createElement("div");
    tree.className = "vp-code-tree obsidian-vuepress-code-tree";
    const panel = document.createElement("div");
    panel.className = "vp-code-tree-panel-content";
    const pre = document.createElement("pre");
    pre.className = "vp-code-tree-pre";
    const code = document.createElement("code");
    code.className = "language-ts";
    code.textContent = "export {}";
    pre.appendChild(code);
    panel.appendChild(pre);
    tree.appendChild(panel);
    root.appendChild(tree);

    decorateCodeBlockTitles(root, fences, "simple");

    expect(pre.closest(".vp-code-block-title")).toBeNull();
    expect(root.querySelector(".vp-code-block-title")).toBeNull();
  });

  it("removes orphan title bars with no code body", () => {
    const root = document.createElement("div");
    const orphan = document.createElement("div");
    orphan.className = "vp-code-block-title";
    orphan.dataset.title = "hello.js";
    const bar = document.createElement("div");
    bar.className = "vp-code-block-title-bar";
    bar.textContent = "hello.js";
    orphan.appendChild(bar);
    root.appendChild(orphan);

    const h1 = document.createElement("h1");
    h1.textContent = "代码高亮效果预览";
    root.appendChild(h1);

    decorateCodeBlockTitles(root, [], "simple");

    expect(root.querySelector(".vp-code-block-title")).toBeNull();
    expect(root.querySelector("h1")?.textContent).toBe("代码高亮效果预览");
  });
});
