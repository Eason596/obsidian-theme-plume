import { describe, expect, it } from "vitest";
import { npmToCodeTabsMarkdown, parseLine } from "./npm-to";

describe("npm-to", () => {
  it("parses npm install -D line", () => {
    const parsed = parseLine("npm install -D vue");
    expect(parsed).toBeTruthy();
    if (!parsed) return;
    expect(parsed.cli).toContain("npm");
  });

  it("expands fence to code-tabs", () => {
    const md = npmToCodeTabsMarkdown(
      "```sh\nnpm install -D vue\n```\n",
      ["npm", "pnpm", "yarn"]
    );
    expect(md).toContain(":::code-tabs#npm-to-npm-pnpm-yarn");
    expect(md).toContain("@tab npm");
    expect(md).toContain("@tab pnpm");
    expect(md).toContain("pnpm add");
    expect(md).toContain("@tab yarn");
    expect(md).toContain("yarn add");
  });

  it("does not emit trailing blank lines inside each tab fence", () => {
    const md = npmToCodeTabsMarkdown(
      "```sh\nnpm install -D vuepress vuepress-theme-plume\n```\n",
      ["npm", "pnpm", "yarn"]
    );
    expect(md).toBeTruthy();
    // One trailing \n before closing ``` is normal; a blank content line (\n\n) is not.
    expect(md).not.toMatch(/```\w*\n[^\n`]+\n\n```/);
    for (const m of md!.matchAll(/```\w*\n([\s\S]*?)\n```/g)) {
      expect(m[1].split("\n")).toEqual([m[1]]);
    }
  });
});
