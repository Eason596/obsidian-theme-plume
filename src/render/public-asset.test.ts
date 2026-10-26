import { describe, expect, it } from "vitest";
import { vaultPathForPublicAsset } from "./public-asset";

describe("vaultPathForPublicAsset", () => {
  it("maps /images and /assets onto vault-root paths", () => {
    expect(vaultPathForPublicAsset("/images/demo.png")).toBe("images/demo.png");
    expect(vaultPathForPublicAsset("/assets/files/a.pdf")).toBe("assets/files/a.pdf");
  });

  it("decodes spaces and Chinese characters", () => {
    expect(vaultPathForPublicAsset("/images/my%20demo.png")).toBe("images/my demo.png");
    expect(vaultPathForPublicAsset("/images/%E7%A4%BA%E4%BE%8B.png")).toBe("images/示例.png");
  });

  it("rejects relative paths, external urls, traversal, and other prefixes", () => {
    expect(vaultPathForPublicAsset("../assets/images/demo.png")).toBeNull();
    expect(vaultPathForPublicAsset("images/demo.png")).toBeNull();
    expect(vaultPathForPublicAsset("https://example.com/images/demo.png")).toBeNull();
    expect(vaultPathForPublicAsset("/images/../demo.png")).toBeNull();
    expect(vaultPathForPublicAsset("/files/demo.png")).toBeNull();
    expect(vaultPathForPublicAsset("/images/demo.png?raw=1")).toBeNull();
  });
});
