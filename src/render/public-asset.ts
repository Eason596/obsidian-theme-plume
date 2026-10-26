/**
 * Maps a VuePress public URL onto a vault-root path.
 *
 * `/images/demo.png` → `images/demo.png`
 * `/assets/files/a.pdf` → `assets/files/a.pdf`
 *
 * A site `base` such as `/blog/` is not stripped. Only these two prefixes
 * participate, and the file must exist at that exact vault path.
 */

const PUBLIC_PREFIXES = ["/images/", "/assets/"] as const;

export function vaultPathForPublicAsset(src: string): string | null {
  let path = src.trim();
  if (!path || /^(?:[a-z][a-z0-9+.-]*:|\/\/|data:)/i.test(path)) return null;
  if (/[?#]/.test(path)) return null;

  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }

  path = path.replace(/\\/g, "/");
  if (!path.startsWith("/")) return null;
  if (!PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;

  const vaultPath = path.slice(1).replace(/\/{2,}/g, "/");
  const segments = vaultPath.split("/");
  if (segments.length < 2) return null;
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    return null;
  }
  return vaultPath;
}
