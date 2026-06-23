#!/usr/bin/env node
// Phase 10 e2e: session-first UX flows (start game night, choose pack, house rules, multi-screen
// shells, public-display no-scroll). Mirrors the existing standalone playwright scripts: auto-starts
// `npm run preview` on :8088 and drives chromium. Covers flow-map flows 1, 3, 4, 5, 6 + AC-4.2.

import { spawn } from 'node:child_process';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const SHOULD_AUTO_PREVIEW = /^https?:\/\/127\.0\.0\.1:8088/.test(BASE_URL);

function fail(msg) {
  console.error(`[pw-session] ${msg}`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fail('playwright dependency missing. Run: npm i -D playwright');
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
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const dpage = await desktop.newPage();
const ppage = await phone.newPage();

async function assertNoVerticalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 1);
  if (overflow) fail(`public display should not scroll: ${label}`);
}

try {
  await ensurePreviewServer();

  // Flow 1 + 5 + 6: start a game night via the pack-first wizard.
  await dpage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await dpage.getByRole('button', { name: /Host a game night/i }).click();
  await dpage.waitForURL(/\/start/, { timeout: 8000 });
  await dpage.getByText('Pick your packs').waitFor({ timeout: 8000 });

  // Next is gated until a pack is chosen.
  if (!(await dpage.getByRole('button', { name: 'Next' }).isDisabled())) {
    fail('Next should be disabled before a pack is selected');
  }
  await dpage.getByText('Naija Party').click();
  await dpage.getByRole('button', { name: 'Next' }).click(); // -> settings
  await dpage.getByText('Set the house rules').waitFor({ timeout: 8000 });
  await dpage.getByRole('button', { name: 'Next' }).click(); // -> review
  await dpage.getByText('Review & start').waitFor({ timeout: 8000 });
  await dpage.getByRole('button', { name: /Start the house/i }).click();

  // Lands on the public display for the new session.
  await dpage.waitForURL(/\/session\/.+\/display/, { timeout: 10000 });
  await dpage.getByText('Public Display').waitFor({ timeout: 8000 });
  await dpage.getByText('Naija Party').waitFor({ timeout: 8000 });
  await dpage.getByText(/Tonight's lineup/i).waitFor({ timeout: 8000 });
  await assertNoVerticalScroll(dpage, 'session-display'); // AC-4.2

  // Flow 2: returning home now offers a one-tap resume of the house just created.
  await dpage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await dpage.getByRole('button', { name: /Continue your house/i }).waitFor({ timeout: 8000 });

  // Flow 3: controller shell on a phone.
  await ppage.goto(`${BASE_URL}/session/TESTCODE/controller?pack=pack.naija`, { waitUntil: 'networkidle' });
  await ppage.getByText('Controller').first().waitFor({ timeout: 8000 });
  await ppage.getByText(/Waiting for the host/i).waitFor({ timeout: 8000 });

  // Flow 4: operator console.
  await dpage.goto(`${BASE_URL}/session/TESTCODE/operator?pack=pack.naija`, { waitUntil: 'networkidle' });
  await dpage.getByText('Operator Console').waitFor({ timeout: 8000 });

  // Crowd shell + unknown screen redirect.
  await dpage.goto(`${BASE_URL}/session/TESTCODE/crowd?pack=pack.market`, { waitUntil: 'networkidle' });
  await dpage.getByText('Crowd').first().waitFor({ timeout: 8000 });
  await dpage.goto(`${BASE_URL}/session/TESTCODE/bogus`, { waitUntil: 'networkidle' });
  await dpage.waitForURL(/\/session\/TESTCODE\/display/, { timeout: 8000 });

  console.log('[pw-session] PASS');
} finally {
  await desktop.close();
  await phone.close();
  await browser.close();
  if (previewProc && !previewProc.killed) previewProc.kill('SIGTERM');
}
