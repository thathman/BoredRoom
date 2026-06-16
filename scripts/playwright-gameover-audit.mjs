#!/usr/bin/env node
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const games = ['ludo', 'whot', 'trivia', 'logo', 'color-wahala', 'landlord', 'connect-4', 'ettt'];

function fail(msg) {
  console.error(`[pw-audit] ${msg}`);
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  fail('playwright dependency missing. Run: npm i -D playwright');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

async function assertNoOverflow(label) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
  if (overflow) fail(`horizontal overflow detected on ${label}`);
}

try {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await assertNoOverflow('home');
  // Active catalog coverage + retired game guard.
  const expectedCatalogNames = ['Ludo', 'Whot', 'Who Sabi Pass?', 'Logo Guesser', 'Oga Landlord', 'Connect 4', 'Endless Tic Tac Toe', 'Color Wahala'];
  for (const name of expectedCatalogNames) {
    await page.getByText(name).first().waitFor({ timeout: 8000 });
  }
  const retiredHalfHalf = await page.getByText('Half & Half').isVisible().catch(() => false);
  if (retiredHalfHalf) fail('retired game "Half & Half" is still visible in catalog');

  await page.goto(`${BASE_URL}/ludo/join`, { waitUntil: 'networkidle' });
  await assertNoOverflow('join');
  // Controller surface should not expose host role switch affordance.
  const switchToHost = await page.getByText('Switch to Host').first().isVisible().catch(() => false);
  if (switchToHost) fail('controller join page still shows Switch to Host affordance');

  await page.goto(`${BASE_URL}/ludo/host`, { waitUntil: 'networkidle' });
  await assertNoOverflow('host');
  // Display surface should not expose join role switch affordance.
  const switchToJoin = await page.getByText('Switch to Join').first().isVisible().catch(() => false);
  if (switchToJoin) fail('host page still shows Switch to Join affordance');

  for (const game of games) {
    await page.goto(`${BASE_URL}/dev/gameover/${game}`, { waitUntil: 'networkidle' });
    await page.getByText(game.toUpperCase(), { exact: true }).first().waitFor({ timeout: 8000 });
    const headline = page.getByText('YOU WIN!').first();
    const fallbackHeadline = page.getByText('GAME OVER').first();
    if (!(await headline.isVisible().catch(() => false))) {
      await fallbackHeadline.waitFor({ timeout: 8000 });
    }
    await page.getByText('Final Standings').first().waitFor({ timeout: 8000 });
    await assertNoOverflow(`gameover:${game}`);
  }

  console.log('[pw-audit] PASS');
} finally {
  await browser.close();
}
