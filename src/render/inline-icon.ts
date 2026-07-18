import { setIcon, type IconName } from "obsidian";
import { safeImageUrl } from "../utils/safe-url";
import { prepareIconifyIconElement, processIconifyIcons } from "./iconify-online";

export function applyInlineIcon(host: HTMLElement, icon: string, className: string): void {
  const trimmed = icon.trim();
  if (!trimmed) return;
  const isImage =
    /^(https?:)?\/\//i.test(trimmed)
    || trimmed.startsWith("data:")
    || /\.(png|jpe?g|gif|svg|webp|avif)$/i.test(trimmed);
  if (isImage) {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//");
    const imageSrc = hasScheme ? safeImageUrl(trimmed) : trimmed;
    if (!imageSrc) return;
    const img = document.createElement("img");
    img.className = className.includes("vp-icon") ? className : `${className} vp-icon-img`;
    img.src = imageSrc;
    img.alt = "";
    img.loading = "lazy";
    host.appendChild(img);
    return;
  }

  const span = document.createElement("span");
  const classes = new Set(className.split(/\s+/).filter(Boolean));
  classes.add("vp-icon");
  span.className = Array.from(classes).join(" ");
  span.setAttribute("aria-hidden", "true");
  host.appendChild(span);

  if (trimmed.includes(":")) {
    span.setAttribute("data-provider", "iconify");
    prepareIconifyIconElement(span, trimmed);
    void processIconifyIcons(span);
    return;
  }
  void paintBareIcon(span, trimmed);
}

async function paintBareIcon(span: HTMLElement, iconId: string): Promise<void> {
  const tryObsidian = (): boolean => {
    if (!span.isConnected) return false;
    span.empty();
    try {
      setIcon(span, iconId as IconName);
    } catch {
      return false;
    }
    return !!span.querySelector("svg");
  };

  if (tryObsidian()) return;
  for (let i = 0; i < 20; i += 1) {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    if (tryObsidian()) return;
    if (span.isConnected) break;
  }
  span.empty();
  span.setAttribute("data-provider", "iconify");
  prepareIconifyIconElement(span, `lucide:${iconId}`);
  await processIconifyIcons(span);
}
