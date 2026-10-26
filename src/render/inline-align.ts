/**
 * Shared inline syntax with VuePress Plume: sub, sup, and footnotes.
 * `==highlight==` is left to Obsidian; the companion theme styles `mark`.
 * Fenced and inline code are left unchanged.
 */

export interface InlineAlignOptions {
  /** Full note, used so footnote numbers stay stable across preview sections. */
  documentText?: string;
}

interface FootnoteDef {
  text: string;
}

const FENCE_OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function footnoteId(label: string): string {
  return label.replace(/[^A-Za-z0-9_-]/g, "-");
}

function collectFootnoteDefs(markdown: string): Map<string, FootnoteDef> {
  const defs = new Map<string, FootnoteDef>();
  const lines = markdown.split(/\r?\n/);
  let fenceChar = "";
  let fenceLength = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (fenceLength > 0) {
      if (new RegExp(`^\\s*${fenceChar}{${fenceLength},}\\s*$`).test(line)) {
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }
    const fence = line.match(FENCE_OPEN);
    if (fence) {
      fenceChar = fence[2][0] ?? "`";
      fenceLength = fence[2].length;
      continue;
    }
    const def = line.match(/^\[\^([^\]]+)\]:[ \t]*(.*)$/);
    if (!def) continue;
    const chunks = [def[2] ?? ""];
    let cursor = i + 1;
    while (cursor < lines.length) {
      const next = lines[cursor] ?? "";
      if (!/^(?:[ ]{2,}|\t)\S/.test(next)) break;
      chunks.push(next.trim());
      cursor += 1;
    }
    defs.set(def[1] ?? "", { text: chunks.join(" ").trim() });
    i = cursor - 1;
  }
  return defs;
}

function footnoteNumbers(markdown: string, defs: Map<string, FootnoteDef>): Map<string, number> {
  const numbers = new Map<string, number>();
  const lines = markdown.split(/\r?\n/);
  let fenceChar = "";
  let fenceLength = 0;
  let next = 1;

  const take = (label: string) => {
    if (!defs.has(label) || numbers.has(label)) return;
    numbers.set(label, next);
    next += 1;
  };

  for (const line of lines) {
    if (fenceLength > 0) {
      if (new RegExp(`^\\s*${fenceChar}{${fenceLength},}\\s*$`).test(line)) {
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }
    const fence = line.match(FENCE_OPEN);
    if (fence) {
      fenceChar = fence[2][0] ?? "`";
      fenceLength = fence[2].length;
      continue;
    }
    if (/^\[\^([^\]]+)\]:/.test(line)) continue;
    for (const match of line.matchAll(/\[\^([^\]]+)\]/g)) {
      take(match[1] ?? "");
    }
  }
  for (const label of defs.keys()) take(label);
  return numbers;
}

function collectLabeledDefs(markdown: string, pattern: RegExp): Map<string, string> {
  const defs = new Map<string, string>();
  const lines = markdown.split(/\r?\n/);
  let fenceChar = "";
  let fenceLength = 0;
  for (const line of lines) {
    if (fenceLength > 0) {
      if (new RegExp(`^\\s*${fenceChar}{${fenceLength},}\\s*$`).test(line)) {
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }
    const fence = line.match(FENCE_OPEN);
    if (fence) {
      fenceChar = fence[2][0] ?? "`";
      fenceLength = fence[2].length;
      continue;
    }
    const match = line.match(pattern);
    if (match?.[1]) defs.set(match[1], (match[2] ?? "").trim());
  }
  return defs;
}

function renderFootnote(label: string, text: string, numbers: Map<string, number>): string {
  const id = footnoteId(label);
  const number = numbers.get(label);
  return `<p class="vp-footnote" id="fn-${id}"><a href="#fnref-${id}">${number}</a>. ${escapeHtml(text)}</p>`;
}

function consumeDefinition(
  line: string,
  lines: string[],
  index: number,
  rules: Array<{
    pattern: RegExp;
    labels: Map<string, number> | Map<string, string>;
    render: (label: string, text: string, numbers: Map<string, number>) => string;
  }>
): { html: string; next: number } | null {
  for (const rule of rules) {
    const match = line.match(rule.pattern);
    const label = match?.[1] ?? "";
    if (!match || !rule.labels.has(label)) continue;
    const chunks = [match[2] ?? ""];
    let cursor = index + 1;
    while (cursor < lines.length && /^(?:[ ]{2,}|\t)\S/.test(lines[cursor] ?? "")) {
      chunks.push((lines[cursor] ?? "").trim());
      cursor += 1;
    }
    const numbers = rule.labels instanceof Map && typeof rule.labels.get(label) === "number"
      ? (rule.labels as Map<string, number>)
      : new Map<string, number>();
    return { html: rule.render(label, chunks.join(" ").trim(), numbers), next: cursor };
  }
  return null;
}

function applyAbbreviations(text: string, abbreviations: Map<string, string>): string {
  const keys = [...abbreviations.keys()].sort((a, b) => b.length - a.length);
  let output = text;
  for (const key of keys) {
    const description = abbreviations.get(key) ?? "";
    const pattern = new RegExp(`(?<![\\w-])${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g");
    output = output.replace(pattern, `<abbr title="${escapeHtml(description)}">${escapeHtml(key)}</abbr>`);
  }
  return output;
}

function applyAttrs(text: string): string {
  return text.replace(
    /(^|[\s([])([^\s{]+){\.([A-Za-z_][\w-]*)\}/g,
    (_match, lead: string, word: string, className: string) =>
      `${lead}<span class="${escapeHtml(className)}">${escapeHtml(word)}</span>`
  );
}

function transformPlain(
  text: string,
  numbers: Map<string, number>,
  annotations: Map<string, string>,
  abbreviations: Map<string, string>,
  attrs: boolean
): string {
  const withRefs = text.replace(/\[\^([^\]]+)\]/g, (matched, label: string) => {
    const number = numbers.get(label);
    if (number === undefined) return matched;
    const id = footnoteId(label);
    return `<sup class="vp-footnote-ref" id="fnref-${id}"><a href="#fn-${id}">${number}</a></sup>`;
  });
  const withNotes = withRefs.replace(/\[\+([^\]]+)\](?!:)/g, (matched, label: string) => {
    const note = annotations.get(label);
    if (note === undefined) return matched;
    return `<span class="vp-annotation" title="${escapeHtml(note)}">${escapeHtml(label)}</span>`;
  });
  const withSub = withNotes.replace(/(?<!~)~([^\s~]+)~(?!~)/g, (_match, body: string) => {
    return `<sub>${escapeHtml(body)}</sub>`;
  });
  const withSup = withSub.replace(/(?<!\[)\^([^\s^[\]\\]+)\^(?!\])/g, (_match, body: string) => {
    return `<sup>${escapeHtml(body)}</sup>`;
  });
  const withAbbr = applyAbbreviations(withSup, abbreviations);
  return attrs ? applyAttrs(withAbbr) : withAbbr;
}

function transformLineOutsideCode(
  line: string,
  numbers: Map<string, number>,
  annotations: Map<string, string>,
  abbreviations: Map<string, string>,
  attrs: boolean
): string {
  let output = "";
  let cursor = 0;
  while (cursor < line.length) {
    if (line[cursor] !== "`") {
      const next = line.indexOf("`", cursor);
      const end = next === -1 ? line.length : next;
      output += transformPlain(line.slice(cursor, end), numbers, annotations, abbreviations, attrs);
      cursor = end;
      continue;
    }
    let tick = cursor;
    while (line[tick] === "`") tick += 1;
    const marker = line.slice(cursor, tick);
    const close = line.indexOf(marker, tick);
    if (close === -1) {
      output += transformPlain(line.slice(cursor), numbers, annotations, abbreviations, attrs);
      break;
    }
    output += line.slice(cursor, close + marker.length);
    cursor = close + marker.length;
  }
  return output;
}

export function applyInlineAlignSyntax(
  markdown: string,
  documentText = markdown,
  options?: { attrs?: boolean }
): string {
  const defs = collectFootnoteDefs(documentText);
  const numbers = footnoteNumbers(documentText, defs);
  const annotations = collectLabeledDefs(documentText, /^\[\+([^\]]+)\]:[ \t]*(.*)$/);
  const abbreviations = collectLabeledDefs(documentText, /^\*\[([^\]]+)\]:[ \t]*(.*)$/);
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let fenceChar = "";
  let fenceLength = 0;
  let skipUntil = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (i < skipUntil) continue;

    if (fenceLength > 0) {
      out.push(line);
      if (new RegExp(`^\\s*${fenceChar}{${fenceLength},}\\s*$`).test(line)) {
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }
    const fence = line.match(FENCE_OPEN);
    if (fence) {
      fenceChar = fence[2][0] ?? "`";
      fenceLength = fence[2].length;
      out.push(line);
      continue;
    }

    const consumed = consumeDefinition(line, lines, i, [
      { pattern: /^\[\^([^\]]+)\]:[ \t]*(.*)$/, labels: numbers, render: renderFootnote },
      { pattern: /^\[\+([^\]]+)\]:[ \t]*(.*)$/, labels: annotations, render: () => "" },
      { pattern: /^\*\[([^\]]+)\]:[ \t]*(.*)$/, labels: abbreviations, render: () => "" }
    ]);
    if (consumed) {
      if (consumed.html) out.push(consumed.html);
      skipUntil = consumed.next;
      continue;
    }

    out.push(transformLineOutsideCode(line, numbers, annotations, abbreviations, options?.attrs === true));
  }

  return out.join("\n");
}
