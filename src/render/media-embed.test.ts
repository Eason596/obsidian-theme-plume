import { describe, expect, it } from "vitest";
import {
  buildBilibiliSrc,
  buildPdfSrc,
  buildYoutubeSrc,
  extractYoutubeId,
  parseBilibiliEmbed,
  parsePdfEmbed,
  parseYoutubeEmbed,
  timeToSeconds
} from "./media-embed";

describe("media-embed", () => {
  it("parses pdf attrs", () => {
    const attrs = parsePdfEmbed('2 no-toolbar height="500px"', "/docs/a.pdf");
    expect(attrs.page).toBe(2);
    expect(attrs.noToolbar).toBe(true);
    expect(attrs.height).toBe("500px");
    expect(buildPdfSrc("https://x.test/a.pdf", attrs)).toContain("page=2");
    expect(buildPdfSrc("https://x.test/a.pdf", attrs)).toContain("toolbar=0");
  });

  it("parses bilibili BV", () => {
    const attrs = parseBilibiliEmbed("p2", "BV1EZ42187Hg");
    expect(attrs.bvid).toBe("BV1EZ42187Hg");
    expect(attrs.page).toBe(2);
    expect(buildBilibiliSrc(attrs)).toContain("bvid=BV1EZ42187Hg");
    expect(buildBilibiliSrc(attrs)).toContain("p=2");
  });

  it("parses youtube id and urls", () => {
    expect(extractYoutubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ"
    );
    expect(extractYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    const attrs = parseYoutubeEmbed('start="1:30" autoplay', "dQw4w9WgXcQ");
    expect(attrs.start).toBe(90);
    expect(attrs.autoplay).toBe(true);
    expect(buildYoutubeSrc(attrs)).toContain("/embed/dQw4w9WgXcQ");
    expect(buildYoutubeSrc(attrs)).toContain("start=90");
  });

  it("parses time strings", () => {
    expect(timeToSeconds("90")).toBe(90);
    expect(timeToSeconds("1:30")).toBe(90);
    expect(timeToSeconds("1:02:03")).toBe(3723);
  });
});
