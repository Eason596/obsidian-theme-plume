import { describe, expect, it } from "vitest";
import { sectionHasPlumeContainers } from "./markdown-transforms";

describe("sectionHasPlumeContainers", () => {
  it("detects card sections that also contain Badge / Iconify", () => {
    const md = [
      '::: card title="卡片内 Badge" icon="mdi:card"',
      '卡片正文 <Badge type="info" text="info" /> 与 ::iconify twemoji:1f389::',
      ":::"
    ].join("\n");
    expect(sectionHasPlumeContainers(md)).toBe(true);
  });

  it("allows plain Badge paragraphs without containers", () => {
    expect(sectionHasPlumeContainers(
      '段落里：<Badge type="tip" text="tip" /> ::iconify mdi:github::'
    )).toBe(false);
  });
});
