import { Prec, RangeSetBuilder, type Extension } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate
} from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { applyVuepressMarkdownTransforms } from "../render/markdown-transforms";
import { processIconifyIcons } from "../render/iconify-online";

const FENCE_OPEN_RE = /^\s*(`{3,}|~{3,})/;
const INLINE_WIDGET_RE =
  /<Badge\b[^>\n]*(?:\/>|>[^<\n]*<\/Badge>)|::(?:iconify\s+)?[a-z0-9][\w-]*:[a-z0-9][\w.-]*(?:\s+(?:=[^\s:]+|\/[^\s:]+))*::/gi;
const MAX_INLINE_WIDGETS = 512;

export interface InlineWidgetMatch {
  from: number;
  to: number;
  raw: string;
}

interface SelectionRangeLike {
  from: number;
  to: number;
}

function overlapsSelection(
  from: number,
  to: number,
  selections: readonly SelectionRangeLike[]
): boolean {
  return selections.some((selection) => selection.from <= to && selection.to >= from);
}

function isInsideInlineCode(line: string, offset: number): boolean {
  let inside = false;
  let delimiterLength = 0;
  for (let index = 0; index < offset;) {
    if (line[index] !== "`") {
      index += 1;
      continue;
    }
    let end = index + 1;
    while (line[end] === "`") end += 1;
    const length = end - index;
    if (!inside) {
      inside = true;
      delimiterLength = length;
    } else if (length === delimiterLength) {
      inside = false;
      delimiterLength = 0;
    }
    index = end;
  }
  return inside;
}

export function findInlineWidgetMatches(
  markdown: string,
  selections: readonly SelectionRangeLike[] = []
): InlineWidgetMatch[] {
  const matches: InlineWidgetMatch[] = [];
  const lines = markdown.split(/\n/);
  let documentOffset = 0;
  let fenceChar = "";
  let fenceLength = 0;

  for (const line of lines) {
    const fence = line.match(FENCE_OPEN_RE)?.[1] ?? "";
    if (fenceLength > 0) {
      if (fence && fence[0] === fenceChar && fence.length >= fenceLength) {
        fenceChar = "";
        fenceLength = 0;
      }
      documentOffset += line.length + 1;
      continue;
    }
    if (fence) {
      fenceChar = fence[0];
      fenceLength = fence.length;
      documentOffset += line.length + 1;
      continue;
    }

    INLINE_WIDGET_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_WIDGET_RE.exec(line)) !== null) {
      const from = documentOffset + match.index;
      const to = from + match[0].length;
      if (!isInsideInlineCode(line, match.index) && !overlapsSelection(from, to, selections)) {
        matches.push({ from, to, raw: match[0] });
        if (matches.length >= MAX_INLINE_WIDGETS) return matches;
      }
    }
    documentOffset += line.length + 1;
  }
  return matches;
}

class PlumeInlineWidget extends WidgetType {
  constructor(private readonly raw: string) {
    super();
  }

  eq(other: PlumeInlineWidget): boolean {
    return other.raw === this.raw;
  }

  toDOM(): HTMLElement {
    const template = document.createElement("template");
    template.innerHTML = applyVuepressMarkdownTransforms(this.raw);
    const element = template.content.firstElementChild;
    if (!(element instanceof HTMLElement)) {
      const fallback = document.createElement("span");
      fallback.textContent = this.raw;
      return fallback;
    }
    element.classList.add("vp-live-preview-inline-widget");
    if (element.matches("[data-vp-icon]")) void processIconifyIcons(element);
    return element;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function livePreviewEnabled(view: EditorView): boolean {
  try {
    if (view.state.field(editorLivePreviewField, false) === true) return true;
  } catch {
    /* fall through to the DOM mode marker */
  }
  return view.dom.closest(".markdown-source-view")?.classList.contains("is-live-preview") === true;
}

function buildDecorations(view: EditorView): DecorationSet {
  if (!livePreviewEnabled(view)) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  const selections = view.state.selection.ranges.map((range) => ({
    from: range.from,
    to: range.to
  }));
  for (const match of findInlineWidgetMatches(view.state.doc.toString(), selections)) {
    builder.add(match.from, match.to, Decoration.replace({
      widget: new PlumeInlineWidget(match.raw)
    }));
  }
  return builder.finish();
}

const plumeInlineWidgetPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate): void {
      const livePreviewChanged =
        update.startState.field(editorLivePreviewField, false)
        !== update.state.field(editorLivePreviewField, false);
      if (update.docChanged || update.selectionSet || update.viewportChanged || livePreviewChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (value) => value.decorations }
);

// Obsidian installs its own HTML replacement widgets in Live Preview. Plume's
// Badge/Icon widgets must win when both decorate the exact same source range.
export const plumeInlineWidgetsExtension: Extension = Prec.highest(plumeInlineWidgetPlugin);
