/**
 * GitHub Pages preview interactions (event listeners are not serialized into static HTML).
 */
(function initPlumeDemoClient() {
  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  /** Folder expand/collapse for file-tree & code-tree nav */
  function initFileTreeFolders() {
    document.querySelectorAll(".vp-file-tree-info.folder").forEach((info) => {
      if (info.dataset.demoFolderBound === "1") return;
      info.dataset.demoFolderBound = "1";

      const node = info.closest(".vp-file-tree-node");
      const group = node?.querySelector(":scope > .group");
      if (!(group instanceof HTMLElement)) return;

      const sync = () => {
        const expanded = info.classList.contains("expanded");
        group.style.display = expanded ? "" : "none";
      };
      sync();

      info.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement && event.target.closest(".comment")) {
          return;
        }
        event.preventDefault();
        info.classList.toggle("expanded");
        sync();
      });
    });
  }

  /** Switch code-tree panel from pre-rendered templates */
  function initCodeTrees() {
    document.querySelectorAll(".obsidian-vuepress-code-tree").forEach((tree) => {
      const templates = tree.querySelector(".demo-code-tree-templates");
      const panelContent = tree.querySelector(".vp-code-tree-panel-content");
      const panelEntry = tree.querySelector(".vp-code-tree-panel-entry");
      if (!(templates instanceof HTMLElement) || !(panelContent instanceof HTMLElement)) {
        return;
      }

      tree.querySelectorAll(".vp-code-tree-nav .vp-file-tree-info.file").forEach((info) => {
        if (info.dataset.demoCodeBound === "1") return;
        info.dataset.demoCodeBound = "1";

        info.addEventListener("click", (event) => {
          event.stopPropagation();
          const path = info.dataset.path;
          if (!path) return;

          const tpl = templates.querySelector(
            `.demo-code-tree-template[data-path="${CSS.escape(path)}"]`
          );
          if (!(tpl instanceof HTMLElement)) return;

          tree.querySelectorAll(".vp-code-tree-nav .vp-file-tree-info.file.active").forEach((el) => {
            el.classList.remove("active");
          });
          info.classList.add("active");

          panelContent.replaceChildren(...Array.from(tpl.childNodes).map((n) => n.cloneNode(true)));
          if (panelEntry instanceof HTMLElement) {
            panelEntry.textContent = path;
          }
        });
      });
    });
  }

  /** Tabs / code-tabs */
  function initTabbedContainers() {
    document.querySelectorAll(".vp-tabs, .vp-code-tabs").forEach((wrapper) => {
      const nav = wrapper.querySelector('[role="tablist"]');
      if (!nav) return;

      const buttons = Array.from(nav.querySelectorAll('[role="tab"]'));
      const panels = Array.from(wrapper.querySelectorAll('[role="tabpanel"]'));
      const panelById = new Map(panels.map((panel) => [panel.id, panel]));

      function activate(button) {
        const panelId = button.getAttribute("aria-controls");
        const activePanel = panelId ? panelById.get(panelId) : null;

        buttons.forEach((btn) => {
          const isActive = btn === button;
          btn.classList.toggle("active", isActive);
          btn.setAttribute("aria-selected", isActive ? "true" : "false");
          btn.setAttribute("aria-disabled", "false");
          btn.tabIndex = isActive ? 0 : -1;
        });

        panels.forEach((panel) => {
          const isActive = panel === activePanel;
          panel.classList.toggle("active", isActive);
          panel.style.display = isActive ? "" : "none";
          panel.style.opacity = isActive ? "1" : "0";
          panel.style.transform = isActive ? "translateY(0)" : "translateY(8px)";
          panel.setAttribute("aria-hidden", isActive ? "false" : "true");
          panel.setAttribute("aria-expanded", isActive ? "true" : "false");
        });
      }

      buttons.forEach((button) => {
        button.addEventListener("click", (event) => {
          event.preventDefault();
          activate(button);
        });
      });

      const initial =
        buttons.find((btn) => btn.classList.contains("active")) ?? buttons[0];
      if (initial) {
        activate(initial);
      }
    });
  }

  /** Collapse accordion: only one panel open */
  function initCollapseAccordion() {
    document.querySelectorAll('.vp-collapse[data-accordion="true"]').forEach((wrapper) => {
      wrapper.querySelectorAll(":scope > .vp-collapse-item").forEach((details) => {
        if (!(details instanceof HTMLDetailsElement)) return;
        if (details.dataset.demoAccordionBound === "1") return;
        details.dataset.demoAccordionBound = "1";

        details.addEventListener("toggle", () => {
          if (!details.open) return;
          wrapper.querySelectorAll(":scope > .vp-collapse-item").forEach((sibling) => {
            if (sibling !== details && sibling instanceof HTMLDetailsElement) {
              sibling.open = false;
            }
          });
        });
      });
    });
  }

  /** Masonry layout (also re-runs on resize) */
  function layoutMasonryWrapper(wrapper) {
    const gap =
      Number.parseInt(
        getComputedStyle(wrapper).getPropertyValue("--vp-card-masonry-gap") || "16",
        10
      ) || 16;
    const fixedCols = Number.parseInt(wrapper.dataset.cols || "", 10);

    const cells = Array.from(wrapper.querySelectorAll(":scope > .vp-card-masonry-cell"));
    const fromColumns = Array.from(
      wrapper.querySelectorAll(":scope > .card-masonry-item > .vp-card-masonry-cell")
    );
    const loose = Array.from(
      wrapper.querySelectorAll(
        ":scope > .vp-card-wrapper, :scope > .vp-image-card, :scope > .vp-code-block-title, :scope > pre"
      )
    );
    let items = cells.length > 0 ? cells : fromColumns;
    if (items.length === 0) {
      items = loose;
    }

    if (items.length === 0) {
      return;
    }

    const looksLikeRawContainer = items.some(
      (el) => el.tagName === "P" && (el.textContent ?? "").includes(":::")
    );
    if (looksLikeRawContainer) {
      return;
    }

    items.forEach((item) => item.classList.add("vp-card-masonry-cell"));

    const width = wrapper.clientWidth || 880;
    let cols = fixedCols;
    if (!cols || Number.isNaN(cols)) {
      if (width >= 960) cols = 3;
      else if (width >= 640) cols = 2;
      else cols = 1;
    }

    wrapper.replaceChildren();
    wrapper.style.setProperty("--vp-card-masonry-gap", `${gap}px`);
    wrapper.style.setProperty("--vp-card-masonry-cols", String(cols));

    const columns = [];
    const heights = new Array(cols).fill(0);

    for (let i = 0; i < cols; i += 1) {
      const col = document.createElement("div");
      col.className = "card-masonry-item";
      col.style.gap = `${gap}px`;
      wrapper.appendChild(col);
      columns.push(col);
    }

    for (const item of items) {
      let idx = 0;
      let min = heights[0];
      for (let k = 1; k < cols; k += 1) {
        if (heights[k] < min) {
          min = heights[k];
          idx = k;
        }
      }
      columns[idx].appendChild(item);
      const h = item.getBoundingClientRect().height || item.offsetHeight || 120;
      heights[idx] += h + gap;
    }
  }

  function initCardMasonry() {
    const wrappers = Array.from(document.querySelectorAll(".vp-card-masonry"));
    wrappers.forEach((wrapper) => layoutMasonryWrapper(wrapper));

    if (wrappers.length > 0) {
      let timer = null;
      window.addEventListener("resize", () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          wrappers.forEach((wrapper) => layoutMasonryWrapper(wrapper));
        }, 120);
      });
    }
  }

  /** Copy markdown source from demo section panels */
  function initDemoSourceCopy() {
    document.querySelectorAll(".demo-copy-source").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.demoSourceCopyBound === "1") return;
      button.dataset.demoSourceCopyBound = "1";

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const panel = button.closest(".demo-source-panel");
        const pre = panel?.querySelector(".demo-source-pre");
        const text = pre?.dataset.rawSource ?? pre?.querySelector("code")?.textContent ?? "";
        if (!text) return;
        try {
          await navigator.clipboard.writeText(text);
          const prev = button.textContent;
          button.textContent = "已复制";
          setTimeout(() => {
            button.textContent = prev;
          }, 1200);
        } catch {
          /* ignore */
        }
      });
    });
  }

  /** Copy file-tree text */
  function initCopyButtons() {
    document.querySelectorAll(".obsidian-file-tree-copy").forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      if (button.dataset.demoCopyBound === "1") return;
      button.dataset.demoCopyBound = "1";

      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const tree = button.closest(".obsidian-vuepress-file-tree");
        if (!tree) return;

        const lines = [];
        tree.querySelectorAll(".vp-file-tree-info").forEach((info) => {
          const name = info.querySelector(".name");
          if (!name) return;
          const level = Number.parseInt(
            getComputedStyle(info).getPropertyValue("--file-tree-level") || "0",
            10
          );
          const indent = "  ".repeat(Math.max(0, level + 1));
          lines.push(`${indent}- ${name.textContent?.trim() ?? ""}`);
        });

        const text = lines.join("\n");
        try {
          await navigator.clipboard.writeText(text);
          button.classList.add("is-copied");
          setTimeout(() => button.classList.remove("is-copied"), 1200);
        } catch {
          /* ignore */
        }
      });
    });
  }

  /** Highlight sidebar link for the section in view */
  function initSidebarNav() {
    const links = Array.from(
      document.querySelectorAll(".demo-sidebar-nav a[data-section-id]")
    );
    if (links.length === 0) return;

    const sections = links
      .map((link) => {
        const id = link.dataset.sectionId;
        const el = id ? document.getElementById(id) : null;
        return el ? { link, el } : null;
      })
      .filter(Boolean);

    if (sections.length === 0) return;

    const setActive = (id) => {
      for (const { link } of sections) {
        link.classList.toggle("is-active", link.dataset.sectionId === id);
      }
    };

    const sync = () => {
      const offset = 100;
      let current = sections[0].link.dataset.sectionId;
      for (const { link, el } of sections) {
        const top = el.getBoundingClientRect().top;
        if (top <= offset) {
          current = link.dataset.sectionId;
        }
      }
      setActive(current);
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("hashchange", () => {
      const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
      if (hash) setActive(hash);
    });
  }

  function boot() {
    initFileTreeFolders();
    initCodeTrees();
    initTabbedContainers();
    initCollapseAccordion();
    initCardMasonry();
    initCopyButtons();
    initDemoSourceCopy();
    initSidebarNav();
  }

  onReady(boot);
})();
