import type { Component } from "obsidian";

export interface UnlockHostHeightHandle {
  cancel: () => void;
}

/**
 * Clear Obsidian scroll-sync inline min-heights around a Plume host.
 * Timers are cancellable and optional Component registration cleans them up.
 */
export function unlockHostHeight(
  host: HTMLElement,
  component?: Component
): UnlockHostHeightHandle {
  const timers: number[] = [];
  let cancelled = false;

  const apply = (): void => {
    if (cancelled || !host.isConnected) return;
    host.style.height = "fit-content";
    host.style.minHeight = "0";
    host.style.maxHeight = "none";
    let node: HTMLElement | null = host.parentElement;
    while (node) {
      if (
        node.classList.contains("markdown-preview-section")
        || node.classList.contains("plume-has-block")
        || node.classList.contains("cm-preview-code-block")
      ) {
        node.style.minHeight = "0";
        node.style.height = "auto";
      }
      if (node.classList.contains("markdown-preview-sizer")) {
        break;
      }
      node = node.parentElement;
    }
  };

  const cancel = (): void => {
    cancelled = true;
    for (const id of timers) {
      window.clearTimeout(id);
    }
    timers.length = 0;
  };

  apply();
  window.requestAnimationFrame(() => {
    if (!cancelled) apply();
  });
  // One short + one settle pass — enough for Obsidian scroll-sync min-heights.
  timers.push(window.setTimeout(apply, 50));
  timers.push(window.setTimeout(apply, 200));

  component?.register(cancel);
  return { cancel };
}
