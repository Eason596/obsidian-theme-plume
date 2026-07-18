import { describe, expect, it } from "vitest";
import { sanitizeIconifySvg } from "./iconify-online";

describe("sanitizeIconifySvg", () => {
  it("keeps ordinary Iconify geometry", () => {
    const svg = sanitizeIconifySvg(
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M0 0h1v1z"/></svg>'
    );
    expect(svg?.querySelector("path")?.getAttribute("d")).toBe("M0 0h1v1z");
  });

  it("removes scripts, event handlers and external references", () => {
    const svg = sanitizeIconifySvg(
      '<svg onload="alert(1)"><script>alert(1)</script><foreignObject/><use href="https://evil.test/x"/><path style="fill:url(https://evil.test/x)"/></svg>'
    );
    expect(svg?.querySelector("script, foreignObject")).toBeNull();
    expect(svg?.hasAttribute("onload")).toBe(false);
    expect(svg?.querySelector("use")?.hasAttribute("href")).toBe(false);
    expect(svg?.querySelector("path")?.hasAttribute("style")).toBe(false);
  });
});
