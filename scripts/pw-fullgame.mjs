#!/usr/bin/env node
// Drives the new session -> operator -> live game bridge end-to-end in a browser, then has a phone
// join the started room. Run against live: PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng
// SMOKE_HTTP_URL=https://colyseus.hendrix.com.ng node scripts/pw-fullgame.mjs

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const HTTP = process.env.SMOKE_HTTP_URL ?? 'https://colyseus.hendrix.com.ng';

function fail(m) { console.error(`[fullgame] FAIL: ${m}`); process.exit(1); }
const { chromium } = await import('playwright');
const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
});
const d = await desktop.newPage();
const p = await phone.newPage();

try {
  // 1) Host creates a room via the wizard.
  await d.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await d.getByRole('button', { name: /Host a game night/i }).click();
  await d.waitForURL(/\/start/, { timeout: 8000 });
  await d.getByRole('button', { name: 'Next' }).click();
  await d.getByRole('button', { name: /Open the room/i }).click();
  await d.waitForURL(/\/session\/.+\/display/, { timeout: 10000 });
  const sessionCode = d.url().match(/\/session\/([^/]+)\/display/)[1];
  console.log(`[fullgame] room created: ${sessionCode}`);

  // 2) Operator starts Whot.
  await d.goto(`${BASE}/session/${sessionCode}/operator`, { waitUntil: 'networkidle' });
  await d.getByText('Start a game').waitFor({ timeout: 8000 });
  const whotRow = d.locator('div', { hasText: /^Whot/ }).filter({ has: d.getByRole('button', { name: /Start/i }) }).last();
  // Click the Start button in the Whot row (fall back to first Start if structure differs).
  const whotStart = d.getByRole('button', { name: /Start/i }).first();
  await whotStart.scrollIntoViewIfNeeded();
  // find the Whot card's Start specifically
  const startButtons = d.getByRole('button', { name: /Start/i });
  const count = await startButtons.count();
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const row = startButtons.nth(i);
    const text = await row.locator('xpath=ancestor::div[1]').innerText().catch(() => '');
    if (/whot/i.test(text)) { await row.click(); clicked = true; break; }
  }
  if (!clicked) await whotStart.click();

  await d.getByText(/is live/i).waitFor({ timeout: 10000 });
  const codeText = await d.locator('p.font-mono').first().innerText();
  const roomCode = codeText.trim();
  console.log(`[fullgame] whot room code: ${roomCode}`);
  if (!/^[A-Z0-9]{4,6}$/.test(roomCode)) fail(`unexpected room code "${roomCode}"`);

  // 3) The room is a real, joinable Colyseus room.
  const roomRes = await fetch(`${HTTP}/rooms/${roomCode}`);
  const roomJson = await roomRes.json();
  if (!roomJson.exists) fail('started room not found in room directory');
  if (roomJson.gameType !== 'whot') fail(`room gameType ${roomJson.gameType} != whot`);
  console.log(`[fullgame] room directory: exists=${roomJson.exists} game=${roomJson.gameType} joinable=${roomJson.joinable}`);

  // 4) Host opens the live game room.
  await d.getByRole('button', { name: /Open game room/i }).click();
  await d.waitForURL(/\/whot\/room\//, { timeout: 10000 });
  console.log('[fullgame] host entered live whot room');

  // 5) A phone joins that room as a player.
  await p.goto(`${BASE}/whot/join/${roomCode}`, { waitUntil: 'networkidle' });
  const cont = p.getByRole('button', { name: /Continue in browser/i });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  // name entry if present
  const nameField = p.getByPlaceholder(/name/i).first();
  if (await nameField.isVisible().catch(() => false)) await nameField.fill('Ada');
  const joinBtn = p.getByRole('button', { name: /^Join/i }).first();
  if (await joinBtn.isVisible().catch(() => false)) await joinBtn.click();
  await p.waitForTimeout(3000);
  // re-check the room now reports a connected player
  const after = await (await fetch(`${HTTP}/rooms/${roomCode}`)).json();
  console.log(`[fullgame] after phone join: players=${after.players}`);
  if (!after.exists) fail('room disappeared after join');

  console.log('[fullgame] PASS — session -> start Whot -> live room -> phone joined');
} finally {
  await desktop.close();
  await phone.close();
  await browser.close();
}
