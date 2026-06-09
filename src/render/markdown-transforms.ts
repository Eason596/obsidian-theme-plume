import { replaceBadgeTagsInMarkdown } from "./badge-transform";
import { replaceIconSyntaxInMarkdown } from "./icon-transform";

export function applyVuepressMarkdownTransforms(markdown: string): string {
  return replaceIconSyntaxInMarkdown(replaceBadgeTagsInMarkdown(markdown));
}
