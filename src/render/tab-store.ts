/** Shared tab persistence + cross-instance sync for tabs / code-tabs. */

export const TABS_SYNC_EVENT = "vpft:tabs-sync";
export const SHARED_TAB_ACTIVE = new Map<string, string>();

const TAB_STORE_KEY = "vp-plume-tab-store";

function readTabStore(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(TAB_STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function writeTabStoreValue(id: string, value: string): void {
  try {
    const store = readTabStore();
    if (store[id] === value) return;
    store[id] = value;
    window.localStorage.setItem(TAB_STORE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage may be unavailable */
  }
}

export function getTabStoreValue(id: string): string | undefined {
  return readTabStore()[id];
}

export function attachTabsKeyboardNav(
  nav: HTMLElement,
  buttons: Map<string, HTMLButtonElement>,
  getActive: () => string,
  activate: (value: string) => void
): void {
  nav.addEventListener("keydown", (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target || target.getAttribute("role") !== "tab") return;
    const values = Array.from(buttons.keys());
    if (values.length === 0) return;
    const current = values.indexOf(getActive());
    const idx = current === -1 ? 0 : current;
    let next = -1;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (idx + 1) % values.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (idx - 1 + values.length) % values.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = values.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextValue = values[next];
    activate(nextValue);
    buttons.get(nextValue)?.focus();
  });
}
