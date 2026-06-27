import { chromium } from 'playwright';
import { Client } from '@colyseus/sdk';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const WS_URL = process.env.BOREDROOM_WS_URL ?? (BASE_URL.includes('party.hendrix.com.ng') ? 'wss://colyseus.hendrix.com.ng' : 'ws://127.0.0.1:2567');
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
let controllerRoom;
let tabletContext;
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(`${BASE_URL}/start`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open the room' }).click();
  await page.waitForURL(/\/session\/[A-Z0-9]{4}\/display$/);
  const code = page.url().match(/\/session\/([A-Z0-9]{4})\/display$/)?.[1];
  if (!code) throw new Error('session code missing from display URL');
  controllerRoom = await new Client(WS_URL).joinOrCreate('house-session', {
    code,
    role: 'controller',
    deviceId: `pw-host-controls-${Date.now()}`,
    displayName: 'QA Controller',
  });
  controllerRoom.send('session:ready', { ready: true });
  await page.getByRole('button', { name: 'Games & controls' }).waitFor();
  await page.getByText('QA Controller').waitFor();

  await page.getByRole('button', { name: 'Games & controls' }).click();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Create pairing code' }).click();
  await page.getByText(/^\d{6}$/).waitFor();

  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Advance to games' }).click();
  await page.getByRole('button', { name: 'Call vote' }).click();
  await page.getByRole('button', { name: 'Back to lobby' }).click();
  await page.getByRole('button', { name: 'Dismiss vote from host screen' }).click();
  await page.getByRole('button', { name: 'Dismiss vote from host screen' }).waitFor({ state: 'detached' });

  await page.getByRole('button', { name: 'Advance to games' }).click();
  await page.getByRole('button', { name: /Ludo/ }).click();
  await page.getByRole('button', { name: 'Games & controls' }).click();
  await page.getByRole('heading', { name: 'Game controls' }).waitFor();
  await page.getByRole('button', { name: 'End current game' }).waitFor();
  if (await page.getByRole('button', { name: 'Start' }).count() !== 0) {
    throw new Error('active game drawer leaked the full game catalog');
  }

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'End current game' }).click();
  await page.getByRole('heading', { name: 'Game night recap' }).waitFor();

  tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 1366 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  });
  const companion = await tabletContext.newPage();
  await companion.goto(`${BASE_URL}/session/${code}/companion`, { waitUntil: 'domcontentloaded' });
  const pairingInput = companion.getByLabel('Six-digit companion pairing code');
  await pairingInput.waitFor();
  if (await pairingInput.getAttribute('maxlength') !== '6') throw new Error('companion code input is not six digits');

  if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
  console.log('[pw-host-controls] PASS pairing, vote dismissal, active controls and end-game');
} finally {
  if (controllerRoom) await controllerRoom.leave().catch(() => {});
  if (tabletContext) await tabletContext.close();
  await context.close();
  await browser.close();
}
