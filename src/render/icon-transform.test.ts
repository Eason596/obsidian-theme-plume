import { describe, expect, it } from "vitest";
import { replaceIconSyntaxInMarkdown } from "./icon-transform";

describe("icon transform", () => {
  it("renders VuePress iconify inline syntax", () => {
    const html = replaceIconSyntaxInMarkdown("before ::mdi:home:: after");
    expect(html).toContain("vp-icon");
    expect(html).toContain('data-vp-icon="mdi:home"');
    expect(html).toContain("ft-icon-online");
  });

  it("renders size and color options", () => {
    const html = replaceIconSyntaxInMarkdown("::mdi:home =24px /#f00::");
    expect(html).toContain("font-size:24px");
    expect(html).toContain("color:#f00");
  });

  it("renders Icon and VPIcon component tags", () => {
    const html = replaceIconSyntaxInMarkdown(
      '<Icon name="mdi:home" /> <VPIcon provider="iconify" name="mdi:account"></VPIcon>'
    );
    expect(html).toContain('data-vp-icon="mdi:home"');
    expect(html).toContain('data-vp-icon="mdi:account"');
  });

  it("does not replace inside fenced code blocks", () => {
    const md = "```md\n::mdi:home::\n```";
    expect(replaceIconSyntaxInMarkdown(md)).toBe(md);
  });
});
