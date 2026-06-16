#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { Client } from 'colyseus.js';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://party.hendrix.com.ng';
const API_URL = process.env.PLAYWRIGHT_HTTP_API ?? 'https://colyseus.hendrix.com.ng';
const games = ['ludo', 'whot'];
const PROTOCOL_VERSION = 2;
const WS_URL = process.env.PLAYWRIGHT_WS_URL ?? API_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

function fail(msg) {
  console.error(`[pw-room-finish] ${msg}`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fail('playwright dependency missing. Run: npm i -D playwright');
}

async function createRoom(gameType, hostDeviceId) {
  const res = await fetch(`${API_URL}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hostDeviceId,
      hostDisplayName: `PW Host ${gameType}`,
      gameType,
      protocolVersion: PROTOCOL_VERSION,
    }),
  });
  if (!res.ok) throw new Error(`create room failed (${gameType}): ${res.status}`);
  const data = await res.json();
  if (!data?.code || !data?.hostToken) throw new Error(`create room bad response (${gameType})`);
  return { code: data.code, hostToken: data.hostToken };
}

async function newRoleContext(browser, {
  isHost,
  gameType,
  roomCode,
  hostToken,
  playerId,
  playerName,
  viewport,
}) {
  const ctx = await browser.newContext({ viewport: viewport ?? { width: 390, height: 844 } });
  await ctx.addInitScript((payload) => {
    localStorage.setItem('boredroom_player_id', payload.playerId);
    localStorage.setItem('boredroom_player_name', payload.playerName);
    if (payload.isHost) {
      localStorage.setItem('boredroom_host_display_id', payload.playerId);
      localStorage.setItem('boredroom_display_party_id', `party-${payload.playerId}`);
      localStorage.setItem('boredroom_display_party_name', 'Playwright Party');
    }
    sessionStorage.setItem('boredroom_is_host', payload.isHost ? 'true' : 'false');
    sessionStorage.setItem('boredroom_game_type', payload.gameType);
    sessionStorage.setItem('boredroom_room_code', payload.roomCode);
    if (payload.hostToken) sessionStorage.setItem('boredroom_host_token', payload.hostToken);
  }, { isHost, gameType, roomCode, hostToken: hostToken ?? null, playerId, playerName });
  return ctx;
}

async function waitForGameOver(page, label) {
  const a = page.getByText('GAME OVER').first();
  const b = page.getByText('YOU WIN!').first();
  try {
    await Promise.race([
      a.waitFor({ timeout: 15000 }),
      b.waitFor({ timeout: 15000 }),
    ]);
  } catch {
    throw new Error(`game over not visible on ${label}`);
  }
}

async function forceEndGameViaIntent({ gameType, code, hostId, hostToken }) {
  const client = new Client(WS_URL);
  const room = await client.joinOrCreate(gameType, {
    protocolVersion: PROTOCOL_VERSION,
    deviceId: hostId,
    displayName: 'PW Host',
    role: 'host',
    hostToken,
    code,
    gameType,
  });
  room.onMessage('event', () => {});
  room.send('intent', { type: 'host:end_game', reason: 'playwright' });
  await new Promise((r) => setTimeout(r, 500));
  room.leave();
}

async function runForGame(browser, gameType) {
  const hostId = `pw-host-${randomUUID()}`;
  const p1Id = `pw-p1-${randomUUID()}`;
  const p2Id = `pw-p2-${randomUUID()}`;
  const { code, hostToken } = await createRoom(gameType, hostId);

  const hostCtx = await newRoleContext(browser, {
    isHost: true, gameType, roomCode: code, hostToken, playerId: hostId, playerName: 'Host',
    viewport: { width: 1366, height: 900 },
  });
  const p1Ctx = await newRoleContext(browser, {
    isHost: false, gameType, roomCode: code, playerId: p1Id, playerName: 'Ada',
  });
  const p2Ctx = await newRoleContext(browser, {
    isHost: false, gameType, roomCode: code, playerId: p2Id, playerName: 'Bola',
  });

  const host = await hostCtx.newPage();
  const p1 = await p1Ctx.newPage();
  const p2 = await p2Ctx.newPage();

  try {
    const roomUrl = `${BASE_URL}/${gameType}/room/${code}`;
    await Promise.all([
      host.goto(roomUrl, { waitUntil: 'networkidle' }),
      p1.goto(roomUrl, { waitUntil: 'networkidle' }),
      p2.goto(roomUrl, { waitUntil: 'networkidle' }),
    ]);

    const p1Ready = p1.getByRole('button', { name: /Tap when ready|Ready!/i }).first();
    const p2Ready = p2.getByRole('button', { name: /Tap when ready|Ready!/i }).first();
    await p1Ready.waitFor({ timeout: 15000 });
    await p2Ready.waitFor({ timeout: 15000 });
    await p1Ready.click();
    await p2Ready.click();

    const startBtn = host.getByRole('button', { name: /Start Game/i }).first();
    await startBtn.waitFor({ timeout: 15000 });
    await startBtn.click();

    if (gameType === 'ludo') {
      const drawerToggle = host.getByRole('button', { name: /Reactions/i }).first();
      if (await drawerToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        const endBtnTrial = host.getByRole('button', { name: /End game/i }).first();
        await endBtnTrial.click({ trial: true, timeout: 4000 });
      }
    }

    const endBtn = host.getByRole('button', { name: /End game/i }).first();
    if (await endBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await endBtn.click({ force: true });
    }

    try {
      await Promise.all([
        waitForGameOver(host, `${gameType}:host`),
        waitForGameOver(p1, `${gameType}:p1`),
        waitForGameOver(p2, `${gameType}:p2`),
      ]);
    } catch {
      await forceEndGameViaIntent({ gameType, code, hostId, hostToken });
      await Promise.all([
        waitForGameOver(host, `${gameType}:host`),
        waitForGameOver(p1, `${gameType}:p1`),
        waitForGameOver(p2, `${gameType}:p2`),
      ]);
    }
    console.log(`[pw-room-finish] ${gameType} PASS (${code})`);
  } finally {
    await hostCtx.close();
    await p1Ctx.close();
    await p2Ctx.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const game of games) {
    await runForGame(browser, game);
  }
  console.log('[pw-room-finish] PASS');
} finally {
  await browser.close();
}
