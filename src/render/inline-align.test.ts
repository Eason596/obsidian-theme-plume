import { describe, expect, it } from "vitest";
import { applyInlineAlignSyntax } from "./inline-align";

describe("applyInlineAlignSyntax", () => {
  it("renders sub, sup, and footnotes outside code", () => {
    const markdown = [
      "水是 H~2~O，平方是 x^2^。参见[^note]。",
      "",
      "保持 ~~删除线~~ 和 `H~2~O`。",
      "",
      "[^note]: 脚注正文。",
      ""
    ].join("\n");
    const out = applyInlineAlignSyntax(markdown);
    expect(out).toContain("H<sub>2</sub>O");
    expect(out).toContain("x<sup>2</sup>");
    expect(out).toContain("~~删除线~~");
    expect(out).toContain("`H~2~O`");
    expect(out).toContain('href="#fn-note"');
    expect(out).toContain("脚注正文。");
    expect(out).not.toContain("[^note]");
  });

  it("does not rewrite fenced code", () => {
    const markdown = ["```ts", "const x = H~2~O;", "[^note]: no", "```"].join("\n");
    expect(applyInlineAlignSyntax(markdown)).toBe(markdown);
  });

  it("renders annotations and abbreviations from the same note", () => {
    const markdown = ["术语 [+api]。HTML 是标记语言。", "", "[+api]: 应用程序接口", "", "*[HTML]: 超文本标记语言"].join("\n");
    const out = applyInlineAlignSyntax(markdown);
    expect(out).toContain('class="vp-annotation"');
    expect(out).toContain("应用程序接口");
    expect(out).toContain("<abbr");
    expect(out).toContain("超文本标记语言");
    expect(out).not.toContain("[+api]:");
    expect(out).not.toContain("*[HTML]:");
  });

  it("applies {.class} only when attribute syntax is enabled", () => {
    const markdown = "提示词{.tip}";
    expect(applyInlineAlignSyntax(markdown)).toBe(markdown);
    expect(applyInlineAlignSyntax(markdown, markdown, { attrs: true })).toContain('class="tip"');
  });

  it("numbers footnotes from the full note when a section is transformed alone", () => {
    const documentText = "先看[^a]。\n\n然后[^b]。\n\n[^a]: A\n\n[^b]: B\n";
    const section = "然后[^b]。";
    const out = applyInlineAlignSyntax(section, documentText);
    expect(out).toContain(">2</a>");
    expect(out).not.toContain(">1</a>");
  });
});
