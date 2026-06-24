// Installable pack format (the `boredroom-pack.json` at a pack repo's root). A pack is a content
// bundle, not code: each game maps to a built-in engine *kind* and supplies content + metadata.
// BoredRoom pulls JSON only — no remote code execution. Canonical for the install pipeline.

import { z } from 'zod';

// Engine kinds a pack may target (all shipped in BoredRoom core). Packs provide content/instances,
// never new engine code.
export const PackEngineKind = z.enum([
  'trivia',
  'faith-feud',
  'bible-timeline',
  'market-price',
  'pidgin-translator',
  'logo',
]);

export const PackRepoGame = z.object({
  slug: z.string().min(1), // unique game id contributed by the pack
  engine: PackEngineKind,
  name: z.string().min(1),
  emoji: z.string().default('🎮'),
  tagline: z.string().default(''),
  minPlayers: z.number().int().positive().default(1),
  maxPlayers: z.number().int().positive().default(12),
  // Inline content, or a path/URL fetched relative to the manifest.
  content: z.unknown().optional(),
  contentUrl: z.string().optional(),
});

export const PackRepoManifest = z.object({
  id: z.string().min(1), // e.g. "pack.faith"
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().default(''),
  theme: z.object({ tokenSet: z.string().min(1) }).optional(),
  games: z.array(PackRepoGame).min(1),
});

export type PackEngineKind = z.infer<typeof PackEngineKind>;
export type PackRepoGame = z.infer<typeof PackRepoGame>;
export type PackRepoManifest = z.infer<typeof PackRepoManifest>;

// Resolve a GitHub repo URL (or a direct raw URL) to the raw boredroom-pack.json URL.
// Accepts:
//   https://github.com/owner/repo            -> raw .../owner/repo/HEAD/boredroom-pack.json
//   https://github.com/owner/repo/tree/main  -> raw .../owner/repo/main/boredroom-pack.json
//   https://raw.githubusercontent.com/...json -> as-is
//   .../owner/repo/blob/main/path.json        -> raw form
export function resolvePackManifestUrl(input: string): string | null {
  const url = input.trim();
  if (!url) return null;
  if (/^https?:\/\/raw\.githubusercontent\.com\//.test(url)) return url;

  const m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(?:tree|blob)\/([^/]+)(?:\/(.*))?)?\/?$/);
  if (!m) return null;
  const [, owner, repo, ref, path] = m;
  const branch = ref || 'HEAD';
  const file = path && /\.json$/.test(path) ? path : `${path ? path.replace(/\/$/, '') + '/' : ''}boredroom-pack.json`;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`;
}

// Resolve a content path relative to the manifest URL (for games using contentUrl).
export function resolveContentUrl(manifestUrl: string, contentUrl: string): string {
  if (/^https?:\/\//.test(contentUrl)) return contentUrl;
  return new URL(contentUrl, manifestUrl).toString();
}
