/**
 * Port of vuepress-theme-plume npm-to container transform (MIT).
 * Expands a single npm fence into ::: code-tabs with per-manager commands.
 */

import {
  ALLOW_LIST,
  BOOL_FLAGS,
  DEFAULT_TABS,
  MANAGERS_CONFIG,
  type CommandConfig,
  type CommandConfigItem,
  type NpmToPackageManager
} from "./npm-to-preset";

export type { NpmToPackageManager };

interface LineParsed {
  env: string;
  cli: string;
  cmd: string;
  args?: string;
  scriptArgs?: string;
}

const LINE_REG = /(.*)(npm|npx)\s+(.*)/;

function validateTabs(tabs: NpmToPackageManager[]): NpmToPackageManager[] {
  const filtered = tabs.filter((tab) =>
    (ALLOW_LIST as readonly string[]).includes(tab)
  ) as NpmToPackageManager[];
  return filtered.length === 0 ? [...DEFAULT_TABS] : filtered;
}

function findConfig(line: string): CommandConfig | undefined {
  for (const { pattern, ...config } of Object.values(MANAGERS_CONFIG)) {
    if (pattern.test(line)) {
      return config;
    }
  }
  return undefined;
}

export function parseLine(line: string): false | LineParsed {
  const match = line.match(LINE_REG);
  if (!match) {
    return false;
  }

  const [, env, cli, rest] = match;
  const idx = rest.trim().indexOf(" ");
  if (cli === "npx") {
    let cmd = "";
    let scriptArgs = "";
    if (idx !== -1) {
      cmd = rest.slice(0, idx);
      scriptArgs = rest.slice(idx + 1).trim();
    } else {
      cmd = rest;
    }
    return { env, cli, cmd, scriptArgs };
  }

  if (idx === -1) {
    return { env, cli: `${cli} ${rest.trim()}`, cmd: "" };
  }

  return { env, cli: `${cli} ${rest.slice(0, idx)}`, ...parseArgs(rest.slice(idx + 1)) };
}

function parseArgs(line: string): { cmd: string; args?: string; scriptArgs?: string } {
  line = line?.trim() ?? "";

  const [npmArgs = "", scriptArgs] = line.split(/\s+--\s+/);
  let cmd = "";
  let args = "";
  if (!npmArgs) {
    return { cmd: "", args: "", scriptArgs };
  }

  if (npmArgs[0] !== "-") {
    if (npmArgs[0] === '"' || npmArgs[0] === "'") {
      const q = npmArgs[0];
      const closeIdx = npmArgs.slice(1).indexOf(q);
      cmd = npmArgs.slice(0, closeIdx + 2);
      args = npmArgs.slice(closeIdx + 2);
    } else {
      const dashIdx = npmArgs.indexOf(" -");
      if (dashIdx === -1) {
        cmd = npmArgs;
      } else {
        cmd = npmArgs.slice(0, dashIdx);
        args = npmArgs.slice(dashIdx + 1);
      }
    }
  } else {
    let newLine = "";
    let value = "";
    let isQuote = false;
    let isBool = false;
    let isNextValue = false;
    let quote = "";
    for (let i = 0; i < npmArgs.length; i++) {
      const v = npmArgs[i];
      if (!isQuote && (v === '"' || v === "'")) {
        quote = v;
        isQuote = true;
        value += v;
      } else if (isQuote && v === quote) {
        isQuote = false;
        value += v;
      } else if ((v === " " || v === "=" || i === npmArgs.length - 1) && !isQuote && value) {
        if (i === npmArgs.length - 1) {
          value += v;
        }

        const isKey = value[0] === "-";
        if (isKey) {
          isBool = BOOL_FLAGS.includes(value);
          isNextValue = !isBool;
        }
        if (!isKey && !isNextValue) {
          cmd += ` ${value}`;
        } else {
          newLine += `${value}${i !== npmArgs.length - 1 ? v : ""}`;
          if (!isKey && isNextValue) {
            isNextValue = false;
          }
        }
        value = "";
      } else {
        value += v;
      }
    }
    args = newLine;
  }
  return { cmd: cmd.trim(), args: args.trim(), scriptArgs };
}

function resolveNpmTo(
  lines: string[],
  info: string,
  tabs: NpmToPackageManager[]
): string {
  const validTabs = validateTabs(tabs);
  const res: string[] = [];
  const map: Record<string, LineParsed | false> = {};

  for (const tab of validTabs) {
    const newLines: string[] = [];
    for (const line of lines) {
      const config = findConfig(line);
      if (tab !== "npm" && config && config[tab]) {
        const parsed = (map[line] ??= parseLine(line)) as LineParsed;
        const { cli, flags } = config[tab] as CommandConfigItem;

        let newLine = `${parsed.env ? `${parsed.env} ` : ""}${cli}`;
        if (parsed.args && flags) {
          let args = parsed.args;
          for (const [key, value] of Object.entries(flags)) {
            args = args.split(key).join(value);
          }
          newLine += ` ${args.replace(/\s+-/g, " -").trim()}`;
        }

        if (parsed.cmd) {
          newLine += ` ${parsed.cmd}`;
        }
        if (parsed.scriptArgs) {
          newLine += ` ${parsed.scriptArgs}`;
        }
        newLines.push(newLine.trim());
      } else {
        newLines.push(line);
      }
    }
    res.push(`@tab ${tab}\n\`\`\`${info}\n${newLines.join("")}\n\`\`\``);
  }

  return `:::code-tabs#npm-to-${validTabs.join("-")}\n${res.join("\n")}\n:::`;
}

/** Extract first fence from npm-to body; return lang + content lines. */
export function extractNpmFence(rawContent: string): { lang: string; body: string } | null {
  const lines = rawContent.replace(/^\n+|\n+$/g, "").split(/\r?\n/);
  let open = -1;
  let fence = "";
  let lang = "sh";
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!m) continue;
    if (open < 0) {
      open = i;
      fence = m[2];
      lang = (m[3] ?? "").trim() || "sh";
      continue;
    }
    if (new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`).test(lines[i])) {
      const body = lines.slice(open + 1, i).join("\n");
      return { lang, body: body.endsWith("\n") ? body : `${body}\n` };
    }
  }
  return null;
}

export function parseNpmToTabsAttr(rest: string): NpmToPackageManager[] {
  const match = rest.match(/\btabs=(?:"([^"]*)"|'([^']*)'|([^\s]+))/i);
  const raw = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
  if (!raw) {
    return [...DEFAULT_TABS];
  }
  return validateTabs(
    raw.split(/,\s*/).map((t) => t.trim().toLowerCase()) as NpmToPackageManager[]
  );
}

/** Convert npm-to container body into code-tabs markdown. */
export function npmToCodeTabsMarkdown(
  rawContent: string,
  tabs: NpmToPackageManager[]
): string | null {
  const fence = extractNpmFence(rawContent);
  if (!fence) {
    return null;
  }
  const lines = fence.body.split(/(\n|\s*&&\s*)/);
  return resolveNpmTo(lines, fence.lang, tabs);
}
