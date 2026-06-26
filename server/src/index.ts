// Colyseus server bootstrap.
// Responsibilities:
//   - room lifecycle, presence, websocket transport
//   - admission policy (host-issued one-time tokens for host role)
//   - public/private state projection
//   - deterministic runtime bot decisions
//   - mid-game approvals + moderation
//
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { HouseSessionRoom } from './rooms/HouseSessionRoom.js';
import { PROTOCOL_VERSION } from '../../shared/src/contracts/index.js';
import { log } from './logger.js';
import {
  buildHouseSession,
  persistHouseSession,
  readHouseSession,
  readLatestRuntimeSnapshot,
  readSessionMembers,
  readSessionCredentialHashes,
  readActiveRun,
  buildSessionEvent,
  appendSessionEvent,
} from './foundations.js';
import {
  createCompanionPairing,
  getPublicSession,
  getSessionRecord,
  getSessionCredentialHashes,
  hydrateSession,
  hydrateActiveRun,
  hydrateSessionMember,
  issueOwnerCredential,
  redeemCompanionPairing,
  registerSession,
  verifyOwnerCredential,
  verifyControlCredential,
} from './sessionDirectory.js';
import {
  clearLoginAttempts,
  clearGameAdminCookie,
  consumeLoginAttempt,
  isAllowedGameAdminOrigin,
  issueGameAdminSession,
  gameAdminCookie,
  GAME_ADMIN_COOKIE,
  readCookie,
  verifyGameAdminPassphrase,
  verifyGameAdminSession,
} from './gameAdminAuth.js';
import {
  applyAutomaticUpdates,
  installOfficialGame,
  listGamesCatalog,
  reconcileInstalledGames,
  setUpdatePolicy,
  uninstallOfficialGame,
} from './installedGames.js';
import { generateSessionStory, getAiHealth, moderateOwnerContent, recommendGames } from './aiService.js';

const PORT = Number(process.env.PORT ?? 2567);

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

function ownerCredentialFrom(req: express.Request): string | undefined {
  const header = req.header('x-boredroom-owner');
  return header?.trim() || undefined;
}

function requireSessionOwner(req: express.Request, res: express.Response): boolean {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!verifyOwnerCredential(code, ownerCredentialFrom(req))) {
    res.status(403).json({ error: 'owner_credential_invalid' });
    return false;
  }
  return true;
}

function requireSessionController(req: express.Request, res: express.Response): boolean {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!verifyControlCredential(code, ownerCredentialFrom(req))) {
    res.status(403).json({ error: 'control_credential_invalid' });
    return false;
  }
  return true;
}

function gameAdminSecret(): string | undefined {
  return process.env.GAME_ADMIN_TOKEN;
}

function requireGameAdmin(req: express.Request, res: express.Response): boolean {
  const expected = gameAdminSecret();
  const headerCredential = req.header('x-boredroom-admin')?.trim();
  const cookieCredential = readCookie(req.header('cookie'), GAME_ADMIN_COOKIE);
  const authenticated =
    verifyGameAdminPassphrase(headerCredential ?? '', expected) ||
    verifyGameAdminSession(cookieCredential, expected);
  if (!authenticated) {
    res.status(403).json({ error: 'game_admin_required' });
    return false;
  }
  return true;
}

function requireGameAdminOrigin(req: express.Request, res: express.Response): boolean {
  if (!isAllowedGameAdminOrigin(req.header('origin'))) {
    res.status(403).json({ error: 'game_admin_origin_invalid' });
    return false;
  }
  return true;
}

// Create one authoritative house session. Every game runtime stays inside HouseSessionRoom.
app.post('/sessions', async (req, res) => {
  const { hostDeviceId, settings } = req.body ?? {};
  if (!hostDeviceId || typeof hostDeviceId !== 'string') {
    return res.status(400).json({ error: 'hostDeviceId required' });
  }
  let session: ReturnType<typeof buildHouseSession>;
  try {
    session = buildHouseSession({
      hostDeviceId,
      settings: settings && typeof settings === 'object' ? settings : undefined,
    });
  } catch (err) {
    log('warn', 'session_build_failed', { error: String(err) });
    return res.status(400).json({ error: 'invalid_session_input' });
  }
  while (getSessionRecord(session.code)) session.code = makeUniqueSessionCode();
  const ownerCredential = issueOwnerCredential();
  registerSession(session, ownerCredential);
  try {
    await persistHouseSession(session, getSessionCredentialHashes(session.code) ?? undefined);
    await appendSessionEvent(buildSessionEvent({ sessionId: session.id, type: 'session.created', actorId: hostDeviceId }));
  } catch (err) {
    log('warn', 'session_persist_failed', { error: String(err) });
    return res.status(503).json({ error: 'session_persist_failed' });
  }
  res.json({ session, ownerCredential });
});

// Read a house session by code (for screens to hydrate). 404 when unknown / no backend.
app.get('/sessions/:code', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  try {
    const live = getPublicSession(code);
    if (live) return res.json(live);
    const session = await readHouseSession(code);
    if (!session) return res.status(404).json({ exists: false, code });
    const credentials = await readSessionCredentialHashes(code);
    hydrateSession(session, credentials ?? undefined);
    const activeRun = await readActiveRun(session.id);
    for (const member of await readSessionMembers(session.id)) hydrateSessionMember(code, member);
    if (activeRun) hydrateActiveRun(code, activeRun, await readLatestRuntimeSnapshot(activeRun.id));
    const hydrated = getPublicSession(code);
    return res.json({
      session: hydrated?.session ?? session,
      members: hydrated?.members ?? [],
      activeRun: hydrated?.activeRun ?? activeRun,
      lastRecap: hydrated?.lastRecap,
    });
  } catch (err) {
    log('warn', 'session_read_failed', { error: String(err) });
    return res.status(503).json({ error: 'session_read_failed' });
  }
});

app.post('/sessions/:code/pairing', (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  if (!requireSessionOwner(req, res)) return;
  res.json(createCompanionPairing(code));
});

app.post('/sessions/:code/pairing/redeem', async (req, res) => {
  const code = String(req.params.code ?? '').toUpperCase();
  const pairingCode = typeof req.body?.pairingCode === 'string' ? req.body.pairingCode : '';
  const result = redeemCompanionPairing(code, pairingCode);
  if (!result) return res.status(410).json({ error: 'pairing_invalid_or_expired' });
  const record = getSessionRecord(code);
  if (record) {
    await persistHouseSession(record.session, getSessionCredentialHashes(code) ?? undefined);
  }
  res.json(result);
});

app.get('/games/auth', (req, res) => {
  const token = readCookie(req.header('cookie'), GAME_ADMIN_COOKIE);
  res.json({ authenticated: verifyGameAdminSession(token, gameAdminSecret()) });
});

app.post('/games/auth', (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  const key =
    req.header('cf-connecting-ip')?.trim() ||
    req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown';
  const attempt = consumeLoginAttempt(key);
  if (!attempt.allowed) {
    res.setHeader('Retry-After', String(attempt.retryAfterSeconds));
    return res.status(429).json({ error: 'game_admin_rate_limited' });
  }
  const passphrase = typeof req.body?.passphrase === 'string' ? req.body.passphrase : '';
  const secret = gameAdminSecret();
  if (!verifyGameAdminPassphrase(passphrase, secret) || !secret) {
    return res.status(403).json({ error: 'game_admin_invalid' });
  }
  clearLoginAttempts(key);
  res.setHeader('Set-Cookie', gameAdminCookie(issueGameAdminSession(secret)));
  res.json({ authenticated: true });
});

app.delete('/games/auth', (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  res.setHeader('Set-Cookie', clearGameAdminCookie());
  res.json({ authenticated: false });
});

app.get('/games/catalog', async (_req, res) => {
  try {
    res.json(await listGamesCatalog());
  } catch (err) {
    log('warn', 'game_catalog_failed', { error: String(err) });
    res.status(503).json({ error: 'game_catalog_unavailable' });
  }
});

app.post('/games/:gameId/install', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  try {
    const game = await installOfficialGame(String(req.params.gameId));
    log('info', 'game_installed', { gameId: game.id, version: game.version });
    res.json({ game });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'install_failed';
    res.status(code === 'game_active' ? 409 : code === 'game_not_found' ? 404 : 422).json({ error: code });
  }
});

app.post('/games/:gameId/update', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  try {
    const game = await installOfficialGame(String(req.params.gameId));
    res.json({ game });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'update_failed';
    res.status(code === 'game_active' ? 409 : 422).json({ error: code });
  }
});

app.delete('/games/:gameId', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  try {
    await uninstallOfficialGame(String(req.params.gameId));
    res.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'uninstall_failed';
    res.status(code === 'game_active' ? 409 : 503).json({ error: code });
  }
});

app.patch('/games/update-policy', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  try {
    res.json({ updatePolicy: await setUpdatePolicy(req.body ?? {}) });
  } catch {
    res.status(400).json({ error: 'update_policy_invalid' });
  }
});

app.get('/sessions/:code/ai/health', (req, res) => {
  if (!requireSessionController(req, res)) return;
  res.json(getAiHealth());
});

app.post('/sessions/:code/ai/moderate', async (req, res) => {
  if (!requireSessionController(req, res)) return;
  const text = typeof req.body?.text === 'string' ? req.body.text : '';
  res.json(await moderateOwnerContent(text));
});

app.get('/sessions/:code/ai/recommendations', async (req, res) => {
  if (!requireSessionController(req, res)) return;
  const record = getSessionRecord(String(req.params.code));
  if (!record) return res.status(404).json({ error: 'session_not_found' });
  const catalog = await listGamesCatalog();
  const installedGames = catalog.games
    .filter((game) => game.installed)
    .map((game) => ({
      id: game.id,
      name: game.name,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
    }));
  const playerCount = Array.from(record.members.values()).filter((member) => member.role === 'controller' && member.ready).length;
  res.json({
    recommendations: await recommendGames({
      installedGames,
      playerCount,
      recentGameIds: record.lastRecap ? [record.lastRecap.gameType] : [],
    }),
  });
});

app.get('/sessions/:code/ai/story', async (req, res) => {
  if (!requireSessionController(req, res)) return;
  const record = getSessionRecord(String(req.params.code));
  if (!record) return res.status(404).json({ error: 'session_not_found' });
  const recap = record.lastRecap;
  res.json({
    story: await generateSessionStory({
      playerNames: Array.from(record.members.values())
        .filter((member) => member.role === 'controller')
        .map((member) => member.displayName),
      completedGames: recap ? [{
        gameName: recap.gameType,
        status: recap.status,
        winners: recap.winnerPlayerIds
          .map((id) => record.members.get(id)?.displayName)
          .filter((name): name is string => Boolean(name)),
      }] : [],
    }),
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, transport: 'colyseus', version: PROTOCOL_VERSION });
});
app.get('/healthz', (_req, res) => {
  res.json({ ok: true, transport: 'colyseus', version: PROTOCOL_VERSION });
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define('house-session', HouseSessionRoom).filterBy(['code']);

await gameServer.serverless();
await reconcileInstalledGames();
void applyAutomaticUpdates();
setInterval(() => { void applyAutomaticUpdates(); }, 60 * 60 * 1000).unref();

httpServer.listen(PORT, () => {
  log('info', 'server_listening', { port: PORT, protocolVersion: PROTOCOL_VERSION });
});

function makeUniqueSessionCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (getSessionRecord(code));
  return code;
}
