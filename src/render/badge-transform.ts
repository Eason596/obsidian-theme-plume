const BADGE_TYPES = new Set(["tip", "info", "warning", "danger", "note", "important"]);
const RE_CODE_FENCE_OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseAttrValue(text: string, key: string): string | undefined {
  const attrRegex = new RegExp(`${key}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`, "i");
  const match = text.match(attrRegex);
  if (!match) {
    return undefined;
  }

  return match[1] ?? match[2] ?? match[3] ?? undefined;
}

function buildBadgeHtml(attrs: string, body = ""): string {
  const type = parseAttrValue(attrs, "type") ?? "tip";
  const text = parseAttrValue(attrs, "text") ?? body.trim() ?? "";
  const color = parseAttrValue(attrs, "color");
  const bgColor =
    parseAttrValue(attrs, "bg-color")
    ?? parseAttrValue(attrs, "bgColor")
    ?? parseAttrValue(attrs, "bgcolor");
  const borderColor =
    parseAttrValue(attrs, "border-color")
    ?? parseAttrValue(attrs, "borderColor")
    ?? parseAttrValue(attrs, "bordercolor");

  const normalized = type.toLowerCase();
  const cls = normalized.replace(/[^a-z0-9_-]/g, "") || "tip";
  const classes = ["vp-badge", cls];
  if (!BADGE_TYPES.has(cls) && !color && !bgColor && !borderColor) {
    classes.push("tip");
  }

  const style: string[] = [];
  if (color) style.push(`color:${escapeHtml(color)}`);
  if (bgColor) style.push(`background-color:${escapeHtml(bgColor)}`);
  if (borderColor) style.push(`border-color:${escapeHtml(borderColor)}`);

  const styleAttr = style.length > 0 ? ` style="${style.join(";")}"` : "";
  return `<span class="${classes.join(" ")}"${styleAttr}>${escapeHtml(text)}</span>`;
}

function replaceBadgeTagsInLine(line: string): string {
  return line
    .replace(/<Badge\b([^>]*)\/>/gi, (_matched, attrs: string) => {
      return buildBadgeHtml(attrs);
    })
    .replace(/<Badge\b([^>]*)>(.*?)<\/Badge>/gi, (_matched, attrs: string, body: string) => {
      return buildBadgeHtml(attrs, body);
    });
}

export function replaceBadgeTagsInMarkdown(markdown: string): string {
  if (!/<Badge\b/i.test(markdown)) {
    return markdown;
  }

  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  let fenceChar = "";
  let fenceLength = 0;

  for (const line of lines) {
    if (fenceLength > 0) {
      out.push(line);
      const closeRegex = new RegExp(`^\\s*${fenceChar}{${fenceLength},}\\s*$`);
      if (closeRegex.test(line)) {
        fenceChar = "";
        fenceLength = 0;
      }
      continue;
    }

    const fenceMatch = line.match(RE_CODE_FENCE_OPEN);
    if (fenceMatch) {
      const fence = fenceMatch[2];
      fenceChar = fence[0];
      fenceLength = fence.length;
      out.push(line);
      continue;
    }

    out.push(replaceBadgeTagsInLine(line));
  }

  return out.join("\n");
}
