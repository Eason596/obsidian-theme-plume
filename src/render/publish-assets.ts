import path from "node:path";

export const SHARED_ASSET_ROOTS = ["images", "assets"] as const;

export function isSharedAssetPath(vaultPath: string): boolean {
  const normalized = vaultPath.replace(/\\/g, "/").replace(/^\/+/, "");
  return SHARED_ASSET_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`)
  );
}

/** Vault `images/demo.png` lands at `<public>/images/demo.png`. */
export function publicFilePath(publicDir: string, vaultPath: string): string | null {
  if (!isSharedAssetPath(vaultPath)) return null;
  const parts = vaultPath.replace(/\\/g, "/").split("/").filter((part) => part && part !== "." && part !== "..");
  if (parts.length < 2) return null;
  return path.join(publicDir, ...parts);
}
