import { describe, expect, it } from "vitest";
import { appendRenderSentinel, hasRenderSentinel } from "./render-sentinel";

describe("render sentinel", () => {
  it("detects when Obsidian replaced the rendered block children", () => {
    const root = document.createElement("div");
    root.dataset.plumeBlockKey = "same-key";
    appendRenderSentinel(root);
    expect(hasRenderSentinel(root)).toBe(true);

    root.replaceChildren(document.createTextNode(":::: card-masonry"));
    expect(root.dataset.plumeBlockKey).toBe("same-key");
    expect(hasRenderSentinel(root)).toBe(false);
  });
});
