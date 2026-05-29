import { VUEPRESS_FILE_ICON_RULES } from "./generated/vuepressFileIcons";

type OfflineIconSvgMap = Record<string, string>;

let offlineIconSvgMap: OfflineIconSvgMap | undefined;

/** Load colored offline SVG map on first use (simple icon mode skips this). */
function getOfflineIconSvgMap(): OfflineIconSvgMap {
  if (!offlineIconSvgMap) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    offlineIconSvgMap = require("./generated/offlineIconData").OFFLINE_ICON_SVGS as OfflineIconSvgMap;
  }
  return offlineIconSvgMap;
}

interface OfflineIconStyle {
  icon?: string | readonly string[];
  openIcon?: string | readonly string[];
}

const DEFAULT_FILE_OFFLINE_ICON = "vscode-icons:default-file";
const DEFAULT_FOLDER_OFFLINE_ICON = "vscode-icons:default-folder";
const DEFAULT_FOLDER_OPEN_OFFLINE_ICON = "vscode-icons:default-folder-opened";

const OFFLINE_CANDIDATES = {
  package: ["logos:npm-icon", "vscode-icons:file-type-npm", "vscode-icons:file-type-package", "vscode-icons:file-type-node"],
  lock: ["vscode-icons:file-type-package", "vscode-icons:file-type-json"],
  docs: ["vscode-icons:file-type-markdown", "vscode-icons:file-type-text"],
  security: ["logos:github-icon", "vscode-icons:file-type-config"],
  git: ["logos:git-icon", "vscode-icons:file-type-git"],
  env: ["vscode-icons:file-type-dotenv", "vscode-icons:file-type-config"],
  docker: ["logos:docker-icon", "vscode-icons:file-type-docker"],
  config: ["vscode-icons:file-type-config", "vscode-icons:file-type-tsconfig"],
  scripts: ["vscode-icons:file-type-shell", "vscode-icons:file-type-powershell", "vscode-icons:file-type-bat"],
  prettier: ["vscode-icons:file-type-light-prettier", "vscode-icons:file-type-prettier", "vscode-icons:file-type-config"],
  eslint: ["vscode-icons:file-type-eslint", "vscode-icons:file-type-eslint2", "vscode-icons:file-type-config"],
  stylelint: ["vscode-icons:file-type-light-stylelint", "vscode-icons:file-type-stylelint", "vscode-icons:file-type-config"],
  commitlint: ["vscode-icons:file-type-commitlint", "vscode-icons:file-type-config"],
  editorconfig: ["vscode-icons:file-type-editorconfig", "vscode-icons:file-type-config"],
  playwright: ["vscode-icons:file-type-playwright", "vscode-icons:file-type-jest"],
  cypress: ["vscode-icons:file-type-cypress", "vscode-icons:file-type-jest"],
  turbo: ["vscode-icons:file-type-light-turbo", "vscode-icons:file-type-config"],
  nx: ["vscode-icons:file-type-light-nx", "vscode-icons:file-type-config"],
  biome: ["vscode-icons:file-type-biome", "vscode-icons:file-type-config"],
  react: ["vscode-icons:file-type-reactjs", "vscode-icons:file-type-js-official"],
  next: ["vscode-icons:file-type-light-next", "vscode-icons:file-type-reactjs"],
  nuxt: ["vscode-icons:file-type-nuxt", "vscode-icons:file-type-vue"],
  svelte: ["vscode-icons:file-type-svelte", "vscode-icons:file-type-js-official"],
  astro: ["vscode-icons:file-type-light-astro", "vscode-icons:file-type-js-official"],
  deno: ["vscode-icons:file-type-light-deno", "vscode-icons:file-type-js-official"],
  python: ["vscode-icons:file-type-python", "vscode-icons:file-type-package"],
  go: ["vscode-icons:file-type-go-gopher", "vscode-icons:file-type-package"],
  cargo: ["vscode-icons:file-type-cargo", "vscode-icons:file-type-rust"],
  java: ["vscode-icons:file-type-java"],
  php: ["vscode-icons:file-type-php3"],
  c: ["vscode-icons:file-type-c"],
  cpp: ["vscode-icons:file-type-cpp"],
  csharp: ["vscode-icons:file-type-csharp"],
  kotlin: ["vscode-icons:file-type-kotlin"],
  ruby: ["vscode-icons:file-type-ruby"],
  swift: ["vscode-icons:file-type-swift"],
  zig: ["vscode-icons:file-type-zig"],
  wasm: ["vscode-icons:file-type-wasm"],
  mysql: ["vscode-icons:file-type-mysql", "vscode-icons:file-type-sql"],
  pgsql: ["vscode-icons:file-type-pgsql", "vscode-icons:file-type-sql"],

  srcFolder: ["vscode-icons:folder-type-src"],
  srcFolderOpen: ["vscode-icons:folder-type-src-opened", "vscode-icons:folder-type-src"],
  docsFolder: ["vscode-icons:folder-type-docs"],
  docsFolderOpen: ["vscode-icons:folder-type-docs-opened", "vscode-icons:folder-type-docs"],
  testFolder: ["vscode-icons:folder-type-test"],
  testFolderOpen: ["vscode-icons:folder-type-test-opened", "vscode-icons:folder-type-test"],
  distFolder: ["vscode-icons:folder-type-dist"],
  distFolderOpen: ["vscode-icons:folder-type-dist-opened", "vscode-icons:folder-type-dist"],
  publicFolder: ["vscode-icons:folder-type-public"],
  publicFolderOpen: ["vscode-icons:folder-type-public-opened", "vscode-icons:folder-type-public"],
  imagesFolder: ["vscode-icons:folder-type-images"],
  imagesFolderOpen: ["vscode-icons:folder-type-images-opened", "vscode-icons:folder-type-images"],
  assetsFolder: ["vscode-icons:folder-type-asset"],
  assetsFolderOpen: ["vscode-icons:folder-type-asset-opened", "vscode-icons:folder-type-asset"],
  scriptsFolder: ["vscode-icons:folder-type-script"],
  scriptsFolderOpen: ["vscode-icons:folder-type-script-opened", "vscode-icons:folder-type-script"],
  configFolder: ["vscode-icons:folder-type-config"],
  configFolderOpen: ["vscode-icons:folder-type-config-opened", "vscode-icons:folder-type-config"],
  nodeModulesFolder: ["vscode-icons:folder-type-light-node"],
  nodeModulesFolderOpen: ["vscode-icons:folder-type-light-node-opened", "vscode-icons:folder-type-light-node"],
  styleFolder: ["vscode-icons:folder-type-theme"],
  styleFolderOpen: ["vscode-icons:folder-type-theme-opened", "vscode-icons:folder-type-theme"],
  databaseFolder: ["vscode-icons:folder-type-db"],
  databaseFolderOpen: ["vscode-icons:folder-type-db-opened", "vscode-icons:folder-type-db"],
  componentFolder: ["vscode-icons:folder-type-component"],
  componentFolderOpen: ["vscode-icons:folder-type-component-opened", "vscode-icons:folder-type-component"],
  hookFolder: ["vscode-icons:folder-type-hook"],
  hookFolderOpen: ["vscode-icons:folder-type-hook-opened", "vscode-icons:folder-type-hook"],
  apiFolder: ["vscode-icons:folder-type-api"],
  apiFolderOpen: ["vscode-icons:folder-type-api-opened", "vscode-icons:folder-type-api"],
  serverFolder: ["vscode-icons:folder-type-server"],
  serverFolderOpen: ["vscode-icons:folder-type-server-opened", "vscode-icons:folder-type-server"],
  clientFolder: ["vscode-icons:folder-type-client"],
  clientFolderOpen: ["vscode-icons:folder-type-client-opened", "vscode-icons:folder-type-client"],
  libraryFolder: ["vscode-icons:folder-type-library"],
  libraryFolderOpen: ["vscode-icons:folder-type-library-opened", "vscode-icons:folder-type-library"],
  includeFolder: ["vscode-icons:folder-type-include"],
  includeFolderOpen: ["vscode-icons:folder-type-include-opened", "vscode-icons:folder-type-include"],
  localeFolder: ["vscode-icons:folder-type-locale"],
  localeFolderOpen: ["vscode-icons:folder-type-locale-opened", "vscode-icons:folder-type-locale"],
  pluginFolder: ["vscode-icons:folder-type-plugin"],
  pluginFolderOpen: ["vscode-icons:folder-type-plugin-opened", "vscode-icons:folder-type-plugin"],
  packageFolder: ["vscode-icons:folder-type-package"],
  packageFolderOpen: ["vscode-icons:folder-type-package-opened", "vscode-icons:folder-type-package"],
  appFolder: ["vscode-icons:folder-type-app"],
  appFolderOpen: ["vscode-icons:folder-type-app-opened", "vscode-icons:folder-type-app"],
  viewFolder: ["vscode-icons:folder-type-view"],
  viewFolderOpen: ["vscode-icons:folder-type-view-opened", "vscode-icons:folder-type-view"],
  modelFolder: ["vscode-icons:folder-type-model"],
  modelFolderOpen: ["vscode-icons:folder-type-model-opened", "vscode-icons:folder-type-model"],
  controllerFolder: ["vscode-icons:folder-type-controller"],
  controllerFolderOpen: ["vscode-icons:folder-type-controller-opened", "vscode-icons:folder-type-controller"],
  servicesFolder: ["vscode-icons:folder-type-services"],
  servicesFolderOpen: ["vscode-icons:folder-type-services-opened", "vscode-icons:folder-type-services"],

  typescript: ["vscode-icons:file-type-typescript-official"],
  javascript: ["vscode-icons:file-type-js-official"],
  vue: ["vscode-icons:file-type-vue"],
  svelteType: ["vscode-icons:file-type-svelte"],
  astroType: ["vscode-icons:file-type-light-astro"],
  reactType: ["vscode-icons:file-type-reactjs"],
  denoType: ["vscode-icons:file-type-light-deno"],
  markdown: ["vscode-icons:file-type-markdown"],
  text: ["vscode-icons:file-type-text"],
  pdf: ["vscode-icons:file-type-pdf2", "vscode-icons:file-type-text"],
  json: ["vscode-icons:file-type-json"],
  yaml: ["vscode-icons:file-type-light-yaml"],
  toml: ["vscode-icons:file-type-light-toml"],
  ini: ["vscode-icons:file-type-light-ini", "vscode-icons:file-type-config"],
  css: ["vscode-icons:file-type-css"],
  scss: ["vscode-icons:file-type-scss", "vscode-icons:file-type-css"],
  less: ["vscode-icons:file-type-less", "vscode-icons:file-type-css"],
  stylus: ["vscode-icons:file-type-light-stylus", "vscode-icons:file-type-css"],
  html: ["vscode-icons:file-type-html"],
  xml: ["vscode-icons:file-type-xml"],
  svg: ["vscode-icons:file-type-svg", "vscode-icons:file-type-image"],
  image: ["vscode-icons:file-type-image"],
  video: ["vscode-icons:file-type-video"],
  audio: ["vscode-icons:file-type-audio"],
  archive: ["vscode-icons:file-type-zip"],
  database: ["vscode-icons:file-type-db", "vscode-icons:file-type-sql", "vscode-icons:file-type-sqlite"],
  shell: ["vscode-icons:file-type-shell"],
  powershell: ["vscode-icons:file-type-powershell", "vscode-icons:file-type-shell"],
  batch: ["vscode-icons:file-type-bat", "vscode-icons:file-type-shell"],
  javaType: ["vscode-icons:file-type-java"],
  phpType: ["vscode-icons:file-type-php3"],
  cType: ["vscode-icons:file-type-c"],
  cppType: ["vscode-icons:file-type-cpp"],
  csharpType: ["vscode-icons:file-type-csharp"],
  kotlinType: ["vscode-icons:file-type-kotlin"],
  rubyType: ["vscode-icons:file-type-ruby"],
  swiftType: ["vscode-icons:file-type-swift"],
  zigType: ["vscode-icons:file-type-zig"],
  wasmType: ["vscode-icons:file-type-wasm"],
  mysqlType: ["vscode-icons:file-type-mysql", "vscode-icons:file-type-sql"],
  pgsqlType: ["vscode-icons:file-type-pgsql", "vscode-icons:file-type-sql"]
} as const;

const OFFLINE_NAMED_FILE_STYLES: Record<string, OfflineIconStyle> = {
  "package.json": { icon: OFFLINE_CANDIDATES.package },
  "npm-shrinkwrap.json": { icon: OFFLINE_CANDIDATES.lock },
  "pnpm-workspace.yaml": { icon: "vscode-icons:file-type-light-pnpm" },
  "pnpm-workspace.yml": { icon: "vscode-icons:file-type-light-pnpm" },
  "package-lock.json": { icon: OFFLINE_CANDIDATES.lock },
  "pnpm-lock.yaml": { icon: "vscode-icons:file-type-light-pnpm" },
  "yarn.lock": { icon: "vscode-icons:file-type-yarn" },
  "bun.lockb": { icon: "vscode-icons:file-type-bun" },
  "pnpmfile.cjs": { icon: "vscode-icons:file-type-light-pnpm" },
  "pnpmfile.mjs": { icon: "vscode-icons:file-type-light-pnpm" },
  ".npmrc": { icon: "vscode-icons:file-type-npm" },
  ".yarnrc": { icon: "vscode-icons:file-type-yarn" },
  ".yarnrc.yml": { icon: "vscode-icons:file-type-yarn" },
  "bunfig.toml": { icon: "vscode-icons:file-type-bunfig" },
  "deno.json": { icon: OFFLINE_CANDIDATES.deno },
  "deno.jsonc": { icon: OFFLINE_CANDIDATES.deno },
  "turbo.json": { icon: OFFLINE_CANDIDATES.turbo },
  "nx.json": { icon: OFFLINE_CANDIDATES.nx },
  "biome.json": { icon: OFFLINE_CANDIDATES.biome },
  "biome.jsonc": { icon: OFFLINE_CANDIDATES.biome },

  "readme": { icon: OFFLINE_CANDIDATES.docs },
  "readme.md": { icon: OFFLINE_CANDIDATES.docs },
  "readme.mdx": { icon: OFFLINE_CANDIDATES.docs },
  "changelog.md": { icon: OFFLINE_CANDIDATES.docs },
  "contributing.md": { icon: OFFLINE_CANDIDATES.docs },
  "license": { icon: "vscode-icons:file-type-license" },
  "license.md": { icon: "vscode-icons:file-type-license" },
  "security.md": { icon: OFFLINE_CANDIDATES.security },

  ".gitignore": { icon: OFFLINE_CANDIDATES.git },
  ".gitattributes": { icon: OFFLINE_CANDIDATES.git },
  ".gitmodules": { icon: OFFLINE_CANDIDATES.git },

  ".env": { icon: OFFLINE_CANDIDATES.env },
  ".env.local": { icon: OFFLINE_CANDIDATES.env },
  ".env.development": { icon: OFFLINE_CANDIDATES.env },
  ".env.production": { icon: OFFLINE_CANDIDATES.env },
  ".env.example": { icon: OFFLINE_CANDIDATES.env },

  "dockerfile": { icon: OFFLINE_CANDIDATES.docker },
  "docker-compose.yml": { icon: OFFLINE_CANDIDATES.docker },
  "docker-compose.yaml": { icon: OFFLINE_CANDIDATES.docker },
  "docker-compose.override.yml": { icon: OFFLINE_CANDIDATES.docker },
  "docker-compose.override.yaml": { icon: OFFLINE_CANDIDATES.docker },
  ".dockerignore": { icon: OFFLINE_CANDIDATES.docker },

  "tsconfig.json": { icon: "vscode-icons:file-type-tsconfig" },
  "tsconfig.base.json": { icon: "vscode-icons:file-type-tsconfig" },
  "jsconfig.json": { icon: "vscode-icons:file-type-jsconfig" },
  "vite.config.ts": { icon: "vscode-icons:file-type-vite" },
  "vite.config.js": { icon: "vscode-icons:file-type-vite" },
  "webpack.config.js": { icon: "vscode-icons:file-type-webpack" },
  "rollup.config.js": { icon: "vscode-icons:file-type-rollup" },
  "eslint.config.js": { icon: OFFLINE_CANDIDATES.eslint },
  "eslint.config.mjs": { icon: OFFLINE_CANDIDATES.eslint },
  "eslint.config.cjs": { icon: OFFLINE_CANDIDATES.eslint },
  "prettier.config.js": { icon: OFFLINE_CANDIDATES.prettier },
  "prettier.config.mjs": { icon: OFFLINE_CANDIDATES.prettier },
  "prettier.config.cjs": { icon: OFFLINE_CANDIDATES.prettier },
  "stylelint.config.js": { icon: OFFLINE_CANDIDATES.stylelint },
  "stylelint.config.mjs": { icon: OFFLINE_CANDIDATES.stylelint },
  "stylelint.config.cjs": { icon: OFFLINE_CANDIDATES.stylelint },
  "vitest.config.ts": { icon: "vscode-icons:file-type-vitest" },
  "jest.config.js": { icon: "vscode-icons:file-type-jest" },
  "playwright.config.ts": { icon: OFFLINE_CANDIDATES.playwright },
  "playwright.config.js": { icon: OFFLINE_CANDIDATES.playwright },
  "playwright.config.mts": { icon: OFFLINE_CANDIDATES.playwright },
  "playwright.config.mjs": { icon: OFFLINE_CANDIDATES.playwright },
  "cypress.config.ts": { icon: OFFLINE_CANDIDATES.cypress },
  "cypress.config.js": { icon: OFFLINE_CANDIDATES.cypress },
  "cypress.config.mts": { icon: OFFLINE_CANDIDATES.cypress },
  "cypress.config.mjs": { icon: OFFLINE_CANDIDATES.cypress },
  "commitlint.config.js": { icon: OFFLINE_CANDIDATES.commitlint },
  "commitlint.config.cjs": { icon: OFFLINE_CANDIDATES.commitlint },
  "commitlint.config.mjs": { icon: OFFLINE_CANDIDATES.commitlint },
  "commitlint.config.ts": { icon: OFFLINE_CANDIDATES.commitlint },
  ".editorconfig": { icon: OFFLINE_CANDIDATES.editorconfig },
  ".eslintrc": { icon: OFFLINE_CANDIDATES.eslint },
  ".eslintrc.js": { icon: OFFLINE_CANDIDATES.eslint },
  ".eslintrc.cjs": { icon: OFFLINE_CANDIDATES.eslint },
  ".eslintrc.yml": { icon: OFFLINE_CANDIDATES.eslint },
  ".eslintrc.yaml": { icon: OFFLINE_CANDIDATES.eslint },
  ".eslintrc.json": { icon: OFFLINE_CANDIDATES.eslint },
  ".prettierrc": { icon: OFFLINE_CANDIDATES.prettier },
  ".prettierrc.js": { icon: OFFLINE_CANDIDATES.prettier },
  ".prettierrc.cjs": { icon: OFFLINE_CANDIDATES.prettier },
  ".prettierrc.yml": { icon: OFFLINE_CANDIDATES.prettier },
  ".prettierrc.yaml": { icon: OFFLINE_CANDIDATES.prettier },
  ".prettierrc.json": { icon: OFFLINE_CANDIDATES.prettier },
  ".stylelintrc": { icon: OFFLINE_CANDIDATES.stylelint },
  ".stylelintrc.js": { icon: OFFLINE_CANDIDATES.stylelint },
  ".stylelintrc.cjs": { icon: OFFLINE_CANDIDATES.stylelint },
  ".stylelintrc.yml": { icon: OFFLINE_CANDIDATES.stylelint },
  ".stylelintrc.yaml": { icon: OFFLINE_CANDIDATES.stylelint },
  ".stylelintrc.json": { icon: OFFLINE_CANDIDATES.stylelint },
  "tailwind.config.js": { icon: "vscode-icons:file-type-tailwind" },
  "postcss.config.js": { icon: "vscode-icons:file-type-postcss" },

  "makefile": { icon: OFFLINE_CANDIDATES.scripts },
  ".nvmrc": { icon: OFFLINE_CANDIDATES.package },
  ".node-version": { icon: OFFLINE_CANDIDATES.package },
  "requirements.txt": { icon: OFFLINE_CANDIDATES.python },
  ".python-version": { icon: OFFLINE_CANDIDATES.python },
  "pyproject.toml": { icon: OFFLINE_CANDIDATES.python },
  "poetry.lock": { icon: OFFLINE_CANDIDATES.python },
  "gemfile": { icon: OFFLINE_CANDIDATES.ruby },
  "gemfile.lock": { icon: OFFLINE_CANDIDATES.ruby },
  ".ruby-version": { icon: OFFLINE_CANDIDATES.ruby },
  "go.mod": { icon: OFFLINE_CANDIDATES.go },
  "go.sum": { icon: OFFLINE_CANDIDATES.go },
  "cargo.toml": { icon: OFFLINE_CANDIDATES.cargo },
  "cargo.lock": { icon: OFFLINE_CANDIDATES.cargo },
  "composer.json": { icon: OFFLINE_CANDIDATES.php },
  "composer.lock": { icon: OFFLINE_CANDIDATES.php },
  "pom.xml": { icon: OFFLINE_CANDIDATES.java },
  "build.gradle": { icon: OFFLINE_CANDIDATES.java },
  "build.gradle.kts": { icon: OFFLINE_CANDIDATES.kotlin },
  "settings.gradle": { icon: OFFLINE_CANDIDATES.java },
  "settings.gradle.kts": { icon: OFFLINE_CANDIDATES.kotlin }
};

const OFFLINE_FOLDER_STYLES: Record<string, OfflineIconStyle> = {
  src: { icon: OFFLINE_CANDIDATES.srcFolder, openIcon: OFFLINE_CANDIDATES.srcFolderOpen },
  source: { icon: OFFLINE_CANDIDATES.srcFolder, openIcon: OFFLINE_CANDIDATES.srcFolderOpen },
  docs: { icon: OFFLINE_CANDIDATES.docsFolder, openIcon: OFFLINE_CANDIDATES.docsFolderOpen },
  doc: { icon: OFFLINE_CANDIDATES.docsFolder, openIcon: OFFLINE_CANDIDATES.docsFolderOpen },
  blog: { icon: OFFLINE_CANDIDATES.docsFolder, openIcon: OFFLINE_CANDIDATES.docsFolderOpen },
  test: { icon: OFFLINE_CANDIDATES.testFolder, openIcon: OFFLINE_CANDIDATES.testFolderOpen },
  tests: { icon: OFFLINE_CANDIDATES.testFolder, openIcon: OFFLINE_CANDIDATES.testFolderOpen },
  __tests__: { icon: OFFLINE_CANDIDATES.testFolder, openIcon: OFFLINE_CANDIDATES.testFolderOpen },
  dist: { icon: OFFLINE_CANDIDATES.distFolder, openIcon: OFFLINE_CANDIDATES.distFolderOpen },
  build: { icon: OFFLINE_CANDIDATES.distFolder, openIcon: OFFLINE_CANDIDATES.distFolderOpen },
  out: { icon: OFFLINE_CANDIDATES.distFolder, openIcon: OFFLINE_CANDIDATES.distFolderOpen },
  public: { icon: OFFLINE_CANDIDATES.publicFolder, openIcon: OFFLINE_CANDIDATES.publicFolderOpen },
  assets: { icon: OFFLINE_CANDIDATES.assetsFolder, openIcon: OFFLINE_CANDIDATES.assetsFolderOpen },
  images: { icon: OFFLINE_CANDIDATES.imagesFolder, openIcon: OFFLINE_CANDIDATES.imagesFolderOpen },
  img: { icon: OFFLINE_CANDIDATES.imagesFolder, openIcon: OFFLINE_CANDIDATES.imagesFolderOpen },
  scripts: { icon: OFFLINE_CANDIDATES.scriptsFolder, openIcon: OFFLINE_CANDIDATES.scriptsFolderOpen },
  script: { icon: OFFLINE_CANDIDATES.scriptsFolder, openIcon: OFFLINE_CANDIDATES.scriptsFolderOpen },
  config: { icon: OFFLINE_CANDIDATES.configFolder, openIcon: OFFLINE_CANDIDATES.configFolderOpen },
  node_modules: { icon: OFFLINE_CANDIDATES.nodeModulesFolder, openIcon: OFFLINE_CANDIDATES.nodeModulesFolderOpen },
  style: { icon: OFFLINE_CANDIDATES.styleFolder, openIcon: OFFLINE_CANDIDATES.styleFolderOpen },
  styles: { icon: OFFLINE_CANDIDATES.styleFolder, openIcon: OFFLINE_CANDIDATES.styleFolderOpen },
  database: { icon: OFFLINE_CANDIDATES.databaseFolder, openIcon: OFFLINE_CANDIDATES.databaseFolderOpen },
  db: { icon: OFFLINE_CANDIDATES.databaseFolder, openIcon: OFFLINE_CANDIDATES.databaseFolderOpen },
  component: { icon: OFFLINE_CANDIDATES.componentFolder, openIcon: OFFLINE_CANDIDATES.componentFolderOpen },
  components: { icon: OFFLINE_CANDIDATES.componentFolder, openIcon: OFFLINE_CANDIDATES.componentFolderOpen },
  hook: { icon: OFFLINE_CANDIDATES.hookFolder, openIcon: OFFLINE_CANDIDATES.hookFolderOpen },
  hooks: { icon: OFFLINE_CANDIDATES.hookFolder, openIcon: OFFLINE_CANDIDATES.hookFolderOpen },
  composable: { icon: OFFLINE_CANDIDATES.hookFolder, openIcon: OFFLINE_CANDIDATES.hookFolderOpen },
  composables: { icon: OFFLINE_CANDIDATES.hookFolder, openIcon: OFFLINE_CANDIDATES.hookFolderOpen },
  api: { icon: OFFLINE_CANDIDATES.apiFolder, openIcon: OFFLINE_CANDIDATES.apiFolderOpen },
  apis: { icon: OFFLINE_CANDIDATES.apiFolder, openIcon: OFFLINE_CANDIDATES.apiFolderOpen },
  server: { icon: OFFLINE_CANDIDATES.serverFolder, openIcon: OFFLINE_CANDIDATES.serverFolderOpen },
  servers: { icon: OFFLINE_CANDIDATES.serverFolder, openIcon: OFFLINE_CANDIDATES.serverFolderOpen },
  backend: { icon: OFFLINE_CANDIDATES.serverFolder, openIcon: OFFLINE_CANDIDATES.serverFolderOpen },
  backends: { icon: OFFLINE_CANDIDATES.serverFolder, openIcon: OFFLINE_CANDIDATES.serverFolderOpen },
  client: { icon: OFFLINE_CANDIDATES.clientFolder, openIcon: OFFLINE_CANDIDATES.clientFolderOpen },
  clients: { icon: OFFLINE_CANDIDATES.clientFolder, openIcon: OFFLINE_CANDIDATES.clientFolderOpen },
  frontend: { icon: OFFLINE_CANDIDATES.clientFolder, openIcon: OFFLINE_CANDIDATES.clientFolderOpen },
  frontends: { icon: OFFLINE_CANDIDATES.clientFolder, openIcon: OFFLINE_CANDIDATES.clientFolderOpen },
  lib: { icon: OFFLINE_CANDIDATES.libraryFolder, openIcon: OFFLINE_CANDIDATES.libraryFolderOpen },
  libs: { icon: OFFLINE_CANDIDATES.libraryFolder, openIcon: OFFLINE_CANDIDATES.libraryFolderOpen },
  library: { icon: OFFLINE_CANDIDATES.libraryFolder, openIcon: OFFLINE_CANDIDATES.libraryFolderOpen },
  libraries: { icon: OFFLINE_CANDIDATES.libraryFolder, openIcon: OFFLINE_CANDIDATES.libraryFolderOpen },
  include: { icon: OFFLINE_CANDIDATES.includeFolder, openIcon: OFFLINE_CANDIDATES.includeFolderOpen },
  includes: { icon: OFFLINE_CANDIDATES.includeFolder, openIcon: OFFLINE_CANDIDATES.includeFolderOpen },
  locale: { icon: OFFLINE_CANDIDATES.localeFolder, openIcon: OFFLINE_CANDIDATES.localeFolderOpen },
  locales: { icon: OFFLINE_CANDIDATES.localeFolder, openIcon: OFFLINE_CANDIDATES.localeFolderOpen },
  i18n: { icon: OFFLINE_CANDIDATES.localeFolder, openIcon: OFFLINE_CANDIDATES.localeFolderOpen },
  plugin: { icon: OFFLINE_CANDIDATES.pluginFolder, openIcon: OFFLINE_CANDIDATES.pluginFolderOpen },
  plugins: { icon: OFFLINE_CANDIDATES.pluginFolder, openIcon: OFFLINE_CANDIDATES.pluginFolderOpen },
  package: { icon: OFFLINE_CANDIDATES.packageFolder, openIcon: OFFLINE_CANDIDATES.packageFolderOpen },
  packages: { icon: OFFLINE_CANDIDATES.packageFolder, openIcon: OFFLINE_CANDIDATES.packageFolderOpen },
  app: { icon: OFFLINE_CANDIDATES.appFolder, openIcon: OFFLINE_CANDIDATES.appFolderOpen },
  apps: { icon: OFFLINE_CANDIDATES.appFolder, openIcon: OFFLINE_CANDIDATES.appFolderOpen },
  view: { icon: OFFLINE_CANDIDATES.viewFolder, openIcon: OFFLINE_CANDIDATES.viewFolderOpen },
  views: { icon: OFFLINE_CANDIDATES.viewFolder, openIcon: OFFLINE_CANDIDATES.viewFolderOpen },
  page: { icon: OFFLINE_CANDIDATES.viewFolder, openIcon: OFFLINE_CANDIDATES.viewFolderOpen },
  pages: { icon: OFFLINE_CANDIDATES.viewFolder, openIcon: OFFLINE_CANDIDATES.viewFolderOpen },
  model: { icon: OFFLINE_CANDIDATES.modelFolder, openIcon: OFFLINE_CANDIDATES.modelFolderOpen },
  models: { icon: OFFLINE_CANDIDATES.modelFolder, openIcon: OFFLINE_CANDIDATES.modelFolderOpen },
  controller: { icon: OFFLINE_CANDIDATES.controllerFolder, openIcon: OFFLINE_CANDIDATES.controllerFolderOpen },
  controllers: { icon: OFFLINE_CANDIDATES.controllerFolder, openIcon: OFFLINE_CANDIDATES.controllerFolderOpen },
  service: { icon: OFFLINE_CANDIDATES.servicesFolder, openIcon: OFFLINE_CANDIDATES.servicesFolderOpen },
  services: { icon: OFFLINE_CANDIDATES.servicesFolder, openIcon: OFFLINE_CANDIDATES.servicesFolderOpen }
};

const OFFLINE_EXTENSION_STYLES: Record<string, OfflineIconStyle> = {
  ".d.ts": { icon: OFFLINE_CANDIDATES.typescript },
  ".ts": { icon: OFFLINE_CANDIDATES.typescript },
  ".tsx": { icon: OFFLINE_CANDIDATES.typescript },
  ".mts": { icon: OFFLINE_CANDIDATES.typescript },
  ".cts": { icon: OFFLINE_CANDIDATES.typescript },

  ".js": { icon: OFFLINE_CANDIDATES.javascript },
  ".jsx": { icon: OFFLINE_CANDIDATES.javascript },
  ".mjs": { icon: OFFLINE_CANDIDATES.javascript },
  ".cjs": { icon: OFFLINE_CANDIDATES.javascript },

  ".react.tsx": { icon: OFFLINE_CANDIDATES.reactType },
  ".react.jsx": { icon: OFFLINE_CANDIDATES.reactType },
  ".vue": { icon: OFFLINE_CANDIDATES.vue },
  ".svelte": { icon: OFFLINE_CANDIDATES.svelteType },
  ".astro": { icon: OFFLINE_CANDIDATES.astroType },

  ".md": { icon: OFFLINE_CANDIDATES.markdown },
  ".mdx": { icon: OFFLINE_CANDIDATES.markdown },
  ".txt": { icon: OFFLINE_CANDIDATES.text },
  ".pdf": { icon: OFFLINE_CANDIDATES.pdf },

  ".json": { icon: OFFLINE_CANDIDATES.json },
  ".jsonc": { icon: OFFLINE_CANDIDATES.json },
  ".yaml": { icon: OFFLINE_CANDIDATES.yaml },
  ".yml": { icon: OFFLINE_CANDIDATES.yaml },
  ".toml": { icon: OFFLINE_CANDIDATES.toml },
  ".ini": { icon: OFFLINE_CANDIDATES.ini },
  ".conf": { icon: OFFLINE_CANDIDATES.ini },

  ".css": { icon: OFFLINE_CANDIDATES.css },
  ".scss": { icon: OFFLINE_CANDIDATES.scss },
  ".sass": { icon: OFFLINE_CANDIDATES.scss },
  ".less": { icon: OFFLINE_CANDIDATES.less },
  ".styl": { icon: OFFLINE_CANDIDATES.stylus },

  ".html": { icon: OFFLINE_CANDIDATES.html },
  ".xml": { icon: OFFLINE_CANDIDATES.xml },
  ".svg": { icon: OFFLINE_CANDIDATES.svg },

  ".png": { icon: OFFLINE_CANDIDATES.image },
  ".jpg": { icon: OFFLINE_CANDIDATES.image },
  ".jpeg": { icon: OFFLINE_CANDIDATES.image },
  ".gif": { icon: OFFLINE_CANDIDATES.image },
  ".webp": { icon: OFFLINE_CANDIDATES.image },
  ".avif": { icon: OFFLINE_CANDIDATES.image },

  ".mp4": { icon: OFFLINE_CANDIDATES.video },
  ".mov": { icon: OFFLINE_CANDIDATES.video },
  ".avi": { icon: OFFLINE_CANDIDATES.video },
  ".webm": { icon: OFFLINE_CANDIDATES.video },

  ".mp3": { icon: OFFLINE_CANDIDATES.audio },
  ".wav": { icon: OFFLINE_CANDIDATES.audio },
  ".ogg": { icon: OFFLINE_CANDIDATES.audio },
  ".m4a": { icon: OFFLINE_CANDIDATES.audio },

  ".zip": { icon: OFFLINE_CANDIDATES.archive },
  ".rar": { icon: OFFLINE_CANDIDATES.archive },
  ".7z": { icon: OFFLINE_CANDIDATES.archive },
  ".gz": { icon: OFFLINE_CANDIDATES.archive },
  ".tar": { icon: OFFLINE_CANDIDATES.archive },

  ".sql": { icon: OFFLINE_CANDIDATES.database },
  ".sqlite": { icon: OFFLINE_CANDIDATES.database },
  ".db": { icon: OFFLINE_CANDIDATES.database },
  ".mysql": { icon: OFFLINE_CANDIDATES.mysqlType },
  ".pgsql": { icon: OFFLINE_CANDIDATES.pgsqlType },

  ".java": { icon: OFFLINE_CANDIDATES.javaType },
  ".php": { icon: OFFLINE_CANDIDATES.phpType },
  ".c": { icon: OFFLINE_CANDIDATES.cType },
  ".h": { icon: OFFLINE_CANDIDATES.cType },
  ".cpp": { icon: OFFLINE_CANDIDATES.cppType },
  ".cc": { icon: OFFLINE_CANDIDATES.cppType },
  ".cxx": { icon: OFFLINE_CANDIDATES.cppType },
  ".hpp": { icon: OFFLINE_CANDIDATES.cppType },
  ".cs": { icon: OFFLINE_CANDIDATES.csharpType },
  ".kt": { icon: OFFLINE_CANDIDATES.kotlinType },
  ".kts": { icon: OFFLINE_CANDIDATES.kotlinType },
  ".rb": { icon: OFFLINE_CANDIDATES.rubyType },
  ".swift": { icon: OFFLINE_CANDIDATES.swiftType },
  ".zig": { icon: OFFLINE_CANDIDATES.zigType },
  ".wasm": { icon: OFFLINE_CANDIDATES.wasmType },

  ".sh": { icon: OFFLINE_CANDIDATES.shell },
  ".bash": { icon: OFFLINE_CANDIDATES.shell },
  ".zsh": { icon: OFFLINE_CANDIDATES.shell },
  ".ps1": { icon: OFFLINE_CANDIDATES.powershell },
  ".bat": { icon: OFFLINE_CANDIDATES.batch },
  ".cmd": { icon: OFFLINE_CANDIDATES.batch }
};

const OFFLINE_PARTIAL_STYLES: Array<{ include: string; style: OfflineIconStyle }> = [
  { include: "test", style: { icon: "vscode-icons:file-type-jest" } },
  { include: "spec", style: { icon: "vscode-icons:file-type-jest" } },
  { include: "mock", style: { icon: "vscode-icons:file-type-jest" } },
  { include: "playwright", style: { icon: OFFLINE_CANDIDATES.playwright } },
  { include: "cypress", style: { icon: OFFLINE_CANDIDATES.cypress } },
  { include: "config", style: { icon: OFFLINE_CANDIDATES.config } },
  { include: "eslint", style: { icon: OFFLINE_CANDIDATES.eslint } },
  { include: "prettier", style: { icon: OFFLINE_CANDIDATES.prettier } },
  { include: "stylelint", style: { icon: OFFLINE_CANDIDATES.stylelint } },
  { include: "commitlint", style: { icon: OFFLINE_CANDIDATES.commitlint } },
  { include: "biome", style: { icon: OFFLINE_CANDIDATES.biome } },
  { include: "turbo", style: { icon: OFFLINE_CANDIDATES.turbo } },
  { include: "nx", style: { icon: OFFLINE_CANDIDATES.nx } },
  { include: "react", style: { icon: OFFLINE_CANDIDATES.react } },
  { include: "next", style: { icon: OFFLINE_CANDIDATES.next } },
  { include: "nuxt", style: { icon: OFFLINE_CANDIDATES.nuxt } },
  { include: "svelte", style: { icon: OFFLINE_CANDIDATES.svelte } },
  { include: "astro", style: { icon: OFFLINE_CANDIDATES.astro } },
  { include: "deno", style: { icon: OFFLINE_CANDIDATES.deno } },
  { include: "ruby", style: { icon: OFFLINE_CANDIDATES.ruby } },
  { include: "kotlin", style: { icon: OFFLINE_CANDIDATES.kotlin } },
  { include: "swift", style: { icon: OFFLINE_CANDIDATES.swift } },
  { include: "zig", style: { icon: OFFLINE_CANDIDATES.zig } },
  { include: "java", style: { icon: OFFLINE_CANDIDATES.java } },
  { include: "php", style: { icon: OFFLINE_CANDIDATES.php } },
  { include: "csharp", style: { icon: OFFLINE_CANDIDATES.csharp } },
  { include: "postgres", style: { icon: OFFLINE_CANDIDATES.pgsql } },
  { include: "mysql", style: { icon: OFFLINE_CANDIDATES.mysql } },
  { include: "docker", style: { icon: OFFLINE_CANDIDATES.docker } },
  { include: "readme", style: { icon: OFFLINE_CANDIDATES.docs } },
  { include: "changelog", style: { icon: OFFLINE_CANDIDATES.docs } },
  { include: "license", style: { icon: "vscode-icons:file-type-license" } },
  { include: "security", style: { icon: OFFLINE_CANDIDATES.security } },
  { include: ".lock", style: { icon: OFFLINE_CANDIDATES.lock } }
];

function toStyleRecord(source: Record<string, string>): Record<string, OfflineIconStyle> {
  const entries = Object.entries(source).map(([key, icon]) => [key.toLowerCase(), { icon }] as const);
  return Object.fromEntries(entries);
}

const OFFLINE_VUEPRESS_NAMED_STYLES = toStyleRecord({
  ...VUEPRESS_FILE_ICON_RULES.named,
  ...VUEPRESS_FILE_ICON_RULES.files
});

const OFFLINE_VUEPRESS_FOLDER_STYLES = toStyleRecord(VUEPRESS_FILE_ICON_RULES.folders);
const OFFLINE_VUEPRESS_EXTENSION_STYLES = toStyleRecord(VUEPRESS_FILE_ICON_RULES.extensions);
const OFFLINE_VUEPRESS_PARTIAL_STYLES: Array<{ include: string; style: OfflineIconStyle }> = Object.entries(
  VUEPRESS_FILE_ICON_RULES.partials
).map(([include, icon]) => ({
  include: include.toLowerCase(),
  style: { icon }
}));

function pickBaseName(value: string): string {
  const normalized = value.replace(/\\/g, "/");
  const segment = normalized.split("/").pop();
  return segment ?? normalized;
}

function getExtensionCandidates(baseName: string): string[] {
  const candidates: string[] = [];
  let extension = baseName;

  const firstDotIndex = extension.indexOf(".");
  if (firstDotIndex === -1) {
    return candidates;
  }

  extension = extension.slice(firstDotIndex);
  while (extension !== "") {
    candidates.push(extension);
    const nextDotIndex = extension.indexOf(".", 1);
    if (nextDotIndex === -1) {
      break;
    }
    extension = extension.slice(nextDotIndex);
  }

  return candidates;
}

function resolveFirstOfflineName(icon: string | readonly string[] | undefined): string | undefined {
  if (!icon) {
    return undefined;
  }

  if (typeof icon === "string") {
    return getOfflineIconSvgMap()[icon] ? icon : undefined;
  }

  if (Array.isArray(icon)) {
    for (const candidate of icon) {
      if (getOfflineIconSvgMap()[candidate]) {
        return candidate;
      }
    }
    return undefined;
  }

  return undefined;
}

function resolveOfflineSvgWithFallback(icon: string | readonly string[] | undefined, fallback: string): string | undefined {
  const name = resolveFirstOfflineName(icon) ?? resolveFirstOfflineName(fallback);
  return name ? getOfflineIconSvgMap()[name] : undefined;
}

export function resolveOfflineIconSvg(fileName: string, nodeType: "folder" | "file", expanded: boolean): string | undefined {
  const normalizedPath = fileName.replace(/\\/g, "/").toLowerCase();
  const baseName = pickBaseName(normalizedPath);

  if (nodeType === "folder") {
    const folderStyle = OFFLINE_VUEPRESS_FOLDER_STYLES[baseName] ?? OFFLINE_FOLDER_STYLES[baseName];
    const candidate = expanded ? folderStyle?.openIcon ?? folderStyle?.icon : folderStyle?.icon;
    const fallback = expanded ? DEFAULT_FOLDER_OPEN_OFFLINE_ICON : DEFAULT_FOLDER_OFFLINE_ICON;
    return resolveOfflineSvgWithFallback(candidate, fallback);
  }

  const namedStyle = OFFLINE_VUEPRESS_NAMED_STYLES[baseName] ?? OFFLINE_NAMED_FILE_STYLES[baseName];
  if (namedStyle) {
    return resolveOfflineSvgWithFallback(namedStyle.icon, DEFAULT_FILE_OFFLINE_ICON);
  }

  const extensionCandidates = getExtensionCandidates(baseName);
  for (const extension of extensionCandidates) {
    const extensionStyle = OFFLINE_VUEPRESS_EXTENSION_STYLES[extension] ?? OFFLINE_EXTENSION_STYLES[extension];
    if (extensionStyle) {
      return resolveOfflineSvgWithFallback(extensionStyle.icon, DEFAULT_FILE_OFFLINE_ICON);
    }
  }

  for (const item of OFFLINE_VUEPRESS_PARTIAL_STYLES) {
    if (normalizedPath.includes(item.include)) {
      return resolveOfflineSvgWithFallback(item.style.icon, DEFAULT_FILE_OFFLINE_ICON);
    }
  }

  for (const item of OFFLINE_PARTIAL_STYLES) {
    if (normalizedPath.includes(item.include)) {
      return resolveOfflineSvgWithFallback(item.style.icon, DEFAULT_FILE_OFFLINE_ICON);
    }
  }

  return resolveOfflineSvgWithFallback(undefined, DEFAULT_FILE_OFFLINE_ICON);
}
