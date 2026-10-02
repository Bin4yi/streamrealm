// Take README screenshots with Playwright. Needs both servers running.
//   npm i -D playwright && npx playwright install chromium   (once, in any folder)
//   node scripts/screenshots.mjs [outDir]
import { chromium } from 'playwright';

const APP = process.env.APP_URL ?? 'http://localhost:8081';
const API = process.env.API_URL ?? 'http://localhost:8000';
const OUT = process.argv[2] ?? 'docs/screenshots';
const json = async (path, init) => (await fetch(API + path, init)).json();
const post = (path, body) => json(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });

await post('/dev/reset');
await post('/dev/storm?on=auto');
const tiles = await json('/cities/coimbra/tiles');
const fog = tiles.features.find((f) => f.properties.state === 'fog' && f.properties.stream_name === 'Ribeira de Coselhas') ?? tiles.features.find((f) => f.properties.state === 'fog');
const player = await post('/players', { nickname: 'RiverFox', avatar: 'otter', team: 'otters' });
const [lon, lat] = fog.properties.center;

const browser = await chromium.launch();
const phone = await browser.newContext({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
const page = await phone.newPage();
const shot = async (name, p = page) => {
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log('saved', name);
};

await page.goto(APP + '/onboarding', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await shot('01-onboarding');
await page.evaluate(
  ([pl, pos]) =>
    localStorage.setItem('streamrealm-game', JSON.stringify({ state: { player: pl, position: pos, devPanelEnabled: true, city: 'coimbra', timeWarpDays: 0 }, version: 0 })),
  [{ id: player.id, nickname: player.nickname, avatar: player.avatar, team: player.team }, { lat, lon }],
);
await page.goto(APP + '/map', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
await shot('03-map-check-this-tile');
for (let i = 0; i < 2; i++) await page.getByLabel('Zoom out').click();
await page.waitForTimeout(9000); // let the base map tiles load
await shot('02-map-teams');
for (let i = 0; i < 2; i++) await page.getByLabel('Zoom in').click();
await page.waitForTimeout(4000);
await page.getByTestId('check-tile').waitFor({ timeout: 20000 });

await page.getByTestId('check-tile').click();
await page.getByTestId('safety-ok').click();
await page.getByTestId('use-demo').click();
await shot('04-claim-photo');
await page.getByTestId('photo-next').click();
await page.waitForTimeout(400);
await page.getByTestId('photo-next').click();
for (const [q, v] of [['color', 'slightly_cloudy'], ['smell', 'none'], ['foam', 'a_little'], ['trash', 'a_few'], ['flow', 'flowing'], ['overall', 'good']]) {
  if (q === 'foam') await shot('05-claim-question');
  await page.getByTestId(`opt-${q}-${v}`).click();
  await page.waitForTimeout(450);
}
await page.getByTestId('treasure-pipe').click();
await page.getByTestId('submit-check').click();
await page.waitForTimeout(2500);
await shot('06-photo-check');
await page.getByTestId('claim-it').click();
await page.waitForTimeout(1200);
await shot('07-victory');
await page.getByTestId('victory-done').click();
await page.waitForTimeout(1800);
await shot('08-map-paint');

await post('/dev/storm?on=true');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.getByLabel('Open Dev Panel').click();
await shot('09-dev-panel-storm');
await post('/dev/storm?on=auto');

for (const [tab, name] of [['Kingdom', '10-kingdom'], ['Quests', '11-quests'], ['Ranks', '12-leaderboard'], ['Profile', '13-profile']]) {
  await page.getByRole('tab', { name: tab }).click();
  await page.waitForTimeout(2500);
  await shot(name);
}

const desk = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const dash = await desk.newPage();
await dash.goto(APP + '/onboarding', { waitUntil: 'domcontentloaded' });
await dash.evaluate((pl) => localStorage.setItem('streamrealm-game', JSON.stringify({ state: { player: pl, devPanelEnabled: true, city: 'coimbra' }, version: 0 })), {
  id: player.id,
  nickname: player.nickname,
  avatar: player.avatar,
  team: player.team,
});
await dash.goto(APP + '/dashboard', { waitUntil: 'networkidle' });
await dash.waitForTimeout(6000);
await shot('14-dashboard', dash);
await dash.mouse.move(700, 200); // over the KPI row, so the page scrolls (not the map)
await dash.mouse.wheel(0, 950);
await dash.waitForTimeout(1500);
await shot('15-dashboard-treasures', dash);
await dash.mouse.move(700, 100);
await dash.mouse.wheel(0, 3000);
await dash.waitForTimeout(1500);
await shot('16-dashboard-experiment', dash);
await browser.close();
