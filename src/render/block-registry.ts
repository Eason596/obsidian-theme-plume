import type { BlockRenderContext } from "./context";
import type { ParsedBlock } from "../types";

export type BlockRenderer = (
  container: HTMLElement,
  block: ParsedBlock,
  ctx: BlockRenderContext
) => Promise<void>;

let renderBlockImpl: BlockRenderer | null = null;

export function registerBlockRenderer(impl: BlockRenderer): void {
  renderBlockImpl = impl;
}

export async function invokeBlockRenderer(
  container: HTMLElement,
  block: ParsedBlock,
  ctx: BlockRenderContext
): Promise<void> {
  if (!renderBlockImpl) {
    throw new Error("[theme-plume] block renderer not registered");
  }
  await renderBlockImpl(container, block, ctx);
}
