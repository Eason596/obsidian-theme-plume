/**
 * @[qrcode] / ::: qrcode — VuePress Theme Plume QR embed parity.
 * Bundled as a sibling `qrcode-lib.cjs` chunk (see esbuild.config.mjs).
 */

import QRCode from "qrcode";
import type { QrcodeContainerAttrs } from "../types";
import { isHttpLike, parseQrcodeAttrs } from "./qrcode-attrs";

export { isHttpLike, parseQrcodeAttrs };

function normalizeColor(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  // VuePress uses 8-digit hex with alpha; canvas QR expects #RRGGBB or with alpha.
  if (/^#[0-9a-fA-F]{8}$/.test(value)) {
    return `#${value.slice(1, 7)}`;
  }
  return value;
}

export async function generateQrDataUrl(
  text: string,
  attrs: QrcodeContainerAttrs
): Promise<string> {
  const width = attrs.width && attrs.width > 0 ? attrs.width : 300;
  const margin = attrs.margin ?? 2;
  const level = attrs.logo ? "H" : (attrs.level ?? "M");

  if (!attrs.logo) {
    return QRCode.toDataURL(text, {
      width,
      margin,
      errorCorrectionLevel: level,
      color: {
        dark: normalizeColor(attrs.dark, "#000000"),
        light: normalizeColor(attrs.light, "#ffffff")
      }
    });
  }

  // With logo: draw QR on canvas then overlay logo image.
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, text, {
    width,
    margin,
    errorCorrectionLevel: "H",
    color: {
      dark: normalizeColor(attrs.dark, "#000000"),
      light: normalizeColor(attrs.light, "#ffffff")
    }
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas.toDataURL("image/png");
  }

  try {
    const logoImg = await loadImage(attrs.logo);
    const ratio = attrs.logoSize && attrs.logoSize > 0 ? attrs.logoSize : 0.2;
    const logoW = canvas.width * ratio;
    const logoH = canvas.height * ratio;
    const x = (canvas.width - logoW) / 2;
    const y = (canvas.height - logoH) / 2;
    // White pad behind logo for scannability
    const pad = logoW * 0.12;
    ctx.fillStyle = normalizeColor(attrs.light, "#ffffff");
    ctx.fillRect(x - pad, y - pad, logoW + pad * 2, logoH + pad * 2);
    ctx.drawImage(logoImg, x, y, logoW, logoH);
  } catch {
    /* logo failed — keep QR only */
  }

  return canvas.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load logo: ${src}`));
    img.src = src;
  });
}
