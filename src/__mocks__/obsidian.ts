/** Vitest stub for the Obsidian API. */
import { StateField } from "@codemirror/state";

export const editorLivePreviewField = StateField.define<boolean>({
  create: () => true,
  update: (value) => value
});

export function setIcon(_el: HTMLElement, _icon: string): void {
  /* no-op */
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function requestUrl(): Promise<never> {
  throw new Error("requestUrl must be supplied by the test");
}
