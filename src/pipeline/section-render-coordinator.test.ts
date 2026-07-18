import { describe, expect, it } from "vitest";
import { SectionRenderCoordinator } from "./section-render-coordinator";

describe("SectionRenderCoordinator", () => {
  it("prevents a previous note render from overwriting a reused section", () => {
    const coordinator = new SectionRenderCoordinator();
    const root = document.createElement("section");

    const oldTicket = coordinator.begin(root, "old-note.md");
    const oldHost = document.createElement("div");
    oldHost.textContent = "old file tree";
    root.replaceChildren(oldHost);

    const currentTicket = coordinator.begin(root, "bookmark_sources.md");
    const currentHost = document.createElement("div");
    currentHost.textContent = "bookmark cards";
    root.replaceChildren(currentHost);

    expect(coordinator.commitHost(currentTicket, currentHost)).toBe(true);
    expect(root.textContent).toBe("bookmark cards");
    expect(coordinator.commitHost(oldTicket, oldHost)).toBe(false);
    expect(root.textContent).toBe("bookmark cards");
  });
});
