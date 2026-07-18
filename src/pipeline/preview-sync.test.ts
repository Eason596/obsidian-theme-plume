import { describe, expect, it } from "vitest";
import {
  PreviewDocumentSync,
  entersPreviewTarget,
  normalizeMarkdownNewlines
} from "./preview-sync";

describe("normalizeMarkdownNewlines", () => {
  it("treats Windows CRLF vault text as equal to Obsidian LF snapshots", () => {
    const lf = "---\nlink-icons: true\n---\n\n::: card title=\"A\"\nbody\n:::\n";
    const crlf = lf.replace(/\n/g, "\r\n");
    expect(normalizeMarkdownNewlines(crlf)).toBe(lf);
    expect(normalizeMarkdownNewlines(crlf)).toBe(normalizeMarkdownNewlines(lf));
  });
});

describe("preview target transitions", () => {
  it("treats an in-place file switch as entering preview", () => {
    expect(entersPreviewTarget(
      { mode: "preview", sourcePath: "old.md" },
      { mode: "preview", sourcePath: "bookmark_sources.md" }
    )).toBe(true);
  });

  it("does not re-enter an unchanged preview target", () => {
    expect(entersPreviewTarget(
      { mode: "preview", sourcePath: "bookmark_sources.md" },
      { mode: "preview", sourcePath: "bookmark_sources.md" }
    )).toBe(false);
  });
});

describe("PreviewDocumentSync cache bounds", () => {
  it("evicts the least recently used path after 256 files", () => {
    const sync = new PreviewDocumentSync();
    for (let index = 0; index < 257; index += 1) {
      sync.setLiveText(`note-${index}.md`, String(index));
    }

    expect(sync.getLiveText("note-0.md", "missing")).toBe("missing");
    expect(sync.getLiveText("note-256.md", "missing")).toBe("256");
  });

  it("clears all state for a deleted or renamed path", () => {
    const sync = new PreviewDocumentSync();
    sync.markDirty("old.md", "draft");
    sync.rememberScroll("old.md", 12);
    sync.markPreviewSynced("old.md", "draft");

    sync.deleteLive("old.md");

    expect(sync.getLiveText("old.md", "missing")).toBe("missing");
    expect(sync.getRememberedScroll("old.md")).toBeNull();
    expect(sync.isDirty("old.md")).toBe(false);
  });

  it("clearDirtyIfMatches only clears when the live buffer is unchanged", () => {
    const sync = new PreviewDocumentSync();
    sync.markDirty("note.md", "v1");
    sync.clearDirtyIfMatches("note.md", "v1");
    expect(sync.isDirty("note.md")).toBe(false);

    sync.markDirty("note.md", "v1");
    sync.markDirty("note.md", "v2");
    sync.clearDirtyIfMatches("note.md", "v1");
    expect(sync.isDirty("note.md")).toBe(true);
  });
});
