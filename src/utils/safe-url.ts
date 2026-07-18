export type LinkHrefKind = "internal" | "external" | "unsafe";

export interface ClassifiedLinkHref {
  kind: LinkHrefKind;
  href: string;
}

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_EXTERNAL_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
const SAFE_RESOURCE_PROTOCOLS = new Set(["http:", "https:", "blob:"]);
const SAFE_IMAGE_DATA_RE = /^data:image\/(?:png|jpeg|gif|webp|avif);(?:base64|charset=[^,]+),/i;

export function classifyLinkHref(raw: string): ClassifiedLinkHref {
  const value = raw.trim();
  if (!value) return { kind: "unsafe", href: "" };
  if (value.startsWith("//")) {
    return { kind: "external", href: `https:${value}` };
  }
  if (!SCHEME_RE.test(value)) {
    return { kind: "internal", href: value };
  }
  try {
    const url = new URL(value);
    return SAFE_EXTERNAL_PROTOCOLS.has(url.protocol)
      ? { kind: "external", href: url.href }
      : { kind: "unsafe", href: "" };
  } catch {
    return { kind: "unsafe", href: "" };
  }
}

export function safeHttpUrl(raw: string): string | null {
  const classified = classifyLinkHref(raw);
  if (classified.kind !== "external") return null;
  try {
    const url = new URL(classified.href);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function safeResourceUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  try {
    const url = new URL(value);
    return SAFE_RESOURCE_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function safeImageUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (SAFE_IMAGE_DATA_RE.test(value)) return value;
  return safeResourceUrl(value);
}

export function safeLinkTarget(raw: string | undefined): "_blank" | "_self" {
  return raw?.trim().toLowerCase() === "_self" ? "_self" : "_blank";
}

export function safeExternalRel(raw: string | undefined, target: string): string {
  const tokens = new Set((raw ?? "").toLowerCase().split(/\s+/).filter(Boolean));
  if (target === "_blank") {
    tokens.add("noopener");
    tokens.add("noreferrer");
  }
  return Array.from(tokens).join(" ");
}
