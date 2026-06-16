#!/usr/bin/env node
import { spawn } from 'node:child_process';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const SHOULD_AUTO_PREVIEW = /^https?:\/\/127\.0\.0\.1:8088/.test(BASE_URL);

function fail(msg) {
  console.error(`[pw-entry] ${msg}`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fail('playwright dependency missing. Run: npm i -D playwright');
}

const browser = await chromium.launch({ headless: true });
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
});
const desktopContext = await browser.newContext({
  viewport: { width: 1366, height: 900 },
});
const mobilePage = await mobileContext.newPage();
const desktopPage = await desktopContext.newPage();
let previewProc = null;

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function isReachable(url) {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensurePreviewServer() {
  if (!SHOULD_AUTO_PREVIEW) return;
  if (await isReachable(BASE_URL)) return;
  if (process.platform === 'win32') {
    // Windows can raise EINVAL with direct spawn in some sandboxed contexts.
    previewProc = spawn('cmd.exe', ['/d', '/s', '/c', 'npm run preview -- --host 127.0.0.1 --port 8088'], {
      stdio: 'ignore',
      detached: false,
      windowsHide: true,
    });
  } else {
    previewProc = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '8088'], {
      stdio: 'ignore',
      detached: false,
    });
  }
  let spawnErr = null;
  previewProc.on('error', (err) => {
    spawnErr = err;
  });
  for (let i = 0; i < 45; i++) {
    if (spawnErr) throw new Error(`preview spawn failed: ${spawnErr.message}`);
    if (await isReachable(BASE_URL)) return;
    await sleep(500);
  }
  throw new Error('Preview server did not start in time');
}

async function assertNoOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  if (overflow) fail(`horizontal overflow detected on ${label}`);
}

try {
  await ensurePreviewServer();
  await mobilePage.goto(`${BASE_URL}/ludo/join`, { waitUntil: 'networkidle' });
  await mobilePage.getByText('Best experience: install the controller app').first().waitFor({ timeout: 8000 });
  await mobilePage.getByRole('button', { name: 'Install app' }).waitFor({ timeout: 8000 });
  await mobilePage.getByRole('button', { name: 'Continue in browser' }).waitFor({ timeout: 8000 });
  await assertNoOverflow(mobilePage, 'mobile-join-install-gate');

  await desktopPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await desktopPage.evaluate(() => {
    sessionStorage.setItem('boredroom_room_code', 'ABCD');
    sessionStorage.setItem('boredroom_game_type', 'ludo');
    sessionStorage.setItem('boredroom_is_host', 'true');
  });
  await desktopPage.reload({ waitUntil: 'networkidle' });
  await desktopPage.getByText('Active game detected').first().waitFor({ timeout: 8000 });
  await desktopPage.getByRole('button', { name: 'Continue game' }).waitFor({ timeout: 8000 });
  await assertNoOverflow(desktopPage, 'desktop-home-continue-card');

  await desktopPage.goto(`${BASE_URL}/ludo/host`, { waitUntil: 'networkidle' });
  await desktopPage.getByText('Active game detected').first().waitFor({ timeout: 8000 });
  await desktopPage.getByRole('button', { name: 'Host Ludo' }).waitFor({ timeout: 8000 });
  const hostDisabled = await desktopPage.getByRole('button', { name: 'Host Ludo' }).isDisabled();
  if (!hostDisabled) fail('host create button should be disabled while active session conflict exists');
  await desktopPage.getByRole('button', { name: /Dismiss/i }).click();
  const hostReEnabled = await desktopPage.getByRole('button', { name: 'Host Ludo' }).isEnabled();
  if (!hostReEnabled) fail('host create button did not re-enable after dismissing session conflict');
  await assertNoOverflow(desktopPage, 'host-continue-card');

  await desktopPage.goto(`${BASE_URL}/ludo/join`, { waitUntil: 'networkidle' });
  await desktopPage.evaluate(() => {
    sessionStorage.setItem('boredroom_room_code', 'ABCD');
    sessionStorage.setItem('boredroom_game_type', 'ludo');
    sessionStorage.setItem('boredroom_is_host', 'false');
  });
  await desktopPage.reload({ waitUntil: 'networkidle' });
  const joinVisible = await desktopPage.getByRole('button', { name: 'Join game' }).isVisible().catch(() => false);
  if (!joinVisible) {
    await desktopPage.getByRole('button', { name: 'Next' }).waitFor({ timeout: 8000 });
  }
  const joinDisabled = await desktopPage.getByRole('button', { name: /Join game|Next/ }).first().isDisabled();
  if (!joinDisabled) fail('join CTA should be disabled while active session conflict exists');
  await assertNoOverflow(desktopPage, 'join-no-install-gate-desktop');

  console.log('[pw-entry] PASS');
} finally {
  await mobileContext.close();
  await desktopContext.close();
  await browser.close();
  if (previewProc && !previewProc.killed) {
    previewProc.kill('SIGTERM');
  }
}


