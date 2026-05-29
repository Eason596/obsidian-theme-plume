import { sectionNavLabel } from "./demo-sections";
import type { DemoSection } from "./demo-sections";

export function buildDemoSidebar(sections: DemoSection[]): HTMLElement {
  const aside = document.createElement("aside");
  aside.className = "demo-sidebar";
  aside.setAttribute("aria-label", "组件目录");

  const title = document.createElement("p");
  title.className = "demo-sidebar-title";
  title.textContent = "目录";
  aside.appendChild(title);

  const nav = document.createElement("nav");
  nav.className = "demo-sidebar-nav";

  const list = document.createElement("ul");
  list.className = "demo-sidebar-list";

  for (const section of sections) {
    if (!section.id) {
      continue;
    }
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = sectionNavLabel(section.heading);
    link.dataset.sectionId = section.id;
    item.appendChild(link);
    list.appendChild(item);
  }

  nav.appendChild(list);
  aside.appendChild(nav);
  return aside;
}
