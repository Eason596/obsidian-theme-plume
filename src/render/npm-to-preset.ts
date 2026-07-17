/**
 * Port of vuepress-theme-plume plugin-md-power npmToPreset (MIT).
 */

export type NpmToPackageManager = "npm" | "pnpm" | "yarn" | "bun" | "deno";

export type PackageCommand =
  | "install"
  | "add"
  | "remove"
  | "run"
  | "create"
  | "init"
  | "npx"
  | "ci";

export interface CommandConfigItem {
  cli: string;
  flags?: Record<string, string>;
}

export type CommandConfig = Record<
  Exclude<NpmToPackageManager, "npm">,
  CommandConfigItem | false
>;

export type CommandConfigs = Record<PackageCommand, { pattern: RegExp } & CommandConfig>;

export const ALLOW_LIST: readonly NpmToPackageManager[] = [
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "deno"
];

export const BOOL_FLAGS: string[] = [
  "--no-save",
  "-B",
  "--save-bundle",
  "--save-dev",
  "-D",
  "--save-prod",
  "-P",
  "--save-peer",
  "-O",
  "--save-optional",
  "-E",
  "--save-exact",
  "-y",
  "--yes",
  "-g",
  "--global"
];

export const DEFAULT_TABS: NpmToPackageManager[] = ["npm", "pnpm", "yarn"];

export const MANAGERS_CONFIG: CommandConfigs = {
  install: {
    pattern: /(?:^|\s)npm\s+(?:install|i)$/,
    pnpm: { cli: "pnpm install" },
    yarn: { cli: "yarn" },
    bun: { cli: "bun install" },
    deno: { cli: "deno install" }
  },
  add: {
    pattern: /(?:^|\s)npm\s+(?:install|i|add)(?:\s|$)/,
    pnpm: {
      cli: "pnpm add",
      flags: {
        "--no-save": "",
        "-B": "",
        "--save-bundle": ""
      }
    },
    yarn: {
      cli: "yarn add",
      flags: {
        "--save-dev": "--dev",
        "--save-prod": "--prod",
        "-P": "",
        "--save-peer": "--peer",
        "--save-optional": "--optional",
        "--no-save": "",
        "--save-exact": "--exact",
        "-B": "",
        "--save-bundle": ""
      }
    },
    bun: {
      cli: "bun add",
      flags: {
        "--save-dev": "--development",
        "-P": "",
        "--save-prod": "",
        "--save-peer": "",
        "-O": "--optional",
        "--save-optional": "--optional",
        "--no-save": "",
        "--save-exact": "--exact",
        "-B": "",
        "--save-bundle": ""
      }
    },
    deno: {
      cli: "deno add",
      flags: {
        "-g": "",
        "--global": "",
        "--save-dev": "--dev",
        "-P": "",
        "--save-prod": "",
        "--save-peer": "",
        "-O": "",
        "--save-optional": "",
        "--no-save": "",
        "-E": "",
        "--save-exact": "",
        "-B": "",
        "--save-bundle": ""
      }
    }
  },
  run: {
    pattern: /(?:^|\s)npm\s+(?:run|run-script|rum|urn)(?:\s|$)/,
    pnpm: {
      cli: "pnpm",
      flags: {
        "-w": "-F",
        "--workspace": "--filter",
        "--": ""
      }
    },
    yarn: {
      cli: "yarn",
      flags: {
        "-w": "",
        "--workspace": ""
      }
    },
    bun: {
      cli: "bun run",
      flags: {
        "-w": "--filter",
        "--workspace": "--filter"
      }
    },
    deno: {
      cli: "deno run",
      flags: {
        "-w": "",
        "--workspace": ""
      }
    }
  },
  create: {
    pattern: /(?:^|\s)npm\s+create\s/,
    pnpm: { cli: "pnpm create", flags: { "-y": "", "--yes": "" } },
    yarn: { cli: "yarn create", flags: { "-y": "", "--yes": "" } },
    bun: { cli: "bun create", flags: { "-y": "", "--yes": "" } },
    deno: { cli: "deno run -A ", flags: { "-y": "", "--yes": "" } }
  },
  init: {
    pattern: /(?:^|\s)npm\s+init/,
    pnpm: { cli: "pnpm init", flags: { "-y": "", "--yes": "" } },
    yarn: { cli: "yarn init", flags: { "-y": "", "--yes": "" } },
    bun: { cli: "bun init", flags: { "-y": "", "--yes": "" } },
    deno: { cli: "deno init", flags: { "-y": "", "--yes": "" } }
  },
  npx: {
    pattern: /(?:^|\s)npx\s+/,
    pnpm: { cli: "pnpm dlx" },
    yarn: { cli: "yarn dlx" },
    bun: { cli: "bunx" },
    deno: { cli: "deno run -A" }
  },
  remove: {
    pattern: /(?:^|\s)npm\s+(?:uninstall|r|rm|remove|unlink|un)(?:\s|$)/,
    pnpm: {
      cli: "pnpm remove",
      flags: { "--no-save": "", "--save": "", "-S": "" }
    },
    yarn: {
      cli: "yarn remove",
      flags: {
        "--save-dev": "--dev",
        "--save": "",
        "-S": "",
        "-g": "",
        "--global": ""
      }
    },
    bun: {
      cli: "bun remove",
      flags: {
        "--save-dev": "--development",
        "--save": "",
        "-S": "",
        "-g": "",
        "--global": ""
      }
    },
    deno: {
      cli: "deno uninstall",
      flags: { "--save-dev": "--dev", "--save": "", "-S": "" }
    }
  },
  ci: {
    pattern: /(?:^|\s)npm\s+ci$/,
    pnpm: { cli: "pnpm install --frozen-lockfile" },
    yarn: { cli: "yarn install --frozen-lockfile" },
    bun: { cli: "bun install --frozen-lockfile" },
    deno: { cli: "deno install" }
  }
};
