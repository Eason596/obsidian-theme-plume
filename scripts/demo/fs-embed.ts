import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import type { CodeTreeFileItem } from "../../src/types";

const SKIP_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "avif",
  "webp",
  "mp3",
  "mp4",
  "ogg",
  "m3u8",
  "m3u",
  "flv",
  "webm",
  "wav",
  "flac",
  "aac",
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx"
]);

function getExtension(filepath: string): string {
  const base = filepath.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot + 1).toLowerCase();
}

function resolveEmbedDir(repoRoot: string, sourcePath: string, dirPath: string): string | null {
  const raw = dirPath.trim();
  if (!raw) {
    return null;
  }

  const sourceDir = dirname(resolve(repoRoot, sourcePath));

  if (raw.startsWith("/")) {
    return resolve(repoRoot, raw.slice(1));
  }
  if (raw.startsWith("@source/")) {
    return resolve(repoRoot, raw.slice("@source/".length));
  }
  if (raw.startsWith("./") || raw.startsWith("../")) {
    return resolve(sourceDir, raw);
  }
  return resolve(repoRoot, raw);
}

function collectFiles(dir: string, root: string, out: { relativePath: string; abs: string }[]): void {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === ".DS_Store") {
      continue;
    }
    const abs = join(dir, name);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      collectFiles(abs, root, out);
      continue;
    }
    const relativePath = relative(root, abs).split("\\").join("/");
    out.push({ relativePath, abs });
  }
}

export async function resolveCodeTreeEmbedFromDisk(
  repoRoot: string,
  sourcePath: string,
  dirPath: string
): Promise<CodeTreeFileItem[] | null> {
  const resolved = resolveEmbedDir(repoRoot, sourcePath, dirPath);
  if (!resolved) {
    return null;
  }

  let stat;
  try {
    stat = statSync(resolved);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) {
    return null;
  }

  const entries: { relativePath: string; abs: string }[] = [];
  collectFiles(resolved, resolved, entries);
  if (entries.length === 0) {
    return null;
  }

  const files: CodeTreeFileItem[] = [];
  for (const entry of entries) {
    const extension = getExtension(entry.relativePath);
    if (SKIP_EXTENSIONS.has(extension)) {
      continue;
    }
    try {
      const content = readFileSync(entry.abs, "utf8");
      files.push({
        filepath: entry.relativePath,
        language: extension || "txt",
        content
      });
    } catch {
      continue;
    }
  }

  return files.length > 0 ? files : null;
}

export function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith("---")) {
    return markdown;
  }
  const end = markdown.indexOf("\n---", 3);
  if (end === -1) {
    return markdown;
  }
  return markdown.slice(end + 4).replace(/^\n/, "");
}

export function preprocessDemoMarkdown(markdown: string): string {
  return markdown.replace(
    /```(?:file-tree|filetree|file_tree)\r?\n([\s\S]*?)```/g,
    (_match, body: string) => `::: file-tree\n${body.trim()}\n:::`
  );
}
