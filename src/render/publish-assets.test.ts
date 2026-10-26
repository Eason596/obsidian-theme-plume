import { describe, expect, it } from "vitest";
import path from "node:path";
import { isSharedAssetPath, publicFilePath } from "./publish-assets";

describe("publish shared assets", () => {
  it("copies images and assets onto the same public path", () => {
    expect(isSharedAssetPath("images/demo.png")).toBe(true);
    expect(isSharedAssetPath("assets/files/a.pdf")).toBe(true);
    expect(isSharedAssetPath("Notes/images/demo.png")).toBe(false);
    expect(publicFilePath("/site/public", "images/demo.png")).toBe(
      path.join("/site/public", "images", "demo.png")
    );
  });
});
