/**
 * Shared with vuepress-theme-plume docs `1.0.0-rc.214`
 * (`docs/.vuepress/theme.ts`). A fence attribute or an `npm-to` `tabs` attribute
 * still wins over these defaults.
 */

export const SHARED_LINE_NUMBER_THRESHOLD = 10;

export const SHARED_NPM_TO_TABS = ["pnpm", "yarn", "npm"] as const;

/** `null` means the fence did not ask for a gutter. */
export function defaultLineNumbersForFence(
  explicit: boolean | null,
  lineCount: number
): boolean | null {
  if (explicit !== null) return explicit;
  if (lineCount >= SHARED_LINE_NUMBER_THRESHOLD) return true;
  return null;
}
