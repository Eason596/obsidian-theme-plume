import type { SettingsLanguage } from "../types";

const EN_MESSAGES = {
  settingsLanguage: "Settings language",
  settingsLanguageDesc: "Choose the language used by this plugin's settings page.",
  chinese: "中文",
  english: "English",
  rendering: "Rendering",
  renderingDesc: "VuePress Theme Plume markdown extensions for Obsidian Live Preview and Reading view.",
  defaultIconMode: "Default file-tree icon mode",
  defaultIconModeDesc: 'Used when ::: file-tree does not set icon="simple" or icon="colored".',
  colored: "Colored",
  simple: "Simple",
  rememberTabs: "Remember tab selection",
  rememberTabsDesc: "Persist the active tab for ::: tabs#id and ::: code-tabs#id across sessions (localStorage).",
  lazyCollapse: "Lazy collapse bodies",
  lazyCollapseDesc: "Defer rendering collapse panel content until the panel is opened.",
  lazyTabs: "Lazy tab panels",
  lazyTabsDesc: "Render only the active ::: tabs / ::: code-tabs panel; other panels load when selected.",
  debugRender: "Debug render errors",
  debugRenderDesc: "Show a short error hint in preview when a Plume block fails to render.",
  codeHighlighting: "Code highlighting (Shiki)",
  codeHighlightingDesc: "Themes follow Obsidian's light/dark appearance. The default matches VuePress Theme Plume (Vitesse).",
  loadingThemes: "Loading theme list…",
  lightTheme: "Light theme",
  lightThemeDesc: "Used when Obsidian is in light mode.",
  darkTheme: "Dark theme",
  darkThemeDesc: "Used when Obsidian is in dark mode.",
  themeLoadFailed: "Failed to load the Shiki theme list. See the developer console."
} as const;

type SettingsMessages = { [K in keyof typeof EN_MESSAGES]: string };

const ZH_CN_MESSAGES: SettingsMessages = {
  settingsLanguage: "设置页语言",
  settingsLanguageDesc: "选择本插件设置页面使用的语言。",
  chinese: "中文",
  english: "English",
  rendering: "渲染设置",
  renderingDesc: "为 Obsidian 实时预览和阅读模式提供 VuePress Theme Plume Markdown 扩展。",
  defaultIconMode: "文件树默认图标模式",
  defaultIconModeDesc: '当 ::: file-tree 未设置 icon="simple" 或 icon="colored" 时使用。',
  colored: "彩色",
  simple: "简洁",
  rememberTabs: "记住选项卡",
  rememberTabsDesc: "跨会话保存 ::: tabs#id 与 ::: code-tabs#id 的激活项（localStorage）。",
  lazyCollapse: "延迟渲染折叠内容",
  lazyCollapseDesc: "仅在展开折叠面板时渲染其中的内容。",
  lazyTabs: "延迟渲染选项卡面板",
  lazyTabsDesc: "仅渲染当前激活的 ::: tabs / ::: code-tabs 面板，其他面板在选中时加载。",
  debugRender: "显示渲染错误",
  debugRenderDesc: "Plume 块渲染失败时，在预览中显示简短错误提示。",
  codeHighlighting: "代码高亮（Shiki）",
  codeHighlightingDesc: "主题跟随 Obsidian 明暗外观；默认配色与 VuePress Theme Plume 的 Vitesse 一致。",
  loadingThemes: "正在加载主题列表…",
  lightTheme: "亮色主题",
  lightThemeDesc: "Obsidian 使用亮色模式时采用。",
  darkTheme: "暗色主题",
  darkThemeDesc: "Obsidian 使用暗色模式时采用。",
  themeLoadFailed: "Shiki 主题列表加载失败，请查看开发者控制台。"
};

export function getSettingsMessages(language: SettingsLanguage): SettingsMessages {
  return language === "zh-CN" ? ZH_CN_MESSAGES : EN_MESSAGES;
}
