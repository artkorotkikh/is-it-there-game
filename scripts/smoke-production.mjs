import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import { Actor, HttpAgent } from '@icp-sdk/core/agent';
import { idlFactory } from '../src/services/records-api.ts';

// Run after build/deploy: verifies actual served bytes, then real production UI.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:4173/');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const html = await fetch(base);
if (html.status !== 200) throw new Error(`HTML ${html.status}`);
const body = await html.text();
if (sha(body) !== sha(readFileSync('dist/index.html'))) throw new Error('Published HTML differs from this build');
if (base.protocol === 'https:' && !html.headers.get('content-security-policy')?.includes('wasm-unsafe-eval')) throw new Error('Missing WASM CSP');
const checks = [];
for (const path of ['favicon.svg', '.well-known/ii-app-metadata', '.well-known/ii-alternative-origins', 'illustrations/forest-crossing.svg', ...readdirSync('dist/assets').map(name => `assets/${name}`)]) {
  const response = await fetch(new URL(path, base));
  const bytes = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200 || sha(bytes) !== sha(readFileSync(`dist/${path}`))) throw new Error(`Asset mismatch: ${path}`);
  const mime = response.headers.get('content-type') ?? '';
  if (path.endsWith('.js') && !mime.includes('javascript') || path.endsWith('.css') && !mime.includes('text/css') || path.endsWith('.svg') && !mime.includes('image/svg+xml')) throw new Error(`Wrong MIME: ${path}: ${mime}`);
  checks.push({ path, bytes: bytes.length, mime, cache: response.headers.get('cache-control') });
  if (path === '.well-known/ii-alternative-origins') {
    const origins=JSON.parse(bytes).alternativeOrigins;
    if (JSON.stringify(origins)!==JSON.stringify(['https://isitthereyet.nano-tema--0v1.opencloud.org'])) throw new Error('Wrong shared-identity origin');
    if (base.protocol === 'https:' && (!mime.includes('application/json') || response.headers.get('access-control-allow-origin') !== '*')) throw new Error('Invalid alternative-origin headers');
  }
  if (path === '.well-known/ii-app-metadata') {
    if (JSON.parse(bytes).name !== 'IS IT THERE YET?') throw new Error('Wrong Internet Identity app name');
    if (base.protocol === 'https:' && (!mime.includes('application/json') || response.headers.get('access-control-allow-origin') !== '*')) throw new Error('Invalid Internet Identity metadata headers');
  }
}
if ((await fetch(new URL('assets/does-not-exist.js', base))).status !== 404) throw new Error('Unknown assets must return 404');
let backend;
if (base.protocol === 'https:') {
  const cookie = html.headers.getSetCookie().find(value => value.startsWith('ic_env='));
  if (!cookie) throw new Error('Missing canister environment');
  const env = new URLSearchParams(decodeURIComponent(cookie.slice(7).split(';')[0]));
  const canisterId = env.get('PUBLIC_CANISTER_ID:records');
  if (!canisterId) throw new Error('Records canister is not wired to the frontend');
  const mapping=JSON.parse(readFileSync('.icp/data/mappings/ic.ids.json','utf8'));
  for(const name of ['frontend','records','rooms'])if(!mapping[name]||env.get(`PUBLIC_CANISTER_ID:${name}`)!==mapping[name])throw new Error(`Incorrect ${name} canister wiring`);
  const agent = await HttpAgent.create({ host: base.origin });
  const api = Actor.createActor(idlFactory, { agent, canisterId });
  const version = await api.version();
  // Frontend-only releases keep the deployed records service at its own version.
  const recordsConfig = readFileSync('icp.yaml', 'utf8').split('  - name: records\n')[1];
  const expectedVersion = recordsConfig?.match(/name: service:version\s+value: "([^"]+)"/)?.[1];
  if (!expectedVersion || version !== expectedVersion) throw new Error('Wrong records service version');
  if (!('err' in await api.myRecords())) throw new Error('Anonymous visitor could access private records');
  if (!('err' in await api.myProfile())) throw new Error('Anonymous visitor could read a private profile');
  if (!('err' in await api.statistics())) throw new Error('Anonymous visitor could read controller statistics');
  const publicBoards=[];
  for(const [track,rules] of [['old-road',5n],['relay-ridge',4n],['finality-quarry',4n]]) {const result=await api.leaderboard(track,rules);if(!('ok' in result)||result.ok.length>20||result.ok.some(row=>row.isYou))throw new Error('Invalid public leaderboard');publicBoards.push({track,rows:result.ok.length});}
  backend = {canisterId, version, roomsCanisterId:mapping.rooms, anonymousRecords: 'rejected', anonymousProfile:'rejected',anonymousStatistics:'rejected',publicBoards};
}

// Read-only mode never executes the app or writes visit/run counters.
if(process.argv.includes('--read-only')) {
  console.log(JSON.stringify({url:base.href,result:'passed',mode:'read-only',checks,backend},null,2));
  process.exit(0);
}

const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], external = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', r => { if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== base.origin) external.push(r.url()); });
async function untilPrompt(keys, prompt) {
  try {
    for (const key of keys) await page.keyboard.down(key);
    // Slot prompts occupy a short movement window. Sample at animation-frame
    // cadence instead of the assertion library's progressively slower retries.
    await page.waitForFunction(text => document.getElementById('prompt')?.textContent?.includes(text), prompt, { timeout: 12000 });
  } finally { for (const key of keys) await page.keyboard.up(key); }
}
try {
  await page.goto(base.href);
  await expect(page).toHaveTitle('IS IT THERE YET?');
  await expect(page.getByRole('button', { name: 'Take the old road' })).toBeEnabled();
  await expect(page.locator('.track-choice')).toHaveCount(3);
  if (backend) await expect(page.locator('#account-toggle')).toBeEnabled({timeout:30000});
  if (await page.evaluate(() => '__rvDebug' in window)) throw new Error('Development getter exposed in production');
  await page.screenshot({ path: 'test-results/public-icp-title.png' });
  await page.locator('#open-garage').click();await expect(page.locator('#nickname')).toBeDisabled();await expect(page.locator('#profile-unavailable')).toContainText('Sign in');await page.locator('#close-account').click();
  if(backend){await page.locator('#open-leaderboard').click();await expect(page.locator('#board-status')).not.toHaveText('Loading deliveries…',{timeout:15000});if((await page.locator('#board-status').textContent())?.includes('Could not'))throw new Error('Public leaderboard UI failed');await page.locator('#close-account').click();}
  await page.getByRole('button', { name: 'Take the old road' }).click();
  await expect(page.locator('#objective')).toContainText('0/3');
  await untilPrompt(['KeyD'], 'Pick up WINCH'); await page.keyboard.press('KeyE');
  await untilPrompt(['KeyD', 'KeyW'], 'Install WINCH'); await page.keyboard.press('KeyE');
  await expect(page.locator('#module-state-winch')).toHaveText('ONLINE');
  await untilPrompt(['KeyS'], 'Pick up CYCLES'); await page.keyboard.press('KeyE');
  await untilPrompt(['KeyD'], 'Install CYCLES'); await page.keyboard.press('KeyE');
  await expect(page.locator('#module-state-cycles')).toHaveText('ONLINE');
  await untilPrompt(['KeyD'], 'Pick up SKILLS'); await page.keyboard.press('KeyE');
  await untilPrompt(['KeyD'], 'Install SKILLS'); await page.keyboard.press('KeyE');
  await expect(page.locator('#module-state-skills')).toHaveText('ONLINE');
  await page.screenshot({ path: 'test-results/public-icp-loaded.png' });
  await untilPrompt(['KeyA', 'KeyW'], 'E · Get in'); await page.keyboard.press('KeyE');
  await expect(page.locator('#role')).toHaveText('AT THE WHEEL');
  await page.keyboard.down('KeyW');
  await expect(page.locator('#module-state-winch')).toHaveText('OFFLINE', { timeout: 18000 });
  await page.keyboard.up('KeyW'); await page.keyboard.down('Space');
  await expect(page.locator('#cargo-loss')).toBeVisible();
  await expect(page.locator('#cargo-loss')).toHaveCSS('opacity', '1');
  await expect(page.locator('#cargo-loss')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('#cargo-loss')).not.toContainText('CARGO OVERBOARD');
  await expect(page.locator('#cargo-loss')).not.toContainText('Also offline');
  await expect(page.locator('#cargo-loss-title')).toHaveText('WINCH IS LOST');
  await expect(page.locator('#cargo-loss-detail')).toContainText('The cable still holds');
  await page.screenshot({ path: 'test-results/public-icp-loss-announcement.png' });
  await expect(page.locator('#speed')).toHaveText('0', { timeout: 10000 });
  await page.keyboard.up('Space');
  await expect(page.locator('#cargo-loss')).toBeHidden({ timeout: 20000 });
  await expect(page.locator('#warning-title')).toHaveText('WINCH OFFLINE');
  await page.screenshot({ path: 'test-results/public-icp-cargo-lost.png' });
  await page.getByRole('button', { name: 'Sound on' }).click();
  await expect(page.locator('#effects-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Music on' }).click();
  await expect(page.locator('#music-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Pause game' }).click();
  await expect(page.locator('#pause')).toBeVisible();
  if (errors.length || external.length) throw new Error(JSON.stringify({ errors, external }));
  console.log(JSON.stringify({ url: base.href, result: 'passed', title: await page.title(), checks, backend, gameplay: 'three selectable tracks; loaded all three modules, drove, physically lost WINCH, braked, toggled audio and paused', errors, external }, null, 2));
} catch (error) {
  await page.screenshot({ path: 'test-results/public-smoke-failed.png' }).catch(() => {});
  console.error('Production UI:', await page.locator('#prompt').textContent().catch(() => ''), errors);
  throw error;
} finally { await browser.close(); }
