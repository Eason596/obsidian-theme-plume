export const RENDER_SENTINEL_ATTR = "data-plume-render-sentinel";

export function hasRenderSentinel(root: HTMLElement): boolean {
  return root.querySelector(`:scope > [${RENDER_SENTINEL_ATTR}]`) !== null;
}

export function appendRenderSentinel(root: HTMLElement): void {
  const sentinel = root.ownerDocument.createElement("span");
  sentinel.setAttribute(RENDER_SENTINEL_ATTR, "1");
  sentinel.hidden = true;
  root.appendChild(sentinel);
}
