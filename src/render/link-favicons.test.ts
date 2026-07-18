import { describe, expect, it, vi } from "vitest";
import {
  applyLinkFavicons,
  buildFaviconCandidates,
  faviconLookupHosts,
  readLinkIconOptions,
  readLinkIconOptionsFromText,
  type FaviconRequester
} from "./link-favicons";

describe("faviconLookupHosts", () => {
  it("maps google.cn/chrome to google.com brand hosts", () => {
    const hosts = faviconLookupHosts("www.google.cn", "https://www.google.cn/chrome");
    expect(hosts[0]).toBe("www.google.cn");
    expect(hosts).toContain("www.google.com");
    expect(hosts).toContain("chrome.google.com");
  });
});

describe("buildFaviconCandidates", () => {
  it("orders site-local before Yandex and Google", () => {
    const list = buildFaviconCandidates(
      "https://1remote.github.io/",
      "1remote.github.io",
      20
    );
    const localIdx = list.findIndex((u) => u === "https://1remote.github.io/favicon.ico");
    const yandexIdx = list.findIndex((u) => u.includes("yandex.net"));
    const googleIdx = list.findIndex((u) => u.includes("google.com/s2/favicons"));
    expect(localIdx).toBe(0);
    expect(yandexIdx).toBeGreaterThan(localIdx);
    expect(googleIdx).toBeGreaterThan(yandexIdx);
  });
});

describe("link favicon rendering", () => {
  it("reads options directly from Markdown while MetadataCache is unavailable", () => {
    expect(readLinkIconOptionsFromText([
      "---",
      "link-icons: true",
      "link-icon-size: 20",
      "---",
      "",
      ":::: card-masonry"
    ].join("\n"))).toEqual({ enabled: true, size: 20 });
  });

  it("prefers live Markdown text over MetadataCache", () => {
    const app = {
      metadataCache: {
        getCache: () => ({
          frontmatter: {
            "link-icons": false
          }
        })
      }
    };

    expect(readLinkIconOptions(
      app as never,
      "bookmark_sources.md",
      ["---", "link-icons: true", "link-icon-size: 20", "---", ""].join("\n")
    )).toEqual({ enabled: true, size: 20 });
  });

  it("reads bookmark_sources frontmatter options from cache when text omitted", () => {
    const app = {
      metadataCache: {
        getCache: () => ({
          frontmatter: {
            "link-icons": true,
            "link-icon-size": 20
          }
        })
      }
    };

    expect(readLinkIconOptions(app as never, "bookmark_sources.md")).toEqual({
      enabled: true,
      size: 20
    });
  });

  it("keeps fetched icons in a detached card-masonry staging tree", async () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="vp-card-masonry">
        <div class="vp-card-wrapper">
          <a class="external-link" href="https://detached-staging.example/docs">Docs</a>
        </div>
      </div>`;
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
    const requester = vi.fn(async () => ({
      status: 200,
      headers: { "content-type": "image/png" },
      arrayBuffer: png.buffer,
      json: {},
      text: ""
    })) as unknown as FaviconRequester;

    expect(root.isConnected).toBe(false);
    await applyLinkFavicons(root, { enabled: true, size: 20 }, requester);

    const icon = root.querySelector<HTMLImageElement>("a > .vp-link-favicon");
    expect(requester).toHaveBeenCalled();
    expect(icon?.src).toMatch(/^data:image\/png;base64,/);
    expect(icon?.style.getPropertyValue("--vp-link-favicon-size")).toBe("20px");
  });
});
