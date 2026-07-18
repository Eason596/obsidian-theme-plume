import type { Component } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { TABS_SYNC_EVENT } from "./tab-store";
import { renderTabbedContainer } from "./tabbed-container";

describe("renderTabbedContainer lifecycle", () => {
  it("registers shared-tab document listener cleanup with the render component", async () => {
    const cleanups: Array<() => void> = [];
    const component = {
      register: (cleanup: () => void) => cleanups.push(cleanup)
    } as unknown as Component;
    const removeSpy = vi.spyOn(document, "removeEventListener");

    await renderTabbedContainer(document.createElement("div"), {
      variant: "tabs",
      tabs: [{ title: "One", value: "one", content: "Body" }],
      sharedId: "lifecycle-test",
      defaultIconMode: "simple",
      lazyPanels: false,
      component,
      renderPanel: async (panel, markdown) => {
        panel.textContent = markdown;
      }
    });

    expect(cleanups).toHaveLength(1);
    cleanups[0]();
    expect(removeSpy).toHaveBeenCalledWith(TABS_SYNC_EVENT, expect.any(Function));
    removeSpy.mockRestore();
  });

  it("matches VuePress tab DOM and interaction semantics", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await renderTabbedContainer(host, {
      variant: "tabs",
      tabs: [
        { title: "One", value: "one", content: "First" },
        { title: "Two", value: "two", content: "Second" }
      ],
      defaultIconMode: "simple",
      lazyPanels: false,
      renderPanel: async (panel, markdown) => {
        panel.textContent = markdown;
      }
    });

    const wrapper = host.querySelector<HTMLElement>(".vp-tabs")!;
    const buttons = Array.from(wrapper.querySelectorAll<HTMLButtonElement>(".vp-tab-nav"));
    const panels = Array.from(wrapper.querySelectorAll<HTMLElement>(".vp-tab"));
    expect(buttons).toHaveLength(2);
    expect(panels).toHaveLength(2);
    expect(panels.every((panel) => panel.parentElement === wrapper)).toBe(true);
    expect(wrapper.querySelector(".vp-tabs-body")).toBeNull();
    expect(buttons[0].hasAttribute("aria-disabled")).toBe(false);

    buttons[1].click();
    expect(buttons[1].classList.contains("active")).toBe(true);
    expect(panels[1].classList.contains("active")).toBe(true);

    buttons[1].dispatchEvent(new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true
    }));
    expect(buttons[0].classList.contains("active")).toBe(true);
    host.remove();
  });
});
