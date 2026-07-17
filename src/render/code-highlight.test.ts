import { describe, expect, it } from "vitest";
import {
  highlightSourceLines,
  languageFromFilename,
  listRegisteredLanguages,
  normalizeFenceLang
} from "./code-highlight";

describe("code-highlight (Shiki)", () => {
  it("maps .vue extension", () => {
    expect(languageFromFilename("HelloWorld.vue")).toBe("vue");
    expect(normalizeFenceLang("vue")).toBe("vue");
  });

  it("highlights vue SFC with Shiki tokens", async () => {
    const source = [
      "<template>",
      "  <h1>{{ msg }}</h1>",
      "</template>",
      "",
      '<script setup lang="ts">',
      "const msg = 'hi'",
      "</script>"
    ].join("\n");

    const lines = await highlightSourceLines("vue", source);
    expect(lines.length).toBeGreaterThan(3);
    const joined = lines.join("\n");
    // Shiki emits inline color styles
    expect(joined).toMatch(/style="[^"]*color:/);
    expect(joined).toContain("template");
  }, 30_000);

  it("lists bundled Shiki themes for settings", async () => {
    const { listBundledShikiThemes, configureShikiThemes, highlightSourceLines } =
      await import("./code-highlight");
    const themes = listBundledShikiThemes();
    expect(themes.length).toBeGreaterThan(50);
    expect(themes).toContain("vitesse-light");
    expect(themes).toContain("nord");

    configureShikiThemes("nord", "dracula");
    document.body.classList.add("theme-dark");
    const lines = await highlightSourceLines("js", "const x = 1;");
    document.body.classList.remove("theme-dark");
    expect(lines.join("")).toMatch(/style="[^"]*color:/);
  }, 30_000);
});
