import { describe, expect, it } from "vitest";
import {
  classifyLinkHref,
  safeExternalRel,
  safeHttpUrl,
  safeImageUrl,
  safeResourceUrl
} from "./safe-url";

describe("safe-url", () => {
  it("allows notes and ordinary external links", () => {
    expect(classifyLinkHref("docs/start").kind).toBe("internal");
    expect(safeHttpUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHttpUrl("//example.com/a")).toBe("https://example.com/a");
  });

  it("rejects active-content protocols", () => {
    expect(classifyLinkHref("javascript:alert(1)").kind).toBe("unsafe");
    expect(safeResourceUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeImageUrl("data:image/svg+xml,<svg onload=alert(1) />")).toBeNull();
  });

  it("forces opener protection on blank targets", () => {
    expect(safeExternalRel("nofollow", "_blank").split(" ")).toEqual(
      expect.arrayContaining(["nofollow", "noopener", "noreferrer"])
    );
  });
});
