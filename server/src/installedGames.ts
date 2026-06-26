import {
  createHash,
  createPublicKey,
  verify,
} from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import {
  GamePluginManifest,
  OfficialGameCatalog,
  type OfficialCatalogGame,
} from '../../shared/src/contracts/gamePlugin.js';
import type {
  GameRuntime,
  GameRuntimeContext,
  GameRuntimePlayer,
} from '../../shared/src/contracts/gameRuntime.js';
import { isGameActive } from './sessionDirectory.js';

const CATALOG_URL =
  process.env.BOREDROOM_GAMES_CATALOG_URL ??
  'https://raw.githubusercontent.com/thathman/BoredRoom-Games/main/catalog.json';
const GAMES_ROOT = process.env.BOREDROOM_GAMES_DIR ?? path.join(process.cwd(), '.boredroom-games');
const PUBLIC_KEY = process.env.BOREDROOM_GAMES_PUBLIC_KEY?.trim() || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA3GPtGkub/09AvQgAL4a4hmBPnolthU+p3TbytYFC0PU=
-----END PUBLIC KEY-----`;
const MAX_ARTIFACT_BYTES = 25_000_000;
const installed = new Map<string, InstalledGame>();
interface LoadedGamePlugin {
  id: string;
  version: string;
  createRuntime: () => GameRuntime;
}

const loadedPlugins = new Map<string, LoadedGamePlugin>();
let catalogCache: { at: number; games: OfficialCatalogGame[] } | null = null;

export type UpdateOverride = 'inherit' | 'enabled' | 'disabled';

export interface InstalledGame {
  id: string;
  version: string;
  manifest: OfficialCatalogGame;
  installedAt: string;
  updatedAt: string;
  updateOverride: UpdateOverride;
  status: 'installed' | 'error';
  error?: string;
}

interface UpdatePolicyFile {
  automatic: boolean;
  overrides: Record<string, UpdateOverride>;
}

function backendConfig(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

async function dbFetch(pathname: string, init: RequestInit = {}): Promise<Response | null> {
  const config = backendConfig();
  if (!config) return null;
  return fetch(`${config.url}/rest/v1/${pathname}`, {
    ...init,
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function policyPath(): string {
  return path.join(GAMES_ROOT, 'update-policy.json');
}

async function loadPlugin(root: string, expected: { id: string; version: string }, entrypoint: string): Promise<void> {
  const moduleUrl = `${pathToFileURL(path.join(root, entrypoint)).href}?v=${encodeURIComponent(expected.version)}&t=${Date.now()}`;
  const module = await import(moduleUrl) as {
    gamePlugin?: { id?: unknown; version?: unknown; createRuntime?: unknown };
    default?: { id?: unknown; version?: unknown; createRuntime?: unknown };
  };
  const plugin = module.gamePlugin ?? module.default;
  if (
    plugin?.id !== expected.id ||
    plugin.version !== expected.version ||
    typeof plugin.createRuntime !== 'function'
  ) throw new Error('plugin_registration_invalid');
  loadedPlugins.set(expected.id, plugin as LoadedGamePlugin);
}

async function readPolicy(): Promise<UpdatePolicyFile> {
  try {
    const parsed = JSON.parse(await readFile(policyPath(), 'utf8')) as UpdatePolicyFile;
    return {
      automatic: parsed.automatic === true,
      overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
    };
  } catch {
    return { automatic: false, overrides: {} };
  }
}

async function writePolicy(policy: UpdatePolicyFile): Promise<void> {
  await mkdir(GAMES_ROOT, { recursive: true });
  await writeFile(policyPath(), `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });
}

export async function getOfficialCatalog(force = false): Promise<OfficialCatalogGame[]> {
  if (!force && catalogCache && Date.now() - catalogCache.at < 5 * 60_000) return catalogCache.games;
  const response = await fetch(CATALOG_URL, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`catalog_http_${response.status}`);
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error('catalog_too_large');
  const parsed = OfficialGameCatalog.parse(JSON.parse(text));
  for (const game of parsed.games) {
    const url = new URL(game.artifact.url);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      !url.pathname.startsWith('/thathman/BoredRoom-Games/releases/download/')
    ) throw new Error('catalog_artifact_not_allowed');
  }
  catalogCache = { at: Date.now(), games: parsed.games };
  return parsed.games;
}

async function runTar(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let error = '';
    child.stdout.on('data', (chunk) => { output += String(chunk); });
    child.stderr.on('data', (chunk) => { error += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve(output) : reject(new Error(error || `tar_${code}`)));
  });
}

async function persistInstalled(game: InstalledGame): Promise<void> {
  const response = await dbFetch('installed_games', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      game_id: game.id,
      version: game.version,
      manifest: game.manifest,
      artifact_url: game.manifest.artifact.url,
      artifact_sha256: game.manifest.artifact.sha256,
      status: game.status,
      error: game.error ?? null,
      update_override: game.updateOverride,
      installed_at: game.installedAt,
      updated_at: game.updatedAt,
    }),
  });
  if (response && !response.ok) throw new Error(`installed_game_write_${response.status}`);
}

export async function reconcileInstalledGames(): Promise<void> {
  await mkdir(GAMES_ROOT, { recursive: true });
  await rm(path.join(GAMES_ROOT, '.staging'), { recursive: true, force: true });
  await mkdir(path.join(GAMES_ROOT, '.staging'), { recursive: true });
  installed.clear();
  loadedPlugins.clear();
  const response = await dbFetch('installed_games?order=installed_at.asc');
  if (!response?.ok) return;
  const rows = await response.json() as Array<Record<string, unknown>>;
  for (const row of rows) {
    const manifest = OfficialGameCatalog.shape.games.element.safeParse(row.manifest);
    if (!manifest.success) continue;
    const id = String(row.game_id);
    if (!existsSync(path.join(GAMES_ROOT, id, String(row.version), 'manifest.json'))) continue;
    const record: InstalledGame = {
      id,
      version: String(row.version),
      manifest: manifest.data,
      installedAt: String(row.installed_at),
      updatedAt: String(row.updated_at),
      updateOverride: (row.update_override as UpdateOverride) ?? 'inherit',
      status: row.status === 'error' ? 'error' : 'installed',
      error: typeof row.error === 'string' ? row.error : undefined,
    };
    try {
      await loadPlugin(path.join(GAMES_ROOT, id, record.version), record, record.manifest.entrypoints.server);
      installed.set(id, record);
    } catch {
      // An installation that cannot register is unavailable and can be repaired by reinstalling.
    }
  }
}

export async function listGamesCatalog(): Promise<{
  games: Array<OfficialCatalogGame & {
    installed: boolean;
    installedVersion?: string;
    updateAvailable: boolean;
    updateOverride: UpdateOverride;
    status?: InstalledGame['status'];
  }>;
  updatePolicy: UpdatePolicyFile;
}> {
  const [catalog, policy] = await Promise.all([getOfficialCatalog(), readPolicy()]);
  return {
    games: catalog.map((game) => {
      const current = installed.get(game.id);
      return {
        ...game,
        installed: Boolean(current),
        installedVersion: current?.version,
        updateAvailable: Boolean(current && current.version !== game.version),
        updateOverride: policy.overrides[game.id] ?? current?.updateOverride ?? 'inherit',
        status: current?.status,
      };
    }),
    updatePolicy: policy,
  };
}

export function isGameInstalled(gameId: string): boolean {
  return installed.get(gameId)?.status === 'installed' && loadedPlugins.has(gameId);
}

export function getInstalledGameVersion(gameId: string): string | null {
  return installed.get(gameId)?.version ?? null;
}

export function getInstalledGameManifest(gameId: string): OfficialCatalogGame | null {
  return installed.get(gameId)?.manifest ?? null;
}

export function createInstalledGameRuntime(
  gameId: string,
  context: GameRuntimeContext,
  players: GameRuntimePlayer[],
): GameRuntime {
  const plugin = loadedPlugins.get(gameId);
  if (!plugin) throw new Error('game_runtime_unavailable');
  const runtime = plugin.createRuntime();
  if (
    !runtime ||
    runtime.gameType !== gameId ||
    typeof runtime.configure !== 'function' ||
    typeof runtime.seatPlayers !== 'function' ||
    typeof runtime.start !== 'function' ||
    typeof runtime.handleIntent !== 'function' ||
    typeof runtime.publicState !== 'function' ||
    typeof runtime.privateState !== 'function' ||
    typeof runtime.snapshot !== 'function' ||
    typeof runtime.restore !== 'function' ||
    typeof runtime.finish !== 'function' ||
    typeof runtime.dispose !== 'function'
  ) throw new Error('game_runtime_contract_invalid');
  runtime.configure(context);
  runtime.seatPlayers(players);
  runtime.start();
  return runtime;
}

export async function installOfficialGame(gameId: string): Promise<InstalledGame> {
  if (isGameActive(gameId)) throw new Error('game_active');
  const game = (await getOfficialCatalog(true)).find((item) => item.id === gameId);
  if (!game) throw new Error('game_not_found');
  const current = installed.get(gameId);
  if (current) {
    const incoming = game.version.split('.').map(Number);
    const existing = current.version.split('.').map(Number);
    const lower = incoming.some((value, index) => value !== existing[index] && value < existing[index] && incoming.slice(0, index).every((part, partIndex) => part === existing[partIndex]));
    if (lower) throw new Error('version_rollback_rejected');
  }
  const response = await fetch(game.artifact.url, {
    headers: { accept: 'application/gzip,application/octet-stream' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`artifact_http_${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!/(gzip|octet-stream|application\/x-tar)/i.test(contentType)) throw new Error('artifact_content_type_invalid');
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  if (contentLength > MAX_ARTIFACT_BYTES) throw new Error('artifact_too_large');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_ARTIFACT_BYTES || bytes.length !== game.artifact.size) throw new Error('artifact_size_mismatch');
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== game.artifact.sha256) throw new Error('artifact_digest_invalid');
  if (!verify(null, Buffer.from(digest, 'utf8'), createPublicKey(PUBLIC_KEY), Buffer.from(game.artifact.signature, 'base64'))) {
    throw new Error('artifact_signature_invalid');
  }

  const stagingRoot = path.join(GAMES_ROOT, '.staging');
  const staging = path.join(stagingRoot, `${game.id}-${Date.now()}`);
  const archive = `${staging}.tgz`;
  await mkdir(staging, { recursive: true });
  await writeFile(archive, bytes, { mode: 0o600 });
  try {
    const listing = await runTar(['-tzf', archive]);
    const entries = listing.split('\n').filter(Boolean);
    if (
      entries.length === 0 ||
      entries.some((entry) => entry.startsWith('/') || entry.includes('..') || entry.includes('\\'))
    ) throw new Error('artifact_paths_invalid');
    const verboseListing = await runTar(['-tvzf', archive]);
    if (verboseListing.split('\n').filter(Boolean).some((entry) => /^[lh]/.test(entry))) {
      throw new Error('artifact_links_invalid');
    }
    await runTar(['-xzf', archive, '-C', staging, '--no-same-owner', '--no-same-permissions']);
    const manifest = GamePluginManifest.parse(JSON.parse(await readFile(path.join(staging, 'manifest.json'), 'utf8')));
    if (manifest.id !== game.id || manifest.version !== game.version) throw new Error('artifact_manifest_mismatch');
    for (const entrypoint of Object.values(manifest.entrypoints)) {
      const resolved = path.resolve(staging, entrypoint);
      if (!resolved.startsWith(`${path.resolve(staging)}${path.sep}`) || !existsSync(resolved)) {
        throw new Error('artifact_entrypoint_missing');
      }
    }
    const destination = path.join(GAMES_ROOT, game.id, game.version);
    await mkdir(path.dirname(destination), { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await rename(staging, destination);
    await loadPlugin(destination, game, manifest.entrypoints.server);
    const now = new Date().toISOString();
    const previous = installed.get(game.id);
    const record: InstalledGame = {
      id: game.id,
      version: game.version,
      manifest: game,
      installedAt: previous?.installedAt ?? now,
      updatedAt: now,
      updateOverride: previous?.updateOverride ?? 'inherit',
      status: 'installed',
    };
    await persistInstalled(record);
    installed.set(game.id, record);
    return record;
  } finally {
    await rm(archive, { force: true });
    await rm(staging, { recursive: true, force: true });
  }
}

export async function uninstallOfficialGame(gameId: string): Promise<void> {
  if (isGameActive(gameId)) throw new Error('game_active');
  const current = installed.get(gameId);
  if (!current) return;
  await rm(path.join(GAMES_ROOT, gameId), { recursive: true, force: true });
  const response = await dbFetch(`installed_games?game_id=eq.${encodeURIComponent(gameId)}`, { method: 'DELETE' });
  if (response && !response.ok) throw new Error(`installed_game_delete_${response.status}`);
  installed.delete(gameId);
  loadedPlugins.delete(gameId);
}

export async function setUpdatePolicy(input: {
  automatic?: boolean;
  gameId?: string;
  override?: UpdateOverride;
}): Promise<UpdatePolicyFile> {
  const policy = await readPolicy();
  if (typeof input.automatic === 'boolean') policy.automatic = input.automatic;
  if (input.gameId && input.override && ['inherit', 'enabled', 'disabled'].includes(input.override)) {
    policy.overrides[input.gameId] = input.override;
  }
  await writePolicy(policy);
  return policy;
}

export async function applyAutomaticUpdates(): Promise<void> {
  const policy = await readPolicy();
  const catalog = await getOfficialCatalog();
  for (const game of catalog) {
    const current = installed.get(game.id);
    if (!current || current.version === game.version || isGameActive(game.id)) continue;
    const override = policy.overrides[game.id] ?? 'inherit';
    const enabled = override === 'enabled' || (override === 'inherit' && policy.automatic);
    if (enabled) {
      try { await installOfficialGame(game.id); } catch { /* surfaced in catalog on manual retry */ }
    }
  }
}
