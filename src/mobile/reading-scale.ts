/**
 * Phone reading scale, following the reading-view zoom approach:
 * zoom the reading view, and set the sizer max-width to visualWidth / zoom
 * so the painted column stays the screen width while the type scales.
 */
export function mobileReadingCss(zoom: number, visualWidth: number): string {
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const width = Math.max(240, Math.round(visualWidth));
  const layoutWidth = (width / safeZoom).toFixed(2);
  const z = safeZoom.toFixed(2);
  return [
    ".markdown-reading-view,",
    ".markdown-reading-view .markdown-preview-view {",
    "  --file-line-width: " + width + "px;",
    "  --line-width: " + width + "px;",
    "}",
    ".markdown-reading-view .markdown-preview-sizer {",
    "  max-width: " + layoutWidth + "px !important;",
    "}",
    ".markdown-reading-view {",
    "  zoom: " + z + ";",
    "}"
  ].join("\n");
}
