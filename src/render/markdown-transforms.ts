import { replaceBadgeTagsInMarkdown } from "./badge-transform";
import { replaceIconSyntaxInMarkdown } from "./icon-transform";

export function applyVuepressMarkdownTransforms(markdown: string): string {
  return replaceIconSyntaxInMarkdown(replaceBadgeTagsInMarkdown(markdown));
}

/** True when a section still contains Plume `:::` / `::::` container markers. */
export function sectionHasPlumeContainers(markdown: string): boolean {
  return /(?:^|\n)[\t ]*:{3,}/.test(markdown);
}
