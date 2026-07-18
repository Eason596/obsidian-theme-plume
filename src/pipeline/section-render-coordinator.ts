export interface SectionRenderTicket {
  root: HTMLElement;
  sourcePath: string;
  generation: number;
}

interface ActiveSectionRender {
  sourcePath: string;
  generation: number;
}

/**
 * Gives each reused Obsidian section element a single current render owner.
 * A late async render can keep working in its detached host, but can no longer
 * commit into a section that now belongs to another note/render generation.
 */
export class SectionRenderCoordinator {
  private activeByRoot = new WeakMap<HTMLElement, ActiveSectionRender>();

  sourcePathFor(root: HTMLElement): string | null {
    return this.activeByRoot.get(root)?.sourcePath ?? null;
  }

  begin(root: HTMLElement, sourcePath: string): SectionRenderTicket {
    const generation = (this.activeByRoot.get(root)?.generation ?? 0) + 1;
    this.activeByRoot.set(root, { sourcePath, generation });
    return { root, sourcePath, generation };
  }

  isCurrent(ticket: SectionRenderTicket): boolean {
    const active = this.activeByRoot.get(ticket.root);
    return active?.sourcePath === ticket.sourcePath
      && active.generation === ticket.generation;
  }

  /** Move a connected render host's children into the section if still current. */
  commitHost(ticket: SectionRenderTicket, host: HTMLElement): boolean {
    if (!this.isCurrent(ticket) || host.parentElement !== ticket.root) {
      return false;
    }
    ticket.root.replaceChildren(...Array.from(host.childNodes));
    return true;
  }
}
