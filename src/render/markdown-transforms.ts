import { replaceBadgeTagsInMarkdown } from "./badge-transform";
import { applyInlineAlignSyntax, type InlineAlignOptions } from "./inline-align";
import { replaceIconSyntaxInMarkdown } from "./icon-transform";
import { getSyntaxFlags } from "./syntax-flags";

export function applyVuepressMarkdownTransforms(
  markdown: string,
  options?: InlineAlignOptions
): string {
  const flags = getSyntaxFlags();
  const withInline = flags.inline
    ? applyInlineAlignSyntax(markdown, options?.documentText ?? markdown, { attrs: flags.attrs })
    : markdown;
  if (!flags.inline) return withInline;
  return replaceIconSyntaxInMarkdown(replaceBadgeTagsInMarkdown(withInline));
}

/** True when a section still contains Plume `:::` / `::::` container markers. */
export function sectionHasPlumeContainers(markdown: string): boolean {
  return /(?:^|\n)[\t ]*:{3,}/.test(markdown);
}
