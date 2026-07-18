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
  clearCodeFenceScanCache,
  decorateCodeBlockTitles,
  decorateCodeBlockFeatures,
  decorateSubtreeCodeFences,
  refreshDecoratedCodeFences,
  disconnectAllFenceWatchers,
  sectionNeedsFenceDecorate,
  fenceNeedsFeatureRewrite
} from "./code-fence";
export type { CodeFenceMeta, DecorateCodeFeaturesOptions } from "./code-fence";
export { gatherMasonryItems } from "../render";
export { renderTabbedContainer } from "./tabbed-container";
export { renderCollapseBlock } from "./blocks/collapse";
