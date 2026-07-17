import { describe, expect, it } from "vitest";
import { decorateCodeBlockFeatures, scanCodeFences } from "./code-fence";

describe("decorateCodeBlockFeatures", () => {
  it("leaves plain fences alone (no Plume meta)", () => {
    const md = ["```yaml", "link-icons: true", "link-icon-size: 16", "```"].join("\n");
    const fences = scanCodeFences(md);

    const root = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-yaml";
    code.textContent = "link-icons: true\nlink-icon-size: 16";
    pre.appendChild(code);
    root.appendChild(pre);

    decorateCodeBlockFeatures(root, fences);

    expect(code.querySelector(".line")).toBeNull();
    expect(code.textContent).toBe("link-icons: true\nlink-icon-size: 16");
    expect(pre.closest(".vp-code-features")).toBeNull();
  });

  it("rewrites from markdown body when highlight meta needs it", () => {
    const md = ["```yaml {1}", "link-icons: true", "link-icon-size: 16", "```"].join("\n");
    const fences = scanCodeFences(md);

    const root = document.createElement("div");
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-yaml";
    code.textContent = "link-icons: truelink-icon-size: 16";
    pre.appendChild(code);
    root.appendChild(pre);

    decorateCodeBlockFeatures(root, fences);

    const lines = Array.from(code.querySelectorAll(":scope > .line")).map(
      (el) => el.textContent
    );
    expect(lines).toEqual(["link-icons: true", "link-icon-size: 16"]);
    expect(code.querySelector(".highlighted")).toBeTruthy();
  });
});
