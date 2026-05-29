import { setIcon } from "obsidian";
import { resolveNodeIcon } from "../icons";
import type { FileTreeIconMode, TabItem } from "../types";
import { hashString } from "../utils/hash";
import {
  attachTabsKeyboardNav,
  getTabStoreValue,
  SHARED_TAB_ACTIVE,
  TABS_SYNC_EVENT,
  writeTabStoreValue
} from "./tab-store";

export type TabbedVariant = "tabs" | "code-tabs";

export interface TabbedContainerOptions {
  variant: TabbedVariant;
  tabs: TabItem[];
  sharedId?: string;
  defaultIconMode: FileTreeIconMode;
  /** When false, skip localStorage tab persistence. Default true. */
  persistSelection?: boolean;
  /** When true (default), render panel markdown only when the tab becomes active. */
  lazyPanels?: boolean;
  /** Bumps when the file is edited; forces panel re-render even if DOM nodes are reused. */
  contentEpoch?: number;
  renderPanel: (panel: HTMLElement, markdown: string) => Promise<void>;
}

function tabsContentRevision(tabs: TabItem[]): string {
  return hashString(tabs.map((t) => `${t.value}\0${t.title}\0${t.content}`).join("\n"));
}

const VARIANT_CLASSES: Record<
  TabbedVariant,
  { wrapper: string; nav: string; body: string; button: string; panel: string; btnPrefix: string; panelPrefix: string }
> = {
  tabs: {
    wrapper: "vp-tabs obsidian-vuepress-tabs",
    nav: "vp-tabs-nav",
    body: "vp-tabs-body",
    button: "vp-tabs-tab",
    panel: "vp-tabs-panel",
    btnPrefix: "vp-tabs-btn",
    panelPrefix: "vp-tabs-panel"
  },
  "code-tabs": {
    wrapper: "vp-code-tabs obsidian-vuepress-code-tabs",
    nav: "vp-code-tabs-nav",
    body: "vp-code-tabs-body",
    button: "vp-code-tab-nav",
    panel: "vp-code-tab",
    btnPrefix: "vp-code-tabs-btn",
    panelPrefix: "vp-code-tabs-panel"
  }
};

function decorateCodeTabButton(
  button: HTMLButtonElement,
  tab: TabItem,
  mode: FileTreeIconMode
): void {
  const iconHost = document.createElement("span");
  iconHost.className = "vp-code-tab-icon ft-icon";
  const desc = resolveNodeIcon(tab.title, "file", false, mode);
  if (desc.colorClass) iconHost.classList.add(desc.colorClass);
  if (desc.offlineSvg) {
    iconHost.classList.add("ft-icon-offline");
    iconHost.innerHTML = desc.offlineSvg;
  } else {
    setIcon(iconHost, desc.icon);
  }
  button.appendChild(iconHost);

  const label = document.createElement("span");
  label.className = "vp-code-tab-label";
  label.textContent = tab.title;
  button.appendChild(label);
}

/**
 * Shared tabs / code-tabs renderer (nav, persistence, sync, panel markdown).
 */
export async function renderTabbedContainer(
  container: HTMLElement,
  options: TabbedContainerOptions
): Promise<void> {
  const { variant, tabs, defaultIconMode, renderPanel } = options;
  const persistSelection = options.persistSelection !== false;
  const lazyPanels = options.lazyPanels !== false;
  const cls = VARIANT_CLASSES[variant];
  const sharedId = options.sharedId?.trim();
  const tabByValue = new Map(tabs.map((t) => [t.value, t]));
  const contentRevision = tabsContentRevision(tabs);
  const contentEpoch = String(options.contentEpoch ?? 0);

  const wrapper = document.createElement("div");
  wrapper.className = cls.wrapper;
  wrapper.dataset.plumeTabsRevision = contentRevision;
  wrapper.dataset.plumeContentEpoch = contentEpoch;
  container.appendChild(wrapper);

  const nav = document.createElement("div");
  nav.className = cls.nav;
  nav.setAttribute("role", "tablist");
  nav.setAttribute("aria-label", variant === "code-tabs" ? "代码选项卡" : "标签页");
  wrapper.appendChild(nav);

  const body = document.createElement("div");
  body.className = cls.body;
  wrapper.appendChild(body);

  const explicitActive = tabs.find((t) => t.active)?.value;
  const sharedActive = sharedId ? SHARED_TAB_ACTIVE.get(sharedId) : undefined;
  const persistedActive =
    sharedId && persistSelection ? getTabStoreValue(sharedId) : undefined;
  const initialValue =
    (sharedActive && tabs.some((t) => t.value === sharedActive) ? sharedActive : undefined)
    ?? (persistedActive && tabs.some((t) => t.value === persistedActive) ? persistedActive : undefined)
    ?? explicitActive
    ?? tabs[0]?.value;

  const buttons = new Map<string, HTMLButtonElement>();
  const panels = new Map<string, HTMLElement>();
  let activeValue = initialValue ?? "";
  let panelRenderSeq = 0;

  const markPanelRendered = (panel: HTMLElement, value: string): void => {
    panel.dataset.plumeTabRenderedRev = `${value}:${contentRevision}:${contentEpoch}`;
  };

  const isPanelRendered = (panel: HTMLElement, value: string): boolean =>
    panel.dataset.plumeTabRenderedRev === `${value}:${contentRevision}:${contentEpoch}`
    && panel.childElementCount > 0
    && wrapper.dataset.plumeContentEpoch === contentEpoch;

  const ensurePanelRendered = async (value: string): Promise<void> => {
    const panel = panels.get(value);
    const tab = tabByValue.get(value);
    if (!(panel instanceof HTMLElement) || !tab) {
      return;
    }

    if (!lazyPanels || isPanelRendered(panel, value)) {
      return;
    }

    const token = String(++panelRenderSeq);
    panel.dataset.plumeTabRenderToken = token;
    panel.empty();

    try {
      await renderPanel(panel, tab.content);
      if (
        panel.dataset.plumeTabRenderToken !== token
        || !panel.isConnected
        || wrapper.dataset.plumeTabsRevision !== contentRevision
        || wrapper.dataset.plumeContentEpoch !== contentEpoch
      ) {
        return;
      }
      markPanelRendered(panel, value);
    } catch {
      if (
        panel.dataset.plumeTabRenderToken !== token
        || !panel.isConnected
        || wrapper.dataset.plumeTabsRevision !== contentRevision
        || wrapper.dataset.plumeContentEpoch !== contentEpoch
      ) {
        return;
      }
      panel.empty();
      panel.textContent = tab.content;
      markPanelRendered(panel, value);
    }
  };

  const setActive = (value: string, emit: boolean): void => {
    if (!buttons.has(value)) {
      return;
    }

    activeValue = value;
      for (const [v, btn] of buttons) {
        const isActive = v === value;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
        btn.tabIndex = isActive ? 0 : -1;
        btn.setAttribute("aria-disabled", isActive ? "true" : "false");
      }
      for (const [v, panel] of panels) {
        const isActive = v === value;
        if (isActive) {
          panel.classList.add("active");
          panel.style.display = "";
          // 切换时总是刷新内容
          panel.empty();
          const tab = tabByValue.get(v);
          if (tab) {
            void renderPanel(panel, tab.content);
          }
          // 动画：先透明，后淡入
          panel.style.opacity = "0";
          panel.style.transform = "translateY(8px)";
          setTimeout(() => {
            panel.style.opacity = "1";
            panel.style.transform = "translateY(0)";
          }, 10);
        } else {
          panel.classList.remove("active");
          panel.style.opacity = "0";
          panel.style.transform = "translateY(8px)";
          setTimeout(() => {
            panel.style.display = "none";
          }, 250);
        }
        panel.setAttribute("aria-hidden", isActive ? "false" : "true");
        panel.setAttribute("aria-expanded", isActive ? "true" : "false");
      }

      if (lazyPanels) {
        void ensurePanelRendered(value);
      }
    if (sharedId) {
      SHARED_TAB_ACTIVE.set(sharedId, value);
      if (persistSelection) {
        writeTabStoreValue(sharedId, value);
      }
      if (emit) {
        document.dispatchEvent(
          new CustomEvent(TABS_SYNC_EVENT, {
            detail: { id: sharedId, value, source: wrapper }
          })
        );
      }
    }
  };

  for (const tab of tabs) {
    const buttonId = `${cls.btnPrefix}-${Math.random().toString(36).slice(2, 10)}`;
    const panelId = `${cls.panelPrefix}-${Math.random().toString(36).slice(2, 10)}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = cls.button;
    button.setAttribute("role", "tab");
    button.id = buttonId;
    button.setAttribute("aria-controls", panelId);
    button.setAttribute("tabindex", "-1"); // 默认非激活

    if (variant === "code-tabs") {
      decorateCodeTabButton(button, tab, defaultIconMode);
    } else {
      button.textContent = tab.title;
    }

    nav.appendChild(button);
    buttons.set(tab.value, button);

    const panel = document.createElement("section");
    panel.className = cls.panel;
    panel.id = panelId;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", buttonId);
    panel.setAttribute("tabindex", "0");
    body.appendChild(panel);
    panels.set(tab.value, panel);

    button.addEventListener("click", () => {
      if (activeValue === tab.value) return;
      setActive(tab.value, true);
    });
  }

  if (sharedId) {
    const onSync = (event: Event): void => {
      if (!wrapper.isConnected) {
        document.removeEventListener(TABS_SYNC_EVENT, onSync as EventListener);
        return;
      }
      const detail = (event as CustomEvent<{ id?: string; value?: string; source?: HTMLElement }>)
        .detail;
      if (!detail || detail.id !== sharedId || detail.source === wrapper) return;
      if (!detail.value || detail.value === activeValue || !buttons.has(detail.value)) return;
      setActive(detail.value, false);
    };
    document.addEventListener(TABS_SYNC_EVENT, onSync as EventListener);
  }

  attachTabsKeyboardNav(nav, buttons, () => activeValue, (value) => setActive(value, true));

  if (initialValue) {
    setActive(initialValue, false);
  }

  if (lazyPanels) {
    if (initialValue) {
      await ensurePanelRendered(initialValue);
    }
    return;
  }

  await Promise.all(
    tabs.map(async (tab) => {
      const panel = panels.get(tab.value);
      if (!panel) return;
      try {
        await renderPanel(panel, tab.content);
        markPanelRendered(panel, tab.value);
      } catch {
        panel.empty();
        panel.textContent = tab.content;
        markPanelRendered(panel, tab.value);
      }
    })
  );
}
