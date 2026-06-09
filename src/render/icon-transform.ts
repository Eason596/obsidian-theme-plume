import { createIconifySpanHtml } from "./iconify-online";

const RE_CODE_FENCE_OPEN = /^(\s*)(`{3,}|~{3,})(.*)$/;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseAttrValue(text: string, key: string): string | undefined {
  const attrRegex = new RegExp(`${key}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = text.match(attrRegex);
  if (!match) {
    return undefined;
  }

  return match[1] ?? match[2] ?? match[3] ?? undefined;
}

interface ResolvedInlineIcon {
  provider: string;
  name: string;
  size?: string;
  color?: string;
}

function resolveInlineIcon(content: string): ResolvedInlineIcon | null {
  let provider = "iconify";
  let size: string | undefined;
  let color: string | undefined;

  const cleaned = content
    .replace(/^(iconify|iconfont|fontawesome)\s+/i, (_matched, value: string) => {
      provider = value.toLowerCase();
      return "";
    })
    .replace(/(?<=\s|^)=(.+?)(?:\s|$)/, (_matched, value: string) => {
      size = value;
      return " ";
    })
    .replace(/(?<=\s|^)\/(.+?)(?:\s|$)/, (_matched, value: string) => {
      color = value;
      return " ";
    })
    .trim();

  if (provider !== "iconify") {
    return null;
  }

  const name = cleaned.split(/\s+/)[0] ?? "";
  if (!name || !name.includes(":")) {
    return null;
  }

  return { provider, name, size, color };
}

function buildIconHtml(icon: ResolvedInlineIcon): string | null {
  const style: string[] = [];
  if (icon.size) {
    const size = escapeHtml(icon.size);
    style.push(`font-size:${size}`, `width:${size}`, `height:${size}`);
  }
  if (icon.color) {
    style.push(`color:${escapeHtml(icon.color)}`);
  }
  return createIconifySpanHtml(icon.name, "vp-icon", style.join(";"));
}

function replaceIconTagsInLine(line: string): string {
  return line
    .replace(/<(?:Icon|VPIcon)\b([^>]*)\/>/gi, (matched, attrs: string) => {
      const provider = parseAttrValue(attrs, "provider") ?? "iconify";
      if (provider !== "iconify") {
        return matched;
      }
      const name = parseAttrValue(attrs, "name");
      if (!name) {
        return matched;
      }
      const html = buildIconHtml({
        provider,
        name,
        size: parseAttrValue(attrs, "size"),
        color: parseAttrValue(attrs, "color")
      });
      return html ?? matched;
    })
    .replace(/<(?:Icon|VPIcon)\b([^>]*)>\s*<\/(?:Icon|VPIcon)>/gi, (matched, attrs: string) => {
      const provider = parseAttrValue(attrs, "provider") ?? "iconify";
      if (provider !== "iconify") {
        return matched;
      }
      const name = parseAttrValue(attrs, "name");
      if (!name) {
        return matched;
      }
      const html = buildIconHtml({
        provider,
        name,
        size: parseAttrValue(attrs, "size"),
        color: parseAttrValue(attrs, "color")
      });
      return html ?? matched;
    });
}

function replaceInlineIconSyntaxInLine(line: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < line.length) {
    const start = line.indexOf("::", cursor);
    if (start === -1) {
      output += line.slice(cursor);
      break;
    }

    if (line[start + 2] === " " || line[start + 2] === ":") {
      output += line.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    const end = line.indexOf("::", start + 2);
    if (end === -1 || line[end - 1] === " ") {
      output += line.slice(cursor, start + 2);
      cursor = start + 2;
      continue;
    }

    const content = line.slice(start + 2, end);
    const icon = resolveInlineIcon(content);
    const html = icon ? buildIconHtml(icon) : null;
    output += line.slice(cursor, start);
    output += html ?? line.slice(start, end + 2);
    cursor = end + 2;
  }

  return output;
}

function replaceIconsInLine(line: string): string {
  return replaceInlineIconSyntaxInLine(replaceIconTagsInLine(line));
}

export function replaceIconSyntaxInMarkdown(markdown: string): string {
  if (!/(::[^:\s][\s\S]*?::|<(?:Icon|VPIcon)\b)/i.test(markdown)) {
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

    out.push(replaceIconsInLine(line));
  }

  return out.join("\n");
}
