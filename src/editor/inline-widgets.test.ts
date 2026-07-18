import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { findInlineWidgetMatches, plumeInlineWidgetsExtension } from "./inline-widgets";

describe("Live Preview inline widgets", () => {
  it("finds Badge and Iconify syntax outside fenced code", () => {
    const markdown = [
      '<Badge type="tip" text="tip" /> ::iconify mdi:github::',
      "```md",
      '<Badge type="danger" text="source" />',
      "```"
    ].join("\n");
    expect(findInlineWidgetMatches(markdown).map((match) => match.raw)).toEqual([
      '<Badge type="tip" text="tip" />',
      "::iconify mdi:github::"
    ]);
  });

  it("reveals source while the selection touches a widget", () => {
    const markdown = 'x <Badge type="tip" text="tip" /> y';
    const badgeStart = markdown.indexOf("<Badge");
    expect(findInlineWidgetMatches(markdown, [{ from: badgeStart + 2, to: badgeStart + 2 }]))
      .toHaveLength(0);
  });

  it("installs a real CodeMirror replacement widget", () => {
    const parent = document.createElement("div");
    parent.className = "markdown-source-view is-live-preview";
    document.body.appendChild(parent);
    const source = 'prefix <Badge type="danger" text="danger" /> suffix';
    const view = new EditorView({
      parent,
      state: EditorState.create({
        doc: source,
        extensions: [editorLivePreviewField, plumeInlineWidgetsExtension]
      })
    });

    expect(view.dom.querySelector(".vp-badge.danger")?.textContent).toBe("danger");
    view.destroy();
    parent.remove();
  });
});
