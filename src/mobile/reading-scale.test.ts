import { describe, expect, it } from "vitest";
import { mobileReadingCss } from "./reading-scale";

describe("mobileReadingCss", () => {
  it("zooms the reading view and keeps the painted column at the screen width", () => {
    const css = mobileReadingCss(1.2, 390);
    expect(css).toContain("zoom: 1.20;");
    expect(css).toContain("--file-line-width: 390px;");
    expect(css).toContain("max-width: 325.00px !important;");
    expect(css).toContain(".markdown-reading-view {");
  });

  it("uses zoom 1 when the scale is not a positive number", () => {
    expect(mobileReadingCss(Number.NaN, 390)).toContain("zoom: 1.00;");
  });
});
