import { requestUrl } from "obsidian";
import type { RepoCardContainerAttrs } from "../../types";
import { safeHttpUrl } from "../../utils/safe-url";

/* ===== RepoCard ===== */

interface RepoCardInfo {
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  languageColor: string;
  archived: boolean;
  visibility: "Private" | "Public";
  template: boolean;
  ownerType: "User" | "Organization";
  license: { name: string; url?: string } | null;
}

const REPO_CARD_CACHE_KEY = "vp-plume-repo-card-cache";
const REPO_CARD_TTL_MS = 24 * 60 * 60 * 1000;
const REPO_CARD_STALE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REPO_CARD_CACHE_ENTRIES = 64;
const MAX_REPO_REQUESTS = 32;

interface RepoCardCacheEntry {
  info: RepoCardInfo;
  updatedAt: number;
}

const repoRequests = new Map<string, Promise<RepoCardInfo | null>>();

// Inline SVGs lifted from the VuePress RepoCard component so we don't depend
// on Iconify or an external icon font in Obsidian.
const REPO_ICONS = {
  github:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16"><path fill="currentColor" d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7a.75.75 0 1 1-1.072 1.05A2.5 2.5 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.5 2.5 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.25.25 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>',
  gitee:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"><path fill="#c71d23" d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.59.59 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296Z"/></svg>',
  star:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256"><path fill="currentColor" d="M243 96a20.33 20.33 0 0 0-17.74-14l-56.59-4.57l-21.84-52.81a20.36 20.36 0 0 0-37.66 0L87.35 77.44L30.76 82a20.45 20.45 0 0 0-11.66 35.88l43.18 37.24l-13.2 55.7A20.37 20.37 0 0 0 79.57 233L128 203.19L176.43 233a20.39 20.39 0 0 0 30.49-22.15l-13.2-55.7l43.18-37.24A20.43 20.43 0 0 0 243 96m-70.47 45.7a12 12 0 0 0-3.84 11.86L181.58 208l-47.29-29.08a12 12 0 0 0-12.58 0L74.42 208l12.89-54.4a12 12 0 0 0-3.84-11.86l-42.27-36.5l55.4-4.47a12 12 0 0 0 10.13-7.38L128 41.89l21.27 51.5a12 12 0 0 0 10.13 7.38l55.4 4.47Z"/></svg>',
  fork:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256"><path fill="currentColor" d="M228 64a36 36 0 1 0-48 33.94V112a4 4 0 0 1-4 4H80a4 4 0 0 1-4-4V97.94a36 36 0 1 0-24 0V112a28 28 0 0 0 28 28h36v18.06a36 36 0 1 0 24 0V140h36a28 28 0 0 0 28-28V97.94A36.07 36.07 0 0 0 228 64M64 52a12 12 0 1 1-12 12a12 12 0 0 1 12-12m64 152a12 12 0 1 1 12-12a12 12 0 0 1-12 12m64-128a12 12 0 1 1 12-12a12 12 0 0 1-12 12"/></svg>',
  license:
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" d="M4.5 13.5h7M8.01 1v12.06M1.5 3.5h3l1.5-1h4l1.5 1h3M.5 10L3 4.48L5.5 10C4 11 2 11 .5 10m10 0L13 4.48L15.5 10c-1.5 1-3.5 1-5 0"/></svg>'
};

function appendSvgMarkup(host: HTMLElement, svg: string): void {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  const svgElement = parsed.documentElement;
  if (svgElement.nodeName.toLowerCase() !== "svg") {
    return;
  }
  host.appendChild(host.ownerDocument.importNode(svgElement, true));
}

function pruneRepoCardCache(
  cache: Record<string, RepoCardCacheEntry>
): Record<string, RepoCardCacheEntry> {
  const cutoff = Date.now() - REPO_CARD_STALE_RETENTION_MS;
  return Object.fromEntries(
    Object.entries(cache)
      .filter(([, entry]) => entry?.info?.name && entry.updatedAt >= cutoff)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_REPO_CARD_CACHE_ENTRIES)
  );
}

function loadRepoCardCache(): Record<string, RepoCardCacheEntry> {
  try {
    const raw = window.localStorage.getItem(REPO_CARD_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? pruneRepoCardCache(parsed as Record<string, RepoCardCacheEntry>)
      : {};
  } catch {
    return {};
  }
}

function saveRepoCardCache(cache: Record<string, RepoCardCacheEntry>): void {
  try {
    window.localStorage.setItem(REPO_CARD_CACHE_KEY, JSON.stringify(pruneRepoCardCache(cache)));
  } catch {
    // localStorage quota / disabled — silently degrade, the next render will refetch.
  }
}

function convertThousand(num: number): number | string {
  if (!Number.isFinite(num)) return 0;
  if (num < 1000) return num;
  return `${(num / 1000).toFixed(1)}k`;
}

async function fetchRepoInfo(provider: "github" | "gitee", owner: string, name: string): Promise<RepoCardInfo | null> {
  const key = `${provider}:${owner}/${name}`;
  const existing = repoRequests.get(key);
  if (existing) return existing;
  const url = `https://api.pengzhanbo.cn/${provider}/repo/${owner}/${name}`;
  const pending = (async (): Promise<RepoCardInfo | null> => {
    try {
      const res = await requestUrl({ url, method: "GET" });
      if (res.status < 200 || res.status >= 300) return null;
      const json = res.json as RepoCardInfo;
      return json?.name ? json : null;
    } catch {
      return null;
    }
  })();
  repoRequests.set(key, pending);
  while (repoRequests.size > MAX_REPO_REQUESTS) {
    const oldest = repoRequests.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    repoRequests.delete(oldest);
  }
  try {
    return await pending;
  } finally {
    if (repoRequests.get(key) === pending) repoRequests.delete(key);
  }
}

export async function renderRepoCardBlock(
  container: HTMLElement,
  attrs: RepoCardContainerAttrs
): Promise<void> {
  const provider = attrs.provider ?? "github";
  const [owner = "", name = ""] = (attrs.repo || "").split("/");
  if (!owner || !name) return;

  const wrapper = container.createDiv({ cls: "vp-repo-card" });
  wrapper.dataset.provider = provider;
  wrapper.dataset.repo = `${owner}/${name}`;

  // Skeleton: show the slug + link immediately so the card has a useful
  // fallback if the API call fails or the user is offline.
  const fallbackUrl =
    provider === "gitee"
      ? `https://gitee.com/${owner}/${name}`
      : `https://github.com/${owner}/${name}`;

  const nameRow = wrapper.createEl("p", { cls: "repo-name" });
  const providerIcon = nameRow.createSpan({ cls: `repo-provider-icon repo-provider-${provider}` });
  appendSvgMarkup(providerIcon, REPO_ICONS[provider]);
  const linkWrap = nameRow.createSpan({ cls: "repo-link" });
  const link = linkWrap.createEl("a", {
    href: fallbackUrl,
    text: `${owner}/${name}`,
    attr: { target: "_blank", rel: "noopener noreferrer", title: `${owner}/${name}` }
  });
  const visibilityBadge = nameRow.createSpan({ cls: "repo-visibility", text: "Public" });

  const desc = wrapper.createEl("p", { cls: "repo-desc", text: "Loading…" });
  const info = wrapper.createDiv({ cls: "repo-info" });

  const populate = (data: RepoCardInfo): void => {
    link.textContent =
      attrs.fullname || (data.ownerType === "Organization" && attrs.fullname === undefined)
        ? data.fullName
        : data.name;
    link.setAttribute("href", safeHttpUrl(data.url) ?? fallbackUrl);
    link.setAttribute("title", data.fullName);
    visibilityBadge.textContent =
      data.visibility + (data.template ? " Template" : "") + (data.archived ? " archive" : "");
    visibilityBadge.classList.toggle("archived", !!data.archived);
    desc.textContent = data.description || "";
    info.empty();
    if (data.language) {
      const p = info.createEl("p");
      const dot = p.createSpan({ cls: "repo-language" });
      if (data.languageColor) dot.style.setProperty("--repo-language-color", data.languageColor);
      p.createSpan({ text: data.language });
    }
    {
      const p = info.createEl("p", { attr: { title: `Stars: ${data.stars}` } });
      const icon = p.createSpan({ cls: "repo-stat-icon" });
      appendSvgMarkup(icon, REPO_ICONS.star);
      p.createSpan({ text: String(convertThousand(data.stars)) });
    }
    {
      const p = info.createEl("p", { attr: { title: `Forks: ${data.forks}` } });
      const icon = p.createSpan({ cls: "repo-stat-icon" });
      appendSvgMarkup(icon, REPO_ICONS.fork);
      p.createSpan({ text: String(convertThousand(data.forks)) });
    }
    if (data.license) {
      const p = info.createEl("p", { attr: { title: `License: ${data.license.name}` } });
      const icon = p.createSpan({ cls: "repo-stat-icon" });
      appendSvgMarkup(icon, REPO_ICONS.license);
      p.createSpan({ text: data.license.name });
    }
  };

  const cacheKey = `${provider}:${owner}/${name}`;
  const cache = loadRepoCardCache();
  const cached = cache[cacheKey];
  if (cached?.info?.name && Date.now() - cached.updatedAt <= REPO_CARD_TTL_MS) {
    populate(cached.info);
    return;
  }

  const fresh = await fetchRepoInfo(provider, owner, name);
  if (!fresh) {
    desc.textContent = cached?.info?.description ?? "";
    if (cached?.info) populate(cached.info);
    return;
  }
  populate(fresh);
  const latestCache = loadRepoCardCache();
  latestCache[cacheKey] = { info: fresh, updatedAt: Date.now() };
  saveRepoCardCache(latestCache);
}
