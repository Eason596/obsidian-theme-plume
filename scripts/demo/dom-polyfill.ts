/** Obsidian DOM helpers for happy-dom (demo build only). */

interface DomElementInfo {
  cls?: string;
  text?: string;
  href?: string;
  attr?: Record<string, string>;
}

function applyDomInfo(el: HTMLElement, o?: DomElementInfo | string): void {
  if (!o) {
    return;
  }
  if (typeof o === "string") {
    el.textContent = o;
    return;
  }
  if (o.cls) {
    el.className = o.cls;
  }
  if (o.text) {
    el.textContent = o.text;
  }
  if (o.href) {
    el.setAttribute("href", o.href);
  }
  if (o.attr) {
    for (const [key, value] of Object.entries(o.attr)) {
      el.setAttribute(key, value);
    }
  }
}

export function patchDomPolyfills(): void {
  const proto = HTMLElement.prototype as HTMLElement & {
    createEl?: (tag: string, o?: DomElementInfo | string) => HTMLElement;
    createDiv?: (o?: DomElementInfo | string) => HTMLDivElement;
    createSpan?: (o?: DomElementInfo | string) => HTMLSpanElement;
    empty?: () => void;
  };

  if (!proto.empty) {
    proto.empty = function empty(this: HTMLElement): void {
      this.replaceChildren();
    };
  }

  if (!proto.createEl) {
    proto.createEl = function createEl(
      this: HTMLElement,
      tag: string,
      o?: DomElementInfo | string
    ): HTMLElement {
      const el = document.createElement(tag);
      applyDomInfo(el, o);
      this.appendChild(el);
      return el;
    };
  }

  if (!proto.createDiv) {
    proto.createDiv = function createDiv(
      this: HTMLElement,
      o?: DomElementInfo | string
    ): HTMLDivElement {
      return this.createEl!("div", o) as HTMLDivElement;
    };
  }

  if (!proto.createSpan) {
    proto.createSpan = function createSpan(
      this: HTMLElement,
      o?: DomElementInfo | string
    ): HTMLSpanElement {
      return this.createEl!("span", o) as HTMLSpanElement;
    };
  }
}
