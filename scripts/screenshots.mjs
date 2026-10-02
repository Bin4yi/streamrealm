// README / design-system screenshots with Playwright. Needs the API server running.
//   npm i -D playwright && npx playwright install chromium   (once, in any folder)
// Best against the production web build (the dev server can be slow to send its large bundle):
//   cd app && npx expo export --platform web && npx serve -s dist -l 8090
//   APP_URL=http://localhost:8090 node scripts/screenshots.mjs [outDir]
// Resets the demo world first.
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:8000';
const OUT = process.argv[2] ?? 'docs/screenshots';
// Base-map tiles come from OpenFreeMap over the internet; give them time (MAP_WAIT ms).
const MAP_WAIT = Number(process.env.MAP_WAIT ?? 15000);
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5 };
const ANSWERS = { color: 'clear', smell: 'none', foam: 'none', trash: 'a_few', flow: 'flowing', overall: 'good' };

const json = async (path, init) => (await fetch(API + path, init)).json();
const post = (path, body) => json(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
const newPlayer = (nickname, avatar, team) => post('/players', { nickname, avatar, team });
async function apiCheck(player, tile) {
  const fd = new FormData();
  const [lon, lat] = tile.properties.center;
  Object.entries({ player_id: player.id, tile_id: tile.id, lat, lon, answers: JSON.stringify(ANSWERS), demo_photos: 'true' }).forEach(([k, v]) => fd.append(k, String(v)));
  const d = await (await fetch(API + '/observations', { method: 'POST', body: fd })).json();
  return post(`/observations/${d.observation_id}/confirm-ai`, { answers: ANSWERS });
}

const browser = await chromium.launch();
const errors = [];
async function phonePage(player, state = {}) {
  const page = await (await browser.newContext(PHONE)).newPage();
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 200)));
  await page.goto(APP + '/onboarding', { waitUntil: 'domcontentloaded' });
  if (player) {
    await page.evaluate(
      ([pl, st]) => localStorage.setItem('streamrealm-game', JSON.stringify({ state: { player: pl, devPanelEnabled: true, timeWarpDays: 0, ...st }, version: 0 })),
      [{ id: player.id, nickname: player.nickname, avatar: player.avatar, team: player.team }, state],
    );
  }
  return page;
}
// The map streams tiles forever, so "networkidle" can time out: use "load" + a wait instead.
const open = (page, path) => page.goto(APP + path, { waitUntil: 'load', timeout: 60000 });
const shot = async (page, name, wait = 700) => {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
};

await post('/dev/reset');
await post('/dev/storm?on=auto');
const tiles = await json('/cities/coimbra/tiles');
const fogs = tiles.features.filter((f) => f.properties.state === 'fog');
const fog = fogs.find((f) => f.properties.stream_name === 'Ribeira de Coselhas') ?? fogs[0];

// ---- onboarding ----
let page = await phonePage(null);
await open(page, '/onboarding');
await shot(page, '01-onboarding-1', 2500);
for (const i of [2, 3]) {
  await page.getByTestId('onb-next').click();
  await shot(page, `01-onboarding-${i}`, 900);
}
await page.getByTestId('onb-next').click();
await page.getByTestId('team-otters').click();
await page.getByTestId('nickname').fill('RiverFox');
await shot(page, '02-team-pick', 1200);

// ---- map: HUD, zoom levels, storm ----
const fox = await newPlayer('RiverFox', 'fox', 'otters');
const [lon, lat] = fog.properties.center;
page = await phonePage(fox, { position: { lat, lon } });
await open(page, '/map');
await shot(page, '03-map-hud', MAP_WAIT);
await page.getByLabel('Zoom out').click();
await shot(page, '05-map-zoom-mid', MAP_WAIT);
await page.getByLabel('Zoom out').click();
await page.getByLabel('Zoom out').click();
await shot(page, '05-map-zoom-far', MAP_WAIT);
for (let i = 0; i < 4; i++) await page.getByLabel('Zoom in').click();
await shot(page, '05-map-zoom-near', MAP_WAIT);
await post('/dev/storm?on=true');
await page.reload({ waitUntil: 'load' });
await shot(page, '04-map-storm', MAP_WAIT);
await post('/dev/storm?on=auto');

// ---- claim flow ----
await page.reload({ waitUntil: 'load' });
await page.getByTestId('check-tile').waitFor({ timeout: 30000 });
await page.waitForTimeout(3000);
await page.getByTestId('check-tile').click();
await shot(page, '07-claim-safety', 1200);
await page.getByTestId('safety-ok').click();
await page.getByTestId('use-demo').click();
await shot(page, '08-claim-photo', 1200);
await page.getByTestId('photo-next').click();
await page.waitForTimeout(500);
await page.getByTestId('photo-next').click();
for (const [q, v] of [['color', 'slightly_cloudy'], ['smell', 'none'], ['foam', 'a_little'], ['trash', 'a_few'], ['flow', 'flowing'], ['overall', 'good']]) {
  if (q === 'foam') await shot(page, '09-claim-question', 700);
  await page.getByTestId(`opt-${q}-${v}`).click();
  await page.waitForTimeout(650);
}
await page.getByTestId('treasure-pipe').click();
await shot(page, '10-claim-treasure', 700);
await page.getByTestId('submit-check').click();
await page.getByTestId('claim-it').waitFor({ timeout: 20000 });
await shot(page, '11-claim-check', 800);
await page.getByTestId('claim-it').click();
await shot(page, '12-victory-mid', 700);
await shot(page, '13-victory', 2200);
await page.getByTestId('victory-done').click();
await shot(page, '14-map-paint', 2200);

// ---- tile sheet ----
const rich = tiles.features.find((f) => f.properties.state === 'owned_fresh' && f.properties.treasures > 0) ?? tiles.features.find((f) => f.properties.state === 'owned_fresh');
const [rl, rt] = rich.properties.center;
page = await phonePage(fox, { position: { lat: rt + 0.0008, lon: rl } });
await open(page, '/map');
await page.getByTestId('walk-closer').waitFor({ timeout: 30000 });
await page.waitForTimeout(3000);
await page.getByTestId('walk-closer').click();
await shot(page, '06-tile-sheet', MAP_WAIT / 2);

// ---- kingdom plant stages, quests, leaderboard, profile ----
const mira = await newPlayer('MossyMira', 'owl', 'frogs');
for (const t of fogs.slice(1, 6)) await apiCheck(mira, t); // 5 explores -> Explorer badge
page = await phonePage(mira);
for (const [h, name] of [[12, '15-kingdom-stage-1'], [50, '15-kingdom-stage-3'], [92, '15-kingdom-stage-5']]) {
  await open(page, `/kingdom?preview=${h}`);
  await shot(page, name, 3500);
}
await open(page, '/quests');
await shot(page, '16-quests', 3500);
await page.mouse.move(195, 500);
await page.mouse.wheel(0, 5000);
await shot(page, '16-quests-chest', 1500);
await open(page, '/leaderboard');
await shot(page, '17-leaderboard', 3500);
await open(page, '/profile');
await page.waitForTimeout(3000);
await page.mouse.move(195, 500);
await page.mouse.wheel(0, 420);
await shot(page, '18-profile-badges', 1200);
await page.getByLabel(/Explorer badge/).click();
await shot(page, '19-badge-modal', 1500);

// ---- kit, empty states ----
page = await phonePage(mira);
await open(page, '/kit');
await shot(page, '20-kit', 3500);
await page.mouse.move(195, 500);
await page.mouse.wheel(0, 900);
await shot(page, '21-empty-states', 1500);

// ---- dashboard (professional, not game-styled) ----
const desk = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await desk.goto(APP + '/onboarding', { waitUntil: 'domcontentloaded' });
await desk.evaluate((pl) => localStorage.setItem('streamrealm-game', JSON.stringify({ state: { player: pl }, version: 0 })), { id: mira.id, nickname: mira.nickname, avatar: mira.avatar, team: mira.team });
await open(desk, '/dashboard');
await shot(desk, '22-dashboard', MAP_WAIT);
await desk.mouse.move(700, 200);
await desk.mouse.wheel(0, 900);
await shot(desk, '23-dashboard-treasures', 1500);
await desk.mouse.move(700, 100);
await desk.mouse.wheel(0, 3000);
await shot(desk, '24-dashboard-experiment', 1500);

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
