#!/usr/bin/env node
// End-to-end browser test for the session-first platform, desktop + controller (mobile) views.
// Verifies the spec's pack-first landing, device gating (phones join, don't host), the full host
// wizard, all four session screens, legacy game catalog, and the controller join flow.
// Auto-starts `npm run preview` on :8088. Run: npm run smoke:ui-session

import { spawn } from 'node:child_process';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const SHOULD_AUTO_PREVIEW = /^https?:\/\/127\.0\.0\.1:8088/.test(BASE_URL);

function fail(msg) {
  console.error(`[pw-session] FAIL: ${msg}`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fail('playwright dependency missing. Run: npx playwright install chromium');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function isReachable(url) {
  try {
    return (await fetch(url, { method: 'GET' })).ok;
  } catch {
    return false;
  }
}

let previewProc = null;
async function ensurePreviewServer() {
  if (!SHOULD_AUTO_PREVIEW) return;
  if (await isReachable(BASE_URL)) return;
  previewProc = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '8088'], {
    stdio: 'ignore',
    detached: false,
  });
  for (let i = 0; i < 45; i++) {
    if (await isReachable(BASE_URL)) return;
    await sleep(500);
  }
  throw new Error('Preview server did not start in time');
}

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
});
const dpage = await desktop.newPage();
const ppage = await phone.newPage();

async function see(page, selectorText, label, timeout = 8000) {
  try {
    await page.getByText(selectorText, { exact: false }).first().waitFor({ timeout });
  } catch {
    fail(`expected to see "${selectorText}" (${label})`);
  }
}
async function notSee(page, selectorText, label) {
  const count = await page.getByText(selectorText, { exact: false }).count();
  if (count > 0) fail(`did NOT expect "${selectorText}" (${label})`);
}
async function assertNoVerticalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
  if (overflow) fail(`public display should not scroll: ${label}`);
}

try {
  await ensurePreviewServer();

  // ---------- DESKTOP: pack-first landing (bug fix #1) ----------
  await dpage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await see(dpage, 'Game-night packs', 'desktop home pack heading');
  await see(dpage, 'Naija Party', 'pack card');
  await see(dpage, 'Faith & Family', 'pack card');
  await see(dpage, 'Market Day', 'pack card');
  await dpage.getByRole('button', { name: /Host a game night/i }).waitFor({ timeout: 8000 });
  await dpage.getByRole('button', { name: /Browse all games/i }).waitFor({ timeout: 8000 });

  // ---------- DESKTOP: /games legacy catalog ----------
  await dpage.getByRole('button', { name: /Browse all games/i }).click();
  await dpage.waitForURL(/\/games/, { timeout: 8000 });
  await see(dpage, 'All games', 'games page header');
  await see(dpage, 'Ludo', 'legacy game');
  await see(dpage, 'Whot', 'legacy game');
  // legacy game tile routes into the single-game flow
  await dpage.getByRole('button', { name: /Play Ludo/i }).click();
  await dpage.waitForURL(/\/ludo\/(host|join)/, { timeout: 8000 });

  // ---------- DESKTOP: full host wizard (flows 1,5,6) ----------
  await dpage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await dpage.getByRole('button', { name: /Host a game night/i }).click();
  await dpage.waitForURL(/\/start/, { timeout: 8000 });
  await see(dpage, 'Pick your packs', 'wizard step 1');
  if (!(await dpage.getByRole('button', { name: 'Next' }).isDisabled())) fail('Next should gate before pack selection');
  await dpage.getByText('Naija Party').click();
  await dpage.getByRole('button', { name: 'Next' }).click();
  await see(dpage, 'Set the house rules', 'wizard step 2');
  await dpage.getByRole('button', { name: 'Next' }).click();
  await see(dpage, 'Review & start', 'wizard step 3');
  await dpage.getByRole('button', { name: /Start the house/i }).click();
  await dpage.waitForURL(/\/session\/.+\/display/, { timeout: 10000 });
  await see(dpage, 'Public Display', 'display shell');
  await see(dpage, "Tonight's lineup", 'display lineup');
  await assertNoVerticalScroll(dpage, 'session-display'); // AC-4.2

  // ---------- DESKTOP: resume offered after hosting (flow 2) ----------
  await dpage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await dpage.getByRole('button', { name: /Continue your house/i }).waitFor({ timeout: 8000 });

  // ---------- DESKTOP: other session screens (flows 4 + crowd + redirect) ----------
  await dpage.goto(`${BASE_URL}/session/TESTCODE/operator?pack=pack.naija`, { waitUntil: 'networkidle' });
  await see(dpage, 'Operator Console', 'operator shell');
  await dpage.goto(`${BASE_URL}/session/TESTCODE/crowd?pack=pack.market`, { waitUntil: 'networkidle' });
  await see(dpage, 'Crowd', 'crowd shell');
  await dpage.goto(`${BASE_URL}/session/TESTCODE/bogus`, { waitUntil: 'networkidle' });
  await dpage.waitForURL(/\/session\/TESTCODE\/display/, { timeout: 8000 });

  // ---------- MOBILE: device gating (bug fix #2) ----------
  await ppage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await ppage.getByRole('button', { name: /Join a game night/i }).waitFor({ timeout: 8000 });
  await notSee(ppage, 'Host a game night', 'phone must not be offered hosting');

  // a phone that forces /start is steered to join, not allowed to host
  await ppage.goto(`${BASE_URL}/start`, { waitUntil: 'networkidle' });
  await see(ppage, 'Hosting needs a bigger screen', 'phone host gate');
  await ppage.getByRole('button', { name: /Join as controller/i }).click();
  await ppage.waitForURL(/\/join/, { timeout: 8000 });

  // ---------- MOBILE: join as controller (flow 3) ----------
  await see(ppage, 'Join the game night', 'join page');
  await ppage.getByLabel('Session code').fill('Q7E8X');
  await ppage.getByRole('button', { name: /Join as controller/i }).click();
  await ppage.waitForURL(/\/session\/Q7E8X\/controller/, { timeout: 8000 });
  await see(ppage, 'Controller', 'controller shell');
  await see(ppage, 'Waiting for the host', 'controller waiting state');

  console.log('[pw-session] PASS — desktop + controller flows verified');
} finally {
  await desktop.close();
  await phone.close();
  await browser.close();
  if (previewProc && !previewProc.killed) previewProc.kill('SIGTERM');
}
