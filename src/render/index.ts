/** Public render pipeline surface (barrel). */
export type { BlockRenderContext, PlumeRenderSettings } from "./context";
export {
  renderInnerMarkdown,
  renderNestedMarkdownContent,
  renderPlumeBlocksInto
} from "./pipeline";
export {
  scanCodeFenceTitles,
  scanCodeFences,
  decorateCodeBlockTitles,
  decorateCodeBlockFeatures,
  decorateSubtreeCodeFences
} from "./code-fence";
export type { CodeFenceMeta } from "./code-fence";
export { gatherMasonryItems } from "../render";
export { renderTabbedContainer } from "./tabbed-container";
export { renderCollapseBlock } from "./blocks/collapse";
