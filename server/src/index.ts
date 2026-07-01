// Colyseus server bootstrap.
// Responsibilities:
//   - room lifecycle, presence, websocket transport
//   - admission policy (host-issued one-time tokens for host role)
//   - public/private state projection
//   - deterministic runtime bot decisions
//   - mid-game approvals + moderation
//
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { createHash } from 'crypto';
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
  persistenceAvailable,
  persistMoneyTriviaQuestion,
  deleteMoneyTriviaQuestionRow,
  readMoneyTriviaQuestions,
} from './foundations.js';
import {
  createCompanionPairing,
  getPublicSession,
  getSessionRecord,
  getSessionCredentialHashes,
  publicGameRun,
  hydrateSession,
  hydrateActiveRun,
  hydrateSessionMember,
  issueOwnerCredential,
  listSessionSummaries,
  listRecentVotesAcrossSessions,
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
import { listQuestions, createDraft, updateQuestion, deleteQuestion, hydrateFromRows } from './content/moneyTriviaStore.js';
import {
  applyAutomaticUpdates,
  installOfficialGame,
  listGamesCatalog,
  reconcileInstalledGames,
  setUpdatePolicy,
  uninstallOfficialGame,
} from './installedGames.js';
import { generateSessionStory, getAiHealth, moderateOwnerContent, recommendGames, generateTriviaQuestions } from './aiService.js';

const PORT = Number(process.env.PORT ?? 2567);

// Colyseus prepends its router ahead of Express and answers every OPTIONS request.
// Extend that router's allow-list as well as Express CORS or owner/admin browser
// requests are rejected by preflight before they reach our authenticated routes.
matchMaker.controller.DEFAULT_CORS_HEADERS['Access-Control-Allow-Headers'] =
  'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-BoredRoom-Owner, X-BoredRoom-Admin';

const app = express();
app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-BoredRoom-Owner', 'X-BoredRoom-Admin'],
}));
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
      activeRun: hydrated?.activeRun ?? (activeRun ? publicGameRun(activeRun) : null),
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

// ── Money Trivia question management (owner-authenticated) ────────────────────
// Drafts (incl. AI-assisted) are added then reviewed/approved here. Only approved, sourced,
// non-expired questions ever enter a cash run. Review metadata/credentials are never public.
app.get('/games/trivia/questions', (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  const ageBand = typeof req.query.ageBand === 'string' ? req.query.ageBand : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  res.json({ questions: listQuestions({ ageBand, status, category } as never) });
});

// Reviewed-question mutations require durable persistence — never accept in-memory-only edits.
function questionRow(q: Record<string, unknown>): Record<string, unknown> {
  return {
    id: q.id, kind: 'hot_seat', prompt: q.prompt, options: q.options, answer: q.answer,
    category: q.category, age_band: q.ageBand, difficulty: q.difficulty, explanation: q.explanation,
    source_url: q.sourceUrl, review_status: q.reviewStatus, review_date: q.reviewDate, expiry: q.expiry ?? null,
  };
}

app.post('/games/trivia/questions/drafts', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  if (!persistenceAvailable()) return res.status(503).json({ error: 'persistence_unavailable' });
  const { question, errors } = createDraft((req.body ?? {}) as never);
  if (!question) return res.status(422).json({ errors });
  try {
    await persistMoneyTriviaQuestion(questionRow(question as never));
  } catch {
    deleteQuestion(question.id); // roll back the in-memory add if the durable write failed
    return res.status(503).json({ error: 'persistence_write_failed' });
  }
  res.status(201).json({ question });
});

// Generate AI draft questions through the server AI gateway. Drafts are stored un-approved; the
// owner must verify sources and approve before they can ever enter a cash run.
app.post('/games/trivia/questions/generate', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  if (!persistenceAvailable()) return res.status(503).json({ error: 'persistence_unavailable' });
  const body = (req.body ?? {}) as { ageBand?: string; difficulty?: number; category?: string; count?: number };
  const ageBand = ['pre_teen', 'teen', 'adult'].includes(String(body.ageBand)) ? body.ageBand! : 'adult';
  const difficulty = Math.min(15, Math.max(1, Math.trunc(Number(body.difficulty) || 8)));
  const category = typeof body.category === 'string' && body.category.trim() ? body.category.trim() : 'General knowledge';
  const count = Math.min(8, Math.max(1, Math.trunc(Number(body.count) || 4)));
  const topic = `${category}, ${ageBand.replace('_', '-')} level, difficulty ${difficulty} of 15 (Nigerian party trivia; four options, exactly one correct)`;
  const generated = await generateTriviaQuestions({ topic, count });
  if (generated.length === 0) return res.status(503).json({ error: 'ai_unavailable' });
  const drafts = [];
  for (const g of generated) {
    if (g.options.length !== 4) continue;
    const { question } = createDraft({
      prompt: g.prompt, options: g.options as [string, string, string, string], answer: g.answer,
      category, ageBand: ageBand as never, difficulty, explanation: g.explanation ?? '',
      // Placeholder source: the owner MUST verify and replace it before approving.
      sourceUrl: 'https://example.org/unverified-ai-draft',
    });
    if (!question) continue;
    try {
      await persistMoneyTriviaQuestion({
        id: question.id, kind: 'hot_seat', prompt: question.prompt, options: question.options, answer: question.answer,
        category: question.category, age_band: question.ageBand, difficulty: question.difficulty,
        explanation: question.explanation, source_url: question.sourceUrl, review_status: 'draft',
        review_date: question.reviewDate, provenance: { generatedBy: 'ai' },
      });
      drafts.push(question);
    } catch {
      deleteQuestion(question.id);
    }
  }
  res.status(201).json({ drafts, note: 'Verify each source before approving — AI drafts are unverified.' });
});

app.patch('/games/trivia/questions/:questionId', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  if (!persistenceAvailable()) return res.status(503).json({ error: 'persistence_unavailable' });
  const { question, errors } = updateQuestion(String(req.params.questionId), (req.body ?? {}) as never);
  if (!question) return res.status(errors.includes('not_found') ? 404 : 422).json({ errors });
  try {
    await persistMoneyTriviaQuestion(questionRow(question as never));
  } catch {
    return res.status(503).json({ error: 'persistence_write_failed' });
  }
  res.json({ question });
});

app.delete('/games/trivia/questions/:questionId', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  if (!persistenceAvailable()) return res.status(503).json({ error: 'persistence_unavailable' });
  try {
    await deleteMoneyTriviaQuestionRow(String(req.params.questionId));
  } catch {
    return res.status(503).json({ error: 'persistence_write_failed' });
  }
  const ok = deleteQuestion(String(req.params.questionId));
  res.status(ok ? 200 : 404).json({ ok });
});

app.get('/sessions/:code/ai/health', (req, res) => {
  if (!requireSessionController(req, res)) return;
  res.json(getAiHealth());
});

// Admin back office: server-level overview. Guarded by the game-admin session + origin so it
// never leaks to the public display or controllers. Returns counts and codes only — no secrets.
const SERVER_STARTED_AT = Date.now();
app.get('/admin/overview', async (req, res) => {
  if (!requireGameAdminOrigin(req, res)) return;
  if (!requireGameAdmin(req, res)) return;
  const catalog = await listGamesCatalog().catch(() => ({ games: [] as Array<{ installed: boolean }> }));
  const parties = listSessionSummaries();
  res.json({
    server: {
      protocolVersion: PROTOCOL_VERSION,
      uptimeSeconds: Math.round((Date.now() - SERVER_STARTED_AT) / 1000),
      nodeEnv: process.env.NODE_ENV ?? 'development',
    },
    ai: getAiHealth(),
    games: {
      installed: catalog.games.filter((g) => g.installed).length,
      available: catalog.games.length,
    },
    parties: {
      total: parties.length,
      inGame: parties.filter((p) => p.status === 'in_game').length,
      list: parties,
    },
    recentVotes: listRecentVotesAcrossSessions(25),
  });
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

// Dynamic Naija TTS via YarnGPT. Generates a line like "<player> calls semi last card" with a
// Naija voice, caches it in-memory by (line+voice), and streams the audio. Fails soft with 503 so
// the client falls back to the pre-recorded clips — audio never breaks if TTS is down/unset.
const TTS_BASE_URL = (process.env.TTS_BASE_URL?.trim() || 'https://yarngpt.ai/api/v1').replace(/\/+$/, '');
const TTS_DEFAULT_VOICE = process.env.TTS_VOICE?.trim() || 'Idera';
const TTS_VOICES = (process.env.TTS_VOICES?.trim() || `${TTS_DEFAULT_VOICE},Tayo,Chinenye,Nonso,Mary,Femi`).split(',').map((voice) => voice.trim()).filter(Boolean);
const TTS_TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS ?? 9000);
const ttsCache = new Map<string, Buffer>();
const TTS_CACHE_MAX = 80;
const ttsRate = new Map<string, { count: number; resetAt: number }>();

app.get('/tts', async (req, res) => {
  const line = String(req.query.line ?? '').trim().slice(0, 300);
  const requestedVoice = String(req.query.voice ?? '').trim().slice(0, 40);
  const voiceIndex = [...line].reduce((sum, char) => sum + char.charCodeAt(0), 0) % TTS_VOICES.length;
  const voice = requestedVoice || TTS_VOICES[voiceIndex] || TTS_DEFAULT_VOICE;
  const apiKey = process.env.TTS_API_KEY?.trim();
  if (!line) return res.status(400).json({ error: 'line_required' });
  if (!/(?:calls (?:semi last card|last card)|^check up! .+ wins (?:round \d+|the game)!$)/i.test(line)) {
    return res.status(400).json({ error: 'unsupported_callout' });
  }
  if (!apiKey) return res.status(503).json({ error: 'tts_not_configured' });

  const now = Date.now();
  const rateKey = req.ip || req.socket.remoteAddress || 'unknown';
  const bucket = ttsRate.get(rateKey);
  const current = !bucket || bucket.resetAt <= now ? { count: 0, resetAt: now + 10 * 60_000 } : bucket;
  current.count += 1;
  ttsRate.set(rateKey, current);
  if (current.count > 30) return res.status(429).json({ error: 'tts_rate_limited' });

  const key = createHash('sha256').update(`${voice}:${line}`).digest('hex');
  const cached = ttsCache.get(key);
  if (cached) {
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'public, max-age=86400');
    return res.end(cached);
  }
  try {
    const upstream = await fetch(`${TTS_BASE_URL}/tts`, {
      method: 'POST',
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text: line, voice, response_format: 'mp3' }),
    });
    if (!upstream.ok) return res.status(503).json({ error: `tts_provider_${upstream.status}` });
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (ttsCache.size >= TTS_CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value as string);
    ttsCache.set(key, buf);
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'public, max-age=86400');
    return res.end(buf);
  } catch (error) {
    log('warn', 'tts_failed', { error: String(error) });
    return res.status(503).json({ error: 'tts_unavailable' });
  }
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

// Catalog fetches reach the public internet; a DNS/network blip must never crash the server.
await reconcileInstalledGames().catch((error) => log('warn', 'reconcile_failed', { error: String(error) }));
void applyAutomaticUpdates().catch((error) => log('warn', 'auto_update_failed', { error: String(error) }));
setInterval(() => { void applyAutomaticUpdates().catch((error) => log('warn', 'auto_update_failed', { error: String(error) })); }, 60 * 60 * 1000).unref();
// Load owner-reviewed Money Trivia questions over the shipped seed (best-effort; no-op without DB).
void readMoneyTriviaQuestions()
  .then((rows) => hydrateFromRows(rows))
  .then((n) => { if (n) log('info', 'money_trivia_questions_loaded', { count: n }); })
  .catch((error) => log('warn', 'money_trivia_hydrate_failed', { error: String(error) }));

await gameServer.listen(PORT);
log('info', 'server_listening', { port: PORT, protocolVersion: PROTOCOL_VERSION });

function makeUniqueSessionCode(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
  for (let i = 0; i < 4; i += 1) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  } while (getSessionRecord(code));
  return code;
}
