/**
 * QR container attr parsing — kept free of the `qrcode` package so the parser
 * path does not pull ~135KB into every note open.
 */

import type { QrcodeContainerAttrs } from "../types";
import { safeHttpUrl } from "../utils/safe-url";

export function parseQrcodeAttrs(rest: string): QrcodeContainerAttrs {
  const attrs: QrcodeContainerAttrs = {};
  const title = parseAttr(rest, "title");
  if (title) attrs.title = title;

  const align = parseAttr(rest, "align");
  if (align === "left" || align === "center" || align === "right") {
    attrs.align = align;
  }

  const mode = parseAttr(rest, "mode");
  if (mode === "img" || mode === "card") {
    attrs.mode = mode;
  } else if (/(^|\s)card(\s|$|=)/i.test(rest)) {
    const cardVal = parseAttr(rest, "card");
    if (cardVal === undefined || cardVal === "" || cardVal !== "false") {
      attrs.mode = "card";
    }
  }

  if (/(^|\s)reverse(\s|$|=)/i.test(rest)) {
    const v = parseAttr(rest, "reverse");
    attrs.reverse = v ? v !== "false" : true;
  }

  const width = parseAttr(rest, "width");
  if (width) {
    const n = Number.parseInt(width, 10);
    if (!Number.isNaN(n) && n > 0) attrs.width = n;
  }

  const margin = parseAttr(rest, "margin");
  if (margin) {
    const n = Number.parseInt(margin, 10);
    if (!Number.isNaN(n) && n >= 0) attrs.margin = n;
  }

  const level = parseAttr(rest, "level");
  if (level === "L" || level === "M" || level === "Q" || level === "H") {
    attrs.level = level;
  }

  const light = parseAttr(rest, "light");
  if (light) attrs.light = light;
  const dark = parseAttr(rest, "dark");
  if (dark) attrs.dark = dark;

  const logo = parseAttr(rest, "logo");
  if (logo) attrs.logo = logo;
  const logoSize = parseAttr(rest, "logo-size") ?? parseAttr(rest, "logoSize");
  if (logoSize) {
    const n = Number.parseFloat(logoSize);
    if (!Number.isNaN(n) && n > 0) attrs.logoSize = n;
  }

  return attrs;
}

function parseAttr(text: string, key: string): string | undefined {
  const attrRegex = new RegExp(`${key}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, "i");
  const match = text.match(attrRegex);
  if (!match) return undefined;
  return match[1] ?? match[2] ?? match[3] ?? undefined;
}

export function isHttpLike(text: string): boolean {
  return safeHttpUrl(text) !== null;
}
