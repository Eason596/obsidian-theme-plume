import { normalizeIconifyId } from "../offlineIconify";

const ICONIFY_API_BASE = "https://api.iconify.design";
const iconSvgCache = new Map<string, Promise<string | null>>();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getIconifyUrl(iconId: string): string | null {
  const normalized = normalizeIconifyId(iconId);
  const separator = normalized.indexOf(":");
  if (separator === -1) {
    return null;
  }
  const prefix = normalized.slice(0, separator);
  const name = normalized.slice(separator + 1);
  if (!prefix || !name) {
    return null;
  }
  return `${ICONIFY_API_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
}

async function fetchIconifySvg(iconId: string): Promise<string | null> {
  const normalized = normalizeIconifyId(iconId);
  const cached = iconSvgCache.get(normalized);
  if (cached) {
    return cached;
  }

  const pending = (async (): Promise<string | null> => {
    const url = getIconifyUrl(normalized);
    if (!url) {
      return null;
    }
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const svg = await response.text();
      return /^\s*<svg[\s>]/i.test(svg) ? svg : null;
    } catch {
      return null;
    }
  })();

  iconSvgCache.set(normalized, pending);
  return pending;
}

export function createIconifySpanHtml(
  iconId: string,
  className = "vp-icon",
  style?: string
): string {
  const normalized = normalizeIconifyId(iconId);
  const styleAttr = style ? ` style="${escapeHtml(style)}"` : "";
  return `<span class="${escapeHtml(className)} ft-icon-online" data-vp-icon="${escapeHtml(normalized)}" aria-hidden="true"${styleAttr}></span>`;
}

export function prepareIconifyIconElement(element: HTMLElement, iconId: string): void {
  const normalized = normalizeIconifyId(iconId);
  element.dataset.vpIcon = normalized;
  element.setAttribute("aria-hidden", "true");
  element.classList.add("ft-icon-online");
}

export async function processIconifyIcons(rootElement: HTMLElement): Promise<void> {
  const elements = [
    ...(rootElement.matches("[data-vp-icon]") ? [rootElement] : []),
    ...Array.from(
      rootElement.querySelectorAll<HTMLElement>("[data-vp-icon]")
    )
  ];

  await Promise.all(elements.map(async (element) => {
    const iconId = element.dataset.vpIcon;
    if (!iconId || element.dataset.vpIconLoaded === "1" || element.dataset.vpIconLoading === "1") {
      return;
    }

    element.dataset.vpIconLoading = "1";
    const svg = await fetchIconifySvg(iconId);
    delete element.dataset.vpIconLoading;
    if (!element.isConnected && !rootElement.contains(element)) {
      return;
    }
    if (!svg) {
      element.dataset.vpIconFailed = "1";
      return;
    }

    element.empty();
    element.innerHTML = svg;
    element.dataset.vpIconLoaded = "1";
    delete element.dataset.vpIconFailed;
  }));
}
