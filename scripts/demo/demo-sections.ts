export interface DemoSection {
  id?: string;
  heading: string;
  markdown: string;
}

export interface ParsedDemoDocument {
  /** Intro text before the inline `## 目录` block. */
  intro: string;
  sections: DemoSection[];
}

/** Strip `## 目录` … until `---` from preamble (sidebar replaces it on the demo site). */
export function splitIntroAndToc(preamble: string): string {
  const lines = preamble.split(/\r?\n/);
  const intro: string[] = [];
  let inToc = false;

  for (const line of lines) {
    if (/^##\s+目录\s*$/.test(line)) {
      inToc = true;
      continue;
    }
    if (inToc) {
      if (/^---\s*$/.test(line)) {
        inToc = false;
      }
      continue;
    }
    intro.push(line);
  }

  return intro.join("\n").replace(/\n+$/, "").trim();
}

export function sectionNavLabel(heading: string): string {
  return heading
    .replace(/^##\s+/, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

/** Split examples/plume-components.md into intro + numbered demo sections. */
export function parseDemoSections(markdown: string): ParsedDemoDocument {
  const lines = markdown.split(/\r?\n/);
  const preambleLines: string[] = [];
  const sections: DemoSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (/^<a id="[^"]+"><\/a>\s*$/.test(line) || /^## \d+\.\s/.test(line)) {
      break;
    }
    preambleLines.push(line);
    i += 1;
  }

  while (i < lines.length) {
    let id: string | undefined;
    if (/^<a id="([^"]+)"><\/a>\s*$/.test(lines[i])) {
      id = lines[i].match(/^<a id="([^"]+)"><\/a>\s*$/)?.[1];
      i += 1;
    }

    if (i >= lines.length || !/^## /.test(lines[i])) {
      break;
    }

    const heading = lines[i];
    i += 1;

    const body: string[] = [];
    while (i < lines.length) {
      const current = lines[i];
      if (/^---\s*$/.test(current)) {
        const next = lines[i + 1] ?? "";
        if (/^<a id="[^"]+"><\/a>\s*$/.test(next) || /^## \d+\.\s/.test(next)) {
          break;
        }
      }
      if (/^<a id="[^"]+"><\/a>\s*$/.test(current)) {
        break;
      }
      if (/^## \d+\.\s/.test(current)) {
        break;
      }
      body.push(current);
      i += 1;
    }

    let sectionMd = body.join("\n").replace(/\n+$/, "");
    sectionMd = sectionMd.replace(/\n---\s*$/, "").trim();

    sections.push({
      id,
      heading,
      markdown: sectionMd
    });

    if (i < lines.length && /^---\s*$/.test(lines[i])) {
      i += 1;
    }
  }

  const preamble = preambleLines.join("\n").replace(/\n+$/, "");

  return {
    intro: splitIntroAndToc(preamble),
    sections
  };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
