// Pack installation (server-wide). Installing pulls a `boredroom-pack.json` manifest from a GitHub
// repo URL, validates it (JSON only — no code execution), and persists it. Installed packs
// contribute games to the unified catalog. Same Supabase REST + graceful-skip pattern as the rest.

import {
  PackRepoManifest as PackRepoManifestSchema,
  resolvePackManifestUrl,
  resolveContentUrl,
  type PackRepoManifest,
} from '../../shared/src/contracts/packRepo.js';

interface BackendConfig {
  url: string;
  key: string;
}
function getBackendConfig(): BackendConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ''), key };
}
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const cfg = getBackendConfig();
  if (!cfg) throw new Error('backend_env_missing');
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.key,
      authorization: `Bearer ${cfg.key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

export interface InstalledPack {
  packId: string;
  name: string;
  version: string;
  sourceUrl: string;
  manifest: PackRepoManifest;
  installedAt: string;
}

export type InstallResult =
  | { ok: true; pack: InstalledPack }
  | { ok: false; error: string };

// Fetch + validate a pack manifest from a repo URL (also hydrates contentUrl games inline).
export async function fetchPackManifest(repoUrl: string): Promise<{ manifestUrl: string; manifest: PackRepoManifest } | { error: string }> {
  const manifestUrl = resolvePackManifestUrl(repoUrl);
  if (!manifestUrl) return { error: 'not_a_github_repo_url' };
  let res: Response;
  try {
    res = await fetch(manifestUrl, { headers: { accept: 'application/json' } });
  } catch {
    return { error: 'fetch_failed' };
  }
  if (!res.ok) return { error: `manifest_http_${res.status}` };
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { error: 'manifest_not_json' };
  }
  const parsed = PackRepoManifestSchema.safeParse(json);
  if (!parsed.success) return { error: 'manifest_invalid' };

  // Pull any external content referenced by games (best-effort; failures leave content undefined).
  const games = await Promise.all(
    parsed.data.games.map(async (g) => {
      if (g.content !== undefined || !g.contentUrl) return g;
      try {
        const cRes = await fetch(resolveContentUrl(manifestUrl, g.contentUrl), { headers: { accept: 'application/json' } });
        if (cRes.ok) return { ...g, content: await cRes.json() };
      } catch {
        /* leave content undefined */
      }
      return g;
    }),
  );
  return { manifestUrl, manifest: { ...parsed.data, games } };
}

export async function installPack(repoUrl: string): Promise<InstallResult> {
  const fetched = await fetchPackManifest(repoUrl);
  if ('error' in fetched) return { ok: false, error: fetched.error };
  const { manifest } = fetched;
  const pack: InstalledPack = {
    packId: manifest.id,
    name: manifest.name,
    version: manifest.version,
    sourceUrl: repoUrl,
    manifest,
    installedAt: new Date().toISOString(),
  };
  if (getBackendConfig()) {
    await apiFetch('pack_installations', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        pack_id: pack.packId,
        name: pack.name,
        version: pack.version,
        source_url: pack.sourceUrl,
        manifest: pack.manifest,
        installed_at: pack.installedAt,
      }),
    });
  }
  return { ok: true, pack };
}

export async function listInstalledPacks(): Promise<InstalledPack[]> {
  if (!getBackendConfig()) return [];
  const res = await apiFetch('pack_installations?order=installed_at.desc');
  if (!res.ok) return [];
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map((r) => ({
    packId: String(r.pack_id),
    name: String(r.name),
    version: String(r.version),
    sourceUrl: String(r.source_url),
    manifest: r.manifest as PackRepoManifest,
    installedAt: String(r.installed_at),
  }));
}

export async function uninstallPack(packId: string): Promise<void> {
  if (!getBackendConfig()) return;
  await apiFetch(`pack_installations?pack_id=eq.${encodeURIComponent(packId)}`, { method: 'DELETE' });
}
