/**
 * ::: table container helpers — VuePress Theme Plume VPTable parity.
 */

import type { TableContainerAttrs } from "../types";

export type { TableContainerAttrs };

export function parseTableAttrs(rest: string): TableContainerAttrs {
  const attrs: TableContainerAttrs = {};
  const title = parseAttr(rest, "title");
  if (title) attrs.title = title;

  const align = parseAttr(rest, "align");
  if (align === "left" || align === "center" || align === "right") {
    attrs.align = align;
  }

  if (/(^|\s)copy(\s|$|=)/i.test(rest)) {
    const copyVal = parseAttr(rest, "copy");
    if (copyVal === undefined || copyVal === "" || copyVal === "true") {
      attrs.copy = "all";
    } else if (copyVal === "false") {
      attrs.copy = false;
    } else if (copyVal === "all" || copyVal === "html" || copyVal === "md") {
      attrs.copy = copyVal;
    } else {
      attrs.copy = "all";
    }
  } else {
    attrs.copy = "all";
  }

  if (/(^|\s)max-content(\s|$|=)/i.test(rest)) {
    const v = parseAttr(rest, "max-content");
    attrs.maxContent = v ? v !== "false" : true;
  }
  if (/(^|\s)full-width(\s|$|=)/i.test(rest)) {
    const v = parseAttr(rest, "full-width");
    attrs.fullWidth = v ? v !== "false" : true;
  }

  const hlRows = parseAttr(rest, "hl-rows") ?? parseAttr(rest, "hlRows");
  if (hlRows) attrs.hlRows = hlRows;
  const hlCols = parseAttr(rest, "hl-cols") ?? parseAttr(rest, "hlCols");
  if (hlCols) attrs.hlCols = hlCols;
  const hlCells = parseAttr(rest, "hl-cells") ?? parseAttr(rest, "hlCells");
  if (hlCells) attrs.hlCells = hlCells;

  return attrs;
}

function parseAttr(text: string, key: string): string | undefined {
  const attrRegex = new RegExp(`${key}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, "i");
  const match = text.match(attrRegex);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3] ?? undefined;
}

function parseHl(hl: string): Record<number, string> {
  const res: Record<number, string> = {};
  if (!hl) return res;
  hl.split(";").forEach((item) => {
    const [key, value = "1"] = item.split(":");
    String(value)
      .split(",")
      .forEach((v) => {
        const n = Number.parseInt(v.trim(), 10);
        if (!Number.isNaN(n)) res[n] = key.trim();
      });
  });
  return res;
}

function parseHlCells(hl: string): Record<number, Record<number, string>> {
  const res: Record<number, Record<number, string>> = {};
  if (!hl) return res;
  hl.split(";").forEach((item) => {
    const [key, value = ""] = item.split(":");
    value.trim().replace(/\s*\((\d+)\s*,\s*(\d+)\)\s*/g, (_, row, col) => {
      const r = Number.parseInt(row, 10);
      const c = Number.parseInt(col, 10);
      res[r] ??= {};
      res[r][c] = key.trim();
      return "";
    });
  });
  return res;
}

/** Apply hl-rows / hl-cols / hl-cells classes onto a rendered <table>. */
export function applyTableHighlights(table: HTMLTableElement, attrs: TableContainerAttrs): void {
  const rows = parseHl(attrs.hlRows ?? "");
  const cols = parseHl(attrs.hlCols ?? "");
  const cells = parseHlCells(attrs.hlCells ?? "");
  if (!Object.keys(rows).length && !Object.keys(cols).length && !Object.keys(cells).length) {
    return;
  }

  let rowIndex = 0;
  for (const tr of Array.from(table.querySelectorAll("tr"))) {
    rowIndex += 1;
    let colIndex = 0;
    for (const cell of Array.from(tr.children)) {
      if (!(cell instanceof HTMLTableCellElement)) continue;
      const span = cell.colSpan > 1 ? cell.colSpan : 1;
      for (let s = 0; s < span; s++) {
        colIndex += 1;
        if (s > 0) continue;
        const cls = cells[rowIndex]?.[colIndex] || rows[rowIndex] || cols[colIndex];
        if (cls) cell.classList.add(cls);
      }
    }
  }
}

export function normalizeTableCopy(
  copy: TableContainerAttrs["copy"]
): false | "all" | "html" | "md" {
  if (copy === false) return false;
  if (copy === "html" || copy === "md" || copy === "all") return copy;
  return "all";
}
