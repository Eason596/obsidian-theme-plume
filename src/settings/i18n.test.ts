import { describe, expect, it } from "vitest";
import { getSettingsMessages } from "./i18n";

describe("settings translations", () => {
  it("keeps English and Chinese message catalogs complete", () => {
    const english = getSettingsMessages("en");
    const chinese = getSettingsMessages("zh-CN");
    expect(Object.keys(chinese)).toEqual(Object.keys(english));
    expect(Object.values(english).every(Boolean)).toBe(true);
    expect(Object.values(chinese).every(Boolean)).toBe(true);
  });
});
