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
});
