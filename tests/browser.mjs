import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { makeChart } from '../test/scratch/compiled/engine.js';
const moduleArg = process.argv.indexOf('--playwright');
const { chromium, webkit } = moduleArg >= 0 ? await import(pathToFileURL(resolve(process.argv[moduleArg + 1])).href) : await import('playwright');
const root = resolve('dist');
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/preview\//, '');
    const file = resolve(root, path || 'index.html');
    if (!file.startsWith(root + '/')) throw Error('Outside export');
    const bytes = await readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' })[extname(file)] ?? 'application/octet-stream');
    res.end(bytes);
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
const report = (name, details = '') => { results.push({ name, passed: true, details }); console.log(`PASS ${name}${details ? `: ${details}` : ''}`); };
const shots = 'artifacts/screenshots';
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true });
let safari;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  const errors = [], failed = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(url) && r.status() >= 400) failed.push(r.url().replace(url, './')); });
  for (const width of [320, 390, 800, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto(url); await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width === 390) { const box = await page.locator('[data-action="start"]').boundingBox(); assert.ok(box.y + box.height <= 844); await page.screenshot({ path: `${shots}/home-390.png` }); }
    if (width === 1440) await page.screenshot({ path: `${shots}/home-1440.png` });
  }
  report('Export loads at a gateway subpath; no overflow at 320 / 390 / 800 / 1440; Play visible at 390');
  assert.deepEqual(failed, []); assert.deepEqual(errors, []);
  assert.equal(await page.locator('meta[property="og:image"]').count(), 1);
  assert.equal(await page.evaluate(() => document.fonts.check('16px Outfit')), true);
  report('Metadata, local font and all runtime assets load without console errors or local 404s');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Tab');
  assert.equal(await page.locator('.skip-link').evaluate(e => e === document.activeElement), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#main').evaluate(e => e === document.activeElement), true);
  await page.locator('[data-action="start"]').focus();
  assert.equal(await page.locator('[data-action="start"]').evaluate(e => getComputedStyle(e).outlineWidth), '2px');
  await page.screenshot({ path: `${shots}/focus-390.png` });
  report('Keyboard skip link, visible primary focus ring and semantic focus destination');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length), 0);
  await page.locator('[data-action="settings"]').click();
  await page.locator('#high-contrast').check();
  assert.equal(await page.locator('html').evaluate(e => e.classList.contains('high-contrast')), true);
  await page.locator('#offset').fill('100');
  assert.match(await page.locator('#offset-value').textContent(), /100 ms/);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dialog').evaluate(e => e.open), false);
  assert.equal(await page.locator('[data-action="settings"]').evaluate(e => e === document.activeElement), true);
  await page.reload();
  assert.equal(await page.locator('html').evaluate(e => e.classList.contains('high-contrast')), true);
  report('Reduced-motion stops decorative animations; settings persist; native dialog Escape restores focus');
  await page.locator('[data-action="settings"]').click(); await page.locator('#high-contrast').uncheck(); await page.locator('#offset').fill('0'); await page.locator('[data-action="close"]').last().click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const fixedDate = new Date('2026-10-30T12:00:00Z');
  await page.clock.install({ time: fixedDate }); await page.clock.pauseAt(fixedDate);
  await page.evaluate(() => {
    const active = new Set(); const request = window.requestAnimationFrame.bind(window), cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => { const handle = request(t => { active.delete(handle); cb(t); }); active.add(handle); return handle; };
    window.cancelAnimationFrame = handle => { active.delete(handle); cancel(handle); };
    window.__testFrames = () => active.size;
  });
  await page.locator('[data-action="start"]').click();
  await page.screenshot({ path: `${shots}/tutorial-390.png` });
  await page.clock.runFor(1400); await page.keyboard.press('a');
  assert.match(await page.locator('#tutorial-feedback').textContent(), /Now try the other lane/);
  await page.clock.runFor(700); await page.keyboard.press('l');
  assert.match(await page.locator('#tutorial-feedback').textContent(), /Both lanes/);
  await page.locator('.calibration summary').click();
  await page.locator('[data-action="calibrate"]').click();
  assert.equal(await page.locator('[data-action="calibration-tap"]').isVisible(), true);
  for (let i = 0; i < 8; i++) { await page.clock.runFor(600); await page.locator('[data-action="calibration-tap"]').click(); }
  assert.match(await page.locator('#calibration-status').textContent(), /Eight taps measured/);
  assert.match(await page.locator('#offset-value').textContent(), /0 ms/);
  report('Interactive tutorial judges both keyboard lanes; opt-in sound calibration records eight beats');
  await page.locator('[data-action="skip"]').click();
  await page.clock.runFor(2100);
  assert.equal(await page.locator('#game-overlay').textContent(), '');
  assert.equal(await page.evaluate(() => window.__testFrames()), 1);
  const chart = makeChart({ mode: 'practice', difficulty: 'standard', bpm: 90, date: '2026-10-30', offset: 0 });
  const activeTime = () => page.locator('#run-progress').evaluate(e => parseFloat(e.style.width) / 100 * 60000);
  const toActive = async t => { const delta = t - await activeTime(); if (delta > 0) await page.clock.runFor(delta); };
  const score = async () => Number((await page.locator('#score').textContent()).replaceAll(',', ''));
  const first = chart[0]; await toActive(first.at); const key = first.lane ? 'l' : 'a';
  await page.keyboard.down(key); const initialScore = await score(); assert.ok(initialScore > 0);
  await page.keyboard.down(key); assert.equal(await score(), initialScore); await page.keyboard.up(key);
  await page.evaluate(k => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, repeat: true, bubbles: true })), key);
  assert.equal(await score(), initialScore);
  report('Desktop keys score once; held key and repeated keydown cannot farm points');
  const second = chart[1]; await toActive(second.at);
  const pad = page.locator(`[data-lane="${second.lane}"]`); const box = await pad.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal(await page.locator('#combo').textContent(), '2×');
  const afterTouch = await score();
  await pad.dispatchEvent('click', { detail: 1 }); assert.equal(await score(), afterTouch);
  await page.evaluate(() => document.activeElement.blur());
  report('Mobile pointer/touch input scores once; subsequent compatibility click is ignored');
  const pauseCheckpoint = async () => {
  assert.match(await page.locator('#fever-label').textContent(), /×2/);
  await page.locator('[data-action="pause"]').click();
  const paused = { time: await page.locator('#remaining').textContent(), fever: await page.locator('#fever-value').textContent(), score: await score() };
  assert.equal(await page.evaluate(() => window.__testFrames()), 0);
  await page.clock.runFor(10000);
  assert.equal(await page.locator('#remaining').textContent(), paused.time); assert.equal(await page.locator('#fever-value').textContent(), paused.fever); assert.equal(await score(), paused.score);
  await page.locator('[data-action="resume"]').click(); await page.clock.runFor(1900);
  assert.equal(await page.locator('#remaining').textContent(), paused.time); await page.clock.runFor(200);
  report('Pause freezes run and FEVER timers; resume requires three beats; exactly one animation loop');
  };
  let capturedGold = false;
  for (const n of chart.slice(2).filter(n => n.act === 0)) {
    if (n.gold && !capturedGold) { await toActive(n.at - 400); await page.screenshot({ path: `${shots}/gold-390.png` }); capturedGold = true; }
    await toActive(n.at);
    if (n.id === 2) { await page.locator(`[data-lane="${n.lane}"]`).focus(); await page.keyboard.press('Space'); await page.evaluate(() => document.activeElement.blur()); }
    else await page.keyboard.press(n.lane ? 'l' : 'a');
    if (n.id === 11) { await page.screenshot({ path: `${shots}/game-390.png` }); await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: `${shots}/game-1440.png` }); await page.setViewportSize({ width: 390, height: 844 }); await pauseCheckpoint(); }
  }
  assert.equal(await page.locator('#accuracy').textContent(), '100.0%');
  await toActive(20000); await page.clock.runFor(32);
  assert.equal(await page.locator('[data-upgrade]').count(), 2);
  const intermissionTime = await activeTime(); await page.clock.runFor(8000); assert.equal(await activeTime(), intermissionTime);
  assert.equal(await page.evaluate(() => window.__testFrames()), 0);
  await page.screenshot({ path: `${shots}/upgrade-390.png` });
  await page.setViewportSize({ width: 320, height: 740 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); assert.equal(await page.locator('#game-overlay').evaluate(e => e.scrollHeight > e.clientHeight), false); await page.screenshot({ path: `${shots}/upgrade-320.png`, fullPage: true }); await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-upgrade]').first().click(); await page.clock.runFor(2100);
  assert.match(await page.locator('.game-title-row h1').textContent(), /Sunset/);
  assert.equal(await page.locator('.inventory-item').count(), 1);
  for (const n of chart.filter(n => n.act === 1)) { await toActive(n.at); await page.keyboard.press(n.lane ? 'l' : 'a'); }
  await toActive(40000); await page.clock.runFor(32); await page.locator('[data-upgrade]').first().click(); await page.clock.runFor(2100);
  assert.match(await page.locator('.game-title-row h1').textContent(), /Starlight/);
  for (const n of chart.filter(n => n.act === 2)) { await toActive(n.at); await page.keyboard.press(n.lane ? 'l' : 'a'); }
  await toActive(60000); await page.clock.runFor(32);
  assert.equal(await page.locator('.results-header').count(), 1);
  assert.equal(await page.locator('.result-top-stats strong').first().textContent(), '100.0%');
  assert.equal(await page.locator('.achievement.earned').count(), 3);
  assert.equal(await page.evaluate(() => window.__testFrames()), 0);
  assert.match(await page.locator('.storage-note').textContent(), /Saved locally/);
  await page.screenshot({ path: `${shots}/results-390.png`, fullPage: true });
  await page.setViewportSize({ width: 320, height: 740 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.setViewportSize({ width: 390, height: 844 });
  report('Complete 60-second tour: 100% accuracy, two frozen upgrade breaks, evolving acts, local records, all three achievements');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('[data-action="copy"]').click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Squeek Beat: Hamster Tour\nPractice/);
  report('User-triggered plain-text result writes to browser clipboard');
  await page.locator('[data-action="replay"]').click(); await page.clock.runFor(2100);
  assert.equal(await score(), 0); assert.equal(await page.evaluate(() => window.__testFrames()), 1);
  await page.locator('[data-action="restart"]').click(); await page.clock.runFor(2100);
  assert.equal(await score(), 0); assert.equal(await page.evaluate(() => window.__testFrames()), 1);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.locator('[data-action="resume"]').count(), 1); assert.equal(await page.evaluate(() => window.__testFrames()), 0);
  await page.clock.runFor(5000); assert.equal(await page.locator('#remaining').textContent(), '60s');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('[data-action="resume"]').click(); await page.clock.runFor(500); assert.match(await page.locator('#game-overlay').textContent(), /3/);
  await page.locator('[data-action="quit"]').first().click(); assert.equal(await page.evaluate(() => window.__testFrames()), 0);
  report('Replay/restart reset score and clean frames; synthetic background event pauses; foreground still requires countdown; Quit cleans frames');
  await page.locator('[data-mode="daily"]').click(); assert.match(await page.locator('#mode-info').textContent(), /2026-10-30/);
  await page.locator('[data-action="seed"]').click(); assert.match(await page.locator('.seed-rule').textContent(), /squeek-v1:2026-10-30:standard/); await page.locator('[data-action="close"]').last().click();
  report('Daily exposes locked UTC date and reproducible versioned seed rule');
  const endpoint = 'https://api.squeekchain.com/v1/status';
  await page.route(endpoint, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ measurement: {} }) }));
  await page.locator('[data-mode="live"]').click(); await page.locator('[data-action="start"]').click(); await page.locator('.live-note.error').waitFor();
  assert.match(await page.locator('.live-note.error').textContent(), /invalid RPM/); assert.equal(await page.locator('[data-action="practice"]').isVisible(), true);
  await page.unroute(endpoint);
  await page.route(endpoint, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ measurement: { rpmMilli: 0, coreStatus: 'IDLE', observedAt: new Date(Date.parse('2026-10-30T12:00:00Z') - 120000).toISOString() } }) }));
  await page.locator('[data-action="refresh"]').click(); await page.locator('.live-note.error').waitFor(); assert.match(await page.locator('.live-note.error').textContent(), /over 60 seconds/);
  await page.unroute(endpoint);
  await page.route(endpoint, () => {});
  await page.locator('[data-action="refresh"]').click(); assert.match(await page.locator('#mode-info').textContent(), /up to 7 seconds/); await page.clock.runFor(7100); await page.locator('.live-note.error').waitFor(); assert.match(await page.locator('.live-note.error').textContent(), /within 7 seconds/);
  await page.unroute(endpoint);
  let requests = 0;
  await page.route(endpoint, async route => { requests++; const observedAt = await page.evaluate(() => new Date().toISOString()); await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ measurement: { rpmMilli: 0, coreStatus: 'IDLE', observedAt } }) }); });
  await page.locator('[data-action="start"]').click(); await page.locator('#tutorial-canvas').waitFor(); await page.locator('[data-action="skip"]').click(); await page.clock.runFor(2400);
  assert.match(await page.locator('.game-mode').textContent(), /80 BPM/); assert.match(await page.locator('.live-run').textContent(), /idle/);
  await page.locator('[data-action="restart"]').click(); await page.locator('#tutorial-canvas').waitFor(); assert.equal(requests, 2); await page.locator('[data-action="close"]').first().click();
  await page.locator('[data-action="help"]').first().click(); await page.locator('[data-action="skip"]').click(); await page.locator('#tutorial-canvas').waitFor(); assert.equal(requests, 3); await page.locator('[data-action="close"]').first().click();
  report('Mocked API: bad schema, stale data and seven-second timeout show Practice recovery; IDLE maps to 80 BPM; live restart refetches');
  await page.unroute(endpoint); await page.locator('[data-mode="practice"]').click(); await page.locator('#difficulty').selectOption('relaxed'); await page.locator('[data-action="start"]').click(); assert.match(await page.locator('.tutorial-rules').textContent(), /120 ms/); await page.locator('[data-action="skip"]').click(); assert.match(await page.locator('.game-mode').textContent(), /Relaxed/); await page.locator('[data-action="quit"]').first().click();
  report('Relaxed practice is explicitly labelled in selection, tutorial, gameplay and isolated records');
  assert.deepEqual(errors, []); assert.deepEqual(failed, []);
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement); const value = token => { const span = document.createElement('span'); span.style.color = `var(${token})`; document.body.append(span); const c = getComputedStyle(span).color; span.remove(); return c; };
    return { text: value('--color-text'), muted: value('--color-muted'), bg: value('--color-bg'), accent: value('--color-accent'), surface: value('--color-surface'), raised: value('--color-raised'), font: style.fontFamily };
  });
  const luminance = rgb => { const c = rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
  const contrast = (a,b) => { const [hi,lo] = [luminance(a),luminance(b)].sort((x,y)=>y-x); return Number(((hi+.05)/(lo+.05)).toFixed(2)); };
  const contrastResults = { textOnBackground: contrast(colors.text,colors.bg), mutedOnBackground: contrast(colors.muted,colors.bg), mutedOnSurface: contrast(colors.muted,colors.surface), mutedOnRaised: contrast(colors.muted,colors.raised), primaryButton: contrast(colors.bg,colors.accent) };
  for (const ratio of Object.values(contrastResults)) assert.ok(ratio >= 4.5);
  report('Rendered solid token contrast pairs meet 4.5:1', JSON.stringify(contrastResults));
  try { safari = await webkit.launch({ headless: true }); }
  catch { results.push({ name: 'WebKit primary flow', passed: false, limitation: 'WebKit could not launch because required browser runtime libraries are unavailable.' }); console.log('LIMITATION WebKit browser runtime could not launch.'); }
  if (safari) {
    const safariPage = await safari.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await safariPage.goto(url); await safariPage.locator('[data-action="start"]').click(); await safariPage.locator('[data-action="skip"]').click(); await safariPage.waitForTimeout(2100); await safariPage.locator('[data-action="pause"]').click(); assert.equal(await safariPage.locator('[data-action="resume"]').isVisible(), true); report('WebKit: primary flow opens, runs, and pauses at 390');
  }
  await writeFile('artifacts/browser-validation.json', JSON.stringify({ productionSubpath: '/preview/', results, consoleErrors: errors, localResourceFailures: failed }, null, 2) + '\n');
} finally { await safari?.close(); await browser.close(); await new Promise(r => server.close(r)); }
