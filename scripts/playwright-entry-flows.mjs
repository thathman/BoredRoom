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
  screen: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
});
const desktopContext = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  screen: { width: 1366, height: 900 },
});
const tabletContext = await browser.newContext({
  viewport: { width: 820, height: 1180 },
  screen: { width: 820, height: 1180 },
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const mobilePage = await mobileContext.newPage();
const desktopPage = await desktopContext.newPage();
const tabletPage = await tabletContext.newPage();
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
  await mobilePage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await mobilePage.getByRole('heading', { name: /Your phone is the controller/i }).waitFor({ timeout: 8000 });
  await mobilePage.getByRole('button', { name: 'Join game night' }).waitFor({ timeout: 8000 });
  if (await mobilePage.getByRole('button', { name: 'Host a game night' }).count()) {
    fail('mobile landing must not expose hosting');
  }
  await assertNoOverflow(mobilePage, 'mobile-controller-home');

  await desktopPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await desktopPage.getByRole('heading', { name: /One room. Every phone is a controller/i }).waitFor({ timeout: 8000 });
  await desktopPage.getByRole('button', { name: 'Host a game night' }).waitFor({ timeout: 8000 });
  if (await desktopPage.getByText('Joining from this device? Enter a code').count()) {
    fail('desktop landing still exposes the removed join prompt');
  }
  await assertNoOverflow(desktopPage, 'desktop-host-home');

  await tabletPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await tabletPage.getByRole('heading', { name: /How is this tablet joining/i }).waitFor({ timeout: 8000 });
  await tabletPage.getByRole('button', { name: /Player controller/i }).waitFor({ timeout: 8000 });
  await tabletPage.getByRole('button', { name: /Host companion/i }).waitFor({ timeout: 8000 });
  if (await tabletPage.getByRole('button', { name: 'Host a game night' }).count()) {
    fail('tablet landing must not expose public display hosting');
  }
  await assertNoOverflow(tabletPage, 'tablet-role-choice');

  console.log('[pw-entry] PASS');
} finally {
  await mobileContext.close();
  await desktopContext.close();
  await tabletContext.close();
  await browser.close();
  if (previewProc && !previewProc.killed) {
    previewProc.kill('SIGTERM');
  }
}
