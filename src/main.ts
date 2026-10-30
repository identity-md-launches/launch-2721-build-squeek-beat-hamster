import './style.css';
import { Game, RUN_MS, ACT_MS, UPGRADE_INFO, upgradeChoices, rating, type Config, type Mode, type Difficulty, type Lane, type Upgrade, type Feedback } from './engine';
import { fetchWheel, isFresh, STATUS_URL, type WheelData } from './live';
import { getRecord, saveRun, getAchievements, ACHIEVEMENTS, type SaveResult } from './records';
import { hamsterScene, icon } from './art';
import { GameAudio } from './audio';

const app = document.querySelector<HTMLDivElement>('#app')!;
const audio = new GameAudio();
const names: Record<Mode, string> = { practice: 'Practice', daily: 'Daily', live: 'Live wheel' };
const acts = ['Garden groove', 'Sunset sprint', 'Starlight finale'];
let mode: Mode = 'practice';
let difficulty: Difficulty = 'standard';
let offset = 0;
let highContrast = false;
let screen: 'home' | 'game' | 'results' = 'home';
let phase: 'countdown' | 'running' | 'paused' | 'upgrade' | 'results' = 'paused';
let game: Game | null = null;
let save: SaveResult | null = null;
let wheel: WheelData | null = null;
let liveError = '';
let loadingLive = false;
let fetchController: AbortController | null = null;
let liveIntent = 0;
let liveReady = false;
let frame = 0;
let lastFrame = 0;
let countdownStart = 0;
let lastCount = -1;
let lastPulse = -1;
let tutorialFrame = 0;
let tutorialStart = 0;
let tutorialHits = new Set<Lane>();
let calibrationStart = 0;
let calibrationTaps: number[] = [];
let calibrationBeat = -1;
let resultCopy = '';
const heldKeys = new Set<string>();
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
try { const saved = JSON.parse(localStorage.getItem('squeek-beat:v1:settings') ?? '{}'); offset = Number.isFinite(saved.offset) ? Math.min(200, Math.max(-200, saved.offset)) : 0; highContrast = saved.highContrast === true; } catch { /* storage is optional */ }
function persistSettings() { try { localStorage.setItem('squeek-beat:v1:settings', JSON.stringify({ offset, highContrast })); } catch { /* storage is optional */ } }
function dateUTC() { return new Date().toISOString().slice(0, 10); }
function config(): Config { return { mode, difficulty: mode === 'practice' ? difficulty : 'standard', bpm: mode === 'practice' ? 90 : mode === 'daily' ? 108 : wheel?.bpm ?? 80, date: dateUTC(), offset }; }
function number(n: number) { return Math.round(n).toLocaleString('en-US'); }
function escape(text: string) { return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!); }
function shell() {
  document.documentElement.classList.toggle('high-contrast', highContrast);
  app.innerHTML = `<header class="site-header"><button class="brand" data-action="home" aria-label="Squeek Beat home"><span class="brand-mark">${icon('flower')}</span><span>Squeek Beat<span class="brand-sub">Hamster Tour</span></span></button><nav aria-label="Game utilities"><button class="utility" data-action="sound" aria-label="Turn sound on" aria-pressed="false">${icon('muted')}<span class="sound-label">Sound off</span></button><button class="utility icon-button" data-action="help" aria-label="How to play">${icon('help')}</button><button class="utility icon-button" data-action="settings" aria-label="Accessibility and sound settings">${icon('sun')}</button></nav></header><main id="main" tabindex="-1"></main><footer class="site-footer"><span>Made for the joy of the wheel.</span><span>Independent Squeekchain fan project · <a href="#about" data-action="about">About & rules</a></span></footer><dialog id="dialog" aria-labelledby="dialog-title"></dialog><div class="sr-only" id="announcement" role="status" aria-live="polite"></div>`;
  updateSound();
}
function main() { return document.querySelector<HTMLElement>('#main')!; }
function announce(text: string) { const el = document.querySelector('#announcement'); if (el) el.textContent = text; }
function updateSound() {
  const b = document.querySelector<HTMLButtonElement>('[data-action="sound"]');
  if (b) { b.innerHTML = `${icon(audio.enabled ? 'sound' : 'muted')}<span class="sound-label">Sound ${audio.enabled ? 'on' : 'off'}</span>`; b.setAttribute('aria-label', `Turn sound ${audio.enabled ? 'off' : 'on'}`); b.setAttribute('aria-pressed', String(audio.enabled)); }
}
function stopLoops() { cancelAnimationFrame(frame); frame = 0; cancelAnimationFrame(tutorialFrame); tutorialFrame = 0; audio.stop(); heldKeys.clear(); lastFrame = 0; lastPulse = -1; }
function home() {
  stopLoops(); liveIntent++; liveReady = false; fetchController?.abort(); loadingLive = false; screen = 'home'; game = null; save = null; phase = 'paused';
  renderHome();
}
function renderHome() {
  const c = config(); const best = getRecord(c);
  main().className = 'home-main';
  main().innerHTML = `<section class="intro"><div><h1>Tiny paws.<br class="mobile-break"> <span>Big beats.</span></h1><p>A two-lane rhythm adventure for the Squeekchain community.</p></div><span class="run-facts">${icon('clock')} 60 seconds <span class="dot"></span> 3 acts <span class="dot"></span> All heart</span></section>
  <div class="launch-grid"><section class="tour-scene" aria-label="The hamster tour: garden, sunset, stars"><div class="scene-heading"><span>${icon('seed')} A little hamster. A big adventure.</span><span class="scene-no">01 / 03</span></div>${hamsterScene()}<div class="tour-stops"><span class="current">${icon('seed')} Garden</span><span class="route"></span><span>${icon('sun')} Sunset</span><span class="route"></span><span>${icon('bolt')} Stars</span></div></section>
  <section class="launch-panel" aria-labelledby="launch-title"><div class="launch-heading"><h2 id="launch-title">Find your groove</h2><span class="free-play">Free play</span></div><div class="mode-list" role="group" aria-label="Choose a game mode">${(['practice', 'daily', 'live'] as Mode[]).map(m => `<button class="mode-choice ${mode === m ? 'selected' : ''}" data-mode="${m}" aria-pressed="${mode === m}"><span class="mode-icon">${icon(m === 'practice' ? 'seed' : m === 'daily' ? 'sun' : 'bolt')}</span><span><strong>${names[m]}</strong><small>${m === 'practice' ? '90 BPM · Learn the rhythm' : m === 'daily' ? '108 BPM · A new UTC daily chart' : 'A pace set by the real wheel'}</small></span><span class="radio-indicator">${mode === m ? icon('check') : ''}</span></button>`).join('')}</div>
  <div id="mode-info">${modeInfo()}</div>
  <button class="button primary start-button" data-action="start" ${loadingLive ? 'disabled' : ''}>${icon('play')} ${loadingLive ? 'Checking the wheel…' : `Play ${names[mode]}`} ${icon('arrow')}</button>
  <div class="launch-bottom"><button class="text-button" data-action="help">How to play</button><span>${best ? `Local best ${number(best.score)}` : 'Your first lap starts here'}</span></div>
  <p class="input-hint">Press <kbd>A</kbd> / <kbd>L</kbd> or use the touch pads.</p></section></div>
  <section class="how-strip" aria-label="Game highlights"><div>${icon('clock')}<span><strong>One minute, three little worlds</strong><small>Take a breather and pick an upgrade between acts.</small></span></div><div>${icon('flower')}<span><strong>Chase the golden sunflowers</strong><small>Catch special notes. Charge FEVER. Score double.</small></span></div><div>${icon('trophy')}<span><strong>Your rhythm, your personal best</strong><small>Records and achievements stay in this browser.</small></span></div></section>
  <details class="local-records"><summary>Local achievements <span>${getAchievements().length} / 3</span></summary><div class="achievement-list">${achievementMarkup(getAchievements())}</div><p>Records are separate for each mode and difficulty. Daily records are saved by UTC date.</p></details>`;
}
function modeInfo() {
  if (mode === 'practice') return `<div class="difficulty-row"><label for="difficulty">Hit window</label><select id="difficulty"><option value="standard" ${difficulty === 'standard' ? 'selected' : ''}>Standard · ±85 / 170 ms</option><option value="relaxed" ${difficulty === 'relaxed' ? 'selected' : ''}>Relaxed · ±120 / 230 ms</option></select></div><p class="mode-note">${difficulty === 'relaxed' ? 'Wider timing windows. Separate relaxed records.' : 'A steady beat. The perfect place to begin.'}</p>`;
  if (mode === 'daily') return `<p class="mode-note daily-info">${dateUTC()} UTC · Standard timing<br>Same notes and upgrade choices for everyone. <button class="inline-button" data-action="seed">View seed rule</button></p>`;
  if (loadingLive) return `<p class="mode-note live-note" role="status">Checking the wheel… up to 7 seconds.</p>`;
  if (liveError) return `<div class="live-note error" role="status"><p>${escape(liveError)}</p><button class="inline-button" data-action="practice">Switch to Practice</button> · <button class="inline-button" data-action="refresh">Retry live data</button></div>`;
  if (wheel) return `<div class="live-note"><p><strong>${isFresh(wheel) ? 'Last reading' : 'Stale reading'}: ${escape(wheel.state.toLowerCase().replaceAll('_', ' '))} · ${wheel.rpm.toFixed(1)} RPM → ${Math.round(wheel.bpm)} BPM</strong><br><a href="${STATUS_URL}" target="_blank" rel="noopener noreferrer">Squeekchain status</a> · <time datetime="${new Date(wheel.observedAt).toISOString()}">${new Date(wheel.observedAt).toLocaleTimeString()}</time></p><small>${isFresh(wheel) ? 'Rechecked when you start. Let the hamster rest at its own pace.' : 'Too old to start. Refresh or switch to Practice.'}</small></div>`;
  return `<p class="mode-note">Live data is checked when you play. Sleeping or idle? Enjoy a gentle pace. Let the hamster rest.</p>`;
}
async function loadLive(start = false) {
  const intent = ++liveIntent; liveReady = false; fetchController?.abort(); fetchController = new AbortController(); loadingLive = true; liveError = ''; renderHome();
  try {
    const data = await fetchWheel(fetch, 7000, fetchController.signal);
    if (intent !== liveIntent || mode !== 'live' || screen !== 'home') return;
    wheel = data;
    if (!isFresh(data)) throw new Error('This wheel reading is over 60 seconds old. Refresh or play Practice.');
    loadingLive = false; renderHome();
    if (start) { liveReady = true; showTutorial(); }
  } catch (e) { if (intent !== liveIntent) return; loadingLive = false; liveError = e instanceof Error ? e.message : 'Live data is unavailable. Try Practice.'; renderHome(); }
}
function openDialog(content: string) {
  if (phase === 'running' || phase === 'countdown') pause();
  const dialog = document.querySelector<HTMLDialogElement>('#dialog')!;
  dialog.innerHTML = `<div class="dialog-top"><span class="dialog-brand">Squeek Beat</span><button class="utility icon-button" data-action="close" aria-label="Close dialog">${icon('close')}</button></div>${content}`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { liveReady = false; cancelAnimationFrame(tutorialFrame); tutorialFrame = 0; calibrationStart = 0; audio.stop(); document.querySelector<HTMLDialogElement>('#dialog')!.close(); }
function showTutorial() {
  tutorialHits = new Set(); tutorialStart = performance.now(); calibrationStart = 0; calibrationTaps = [];
  openDialog(`<h2 id="dialog-title">A little warm-up</h2><p>Tap when a note reaches the line. Try both lanes.</p><div class="tutorial-track"><canvas id="tutorial-canvas" tabindex="0" aria-label="Practice notes move down two lanes toward the hit line"></canvas><span id="tutorial-feedback" role="status">Try A and L, or tap below</span></div><div class="tutorial-pads"><button class="pad" data-tutorial-lane="0"><kbd>A</kbd><span>Left lane</span></button><button class="pad" data-tutorial-lane="1"><kbd>L</kbd><span>Right lane</span></button></div><div class="tutorial-rules"><span><strong>Perfect</strong> ±85 ms · 100 pts</span><span><strong>Good</strong> ±170 ms · 50 pts</span></div><p class="small-copy">${icon('flower')} Golden notes give 250 base points. Fill FEVER, then hit one more note for 6 seconds of double score.</p><details class="calibration"><summary>Sound & timing calibration</summary><p>Enable sound and tap the calibration button with the beat. Eight taps set a median offset. Positive offset lets you tap later.</p><button class="button secondary" data-action="calibrate">Calibrate sound</button><button class="button secondary" data-action="calibration-tap" hidden>Tap to the beat <span id="calibration-count">0 / 8</span></button><label for="offset">Timing offset: <output id="offset-value">${offset > 0 ? '+' : ''}${offset} ms</output></label><input type="range" id="offset" min="-200" max="200" step="5" value="${offset}"><p id="calibration-status" role="status">Offset is saved only in this browser.</p></details><div class="dialog-actions"><button class="button primary" data-action="begin">${icon('play')} Start the tour</button><button class="text-button" data-action="skip">Skip warm-up & play</button></div>`);
  if (mode === 'practice' && difficulty === 'relaxed') document.querySelector('.tutorial-rules')!.innerHTML = '<span><strong>Perfect</strong> ±120 ms · 100 pts</span><span><strong>Good</strong> ±230 ms · 50 pts</span>';
  document.querySelector<HTMLCanvasElement>('#tutorial-canvas')?.focus({ preventScroll: true });
  tutorialLoop();
}
function tutorialLoop() {
  const canvas = document.querySelector<HTMLCanvasElement>('#tutorial-canvas'); if (!canvas || !document.querySelector<HTMLDialogElement>('#dialog')!.open) return;
  const now = performance.now(); const t = (now - tutorialStart) % 2600;
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h); drawLanes(ctx, w, h, false);
  for (let lane = 0; lane < 2; lane++) { const at = lane === 0 ? 1400 : 2100; const y = h * .78 - (at - t) / 1500 * h * .72; if (y > -12 && y < h + 12) drawNote(ctx, w * (lane ? .73 : .27), y, false, 16); }
  if (calibrationStart) { const beat = Math.floor((now - calibrationStart) / 600); if (beat >= 0 && beat !== calibrationBeat) { calibrationBeat = beat; audio.pulse(beat % 4 === 0); } }
  tutorialFrame = requestAnimationFrame(tutorialLoop);
}
function tutorialHit(lane: Lane) {
  const t = (performance.now() - tutorialStart) % 2600; const at = lane === 0 ? 1400 : 2100;
  const success = Math.abs(t - at - offset) <= (difficulty === 'relaxed' && mode === 'practice' ? 230 : 170);
  if (success) tutorialHits.add(lane);
  document.querySelector('#tutorial-feedback')!.textContent = success ? tutorialHits.size === 2 ? 'Both lanes! You’re ready for the tour.' : 'Nice! Now try the other lane.' : t < at ? 'A little early. Wait for the line.' : 'A little late. Try the next note.';
  if (success) audio.hit(true, false);
}
function beginRun() {
  // A successful start request is single-use; Help must not reuse a previous live run's data.
  if (mode === 'live' && !liveReady) { closeDialog(); home(); void loadLive(true); return; }
  if (mode === 'live' && (!wheel || !isFresh(wheel))) { closeDialog(); home(); liveError = 'This reading is now too old to start. Refresh or play Practice.'; renderHome(); return; }
  closeDialog(); stopLoops(); screen = 'game'; game = new Game(config()); save = null; resultCopy = ''; renderGame(); startCountdown();
}
function renderGame() {
  if (!game) return;
  main().className = 'game-main';
  main().innerHTML = `<div class="game-title-row"><div><span class="game-mode">${names[game.config.mode]} · ${Math.round(game.config.bpm)} BPM${game.config.difficulty === 'relaxed' ? ' · Relaxed' : ''}</span><h1>${acts[game.act]}</h1></div><div class="game-actions"><button class="utility" data-action="pause" aria-label="Pause run">${icon('pause')}<span>Pause</span></button><button class="utility icon-button" data-action="restart" aria-label="Restart run">${icon('restart')}</button><button class="utility icon-button" data-action="quit" aria-label="Quit run">${icon('close')}</button></div></div>
  <div class="game-layout"><section class="arcade" aria-label="Two-lane rhythm game"><div class="scoreboard"><div><span>Score</span><strong id="score">${number(game.score)}</strong></div><div><span>Accuracy</span><strong id="accuracy">${game.accuracy.toFixed(1)}<small>%</small></strong></div><div><span>Combo</span><strong id="combo">${game.combo}<small>×</small></strong></div><div><span>Remaining</span><strong id="remaining">${Math.ceil((RUN_MS - game.time) / 1000)}<small>s</small></strong></div></div>
  <div class="fever-row"><span>${icon('bolt')} <strong id="fever-label">FEVER</strong></span><div class="energy-track" role="progressbar" aria-label="FEVER energy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${game.energy}"><div id="energy-fill"></div></div><span id="fever-value">${Math.floor(game.energy)}%</span></div>
  <div class="playfield"><canvas id="game-canvas" role="img" aria-label="Notes approach the horizontal hit line. Use A for left and L for right."></canvas><div class="hit-feedback" id="hit-feedback" aria-hidden="true"></div><div class="game-overlay" id="game-overlay"></div><span class="hit-line-label">Hit line</span></div><div class="touch-pads"><button class="pad" data-lane="0" aria-label="Left lane, keyboard A"><kbd>A</kbd><span>Left lane</span></button><button class="pad" data-lane="1" aria-label="Right lane, keyboard L"><kbd>L</kbd><span>Right lane</span></button></div><div class="act-progress" aria-label="Tour progress"><div class="act-labels">${acts.map((a, i) => `<span class="${i === game!.act ? 'active' : ''}">${i + 1}. ${a.split(' ')[0]}</span>`).join('')}</div><div class="progress-track"><div id="run-progress" style="width:${game.progress * 100}%"></div></div></div></section>
  <aside class="tour-sidebar"><div class="game-scene">${hamsterScene(game.act, true)}<span id="scene-caption">${game.act === 0 ? 'Every great tour starts with a little step.' : game.act === 1 ? 'Find your sunset rhythm.' : 'One last lap under the stars.'}</span></div><div class="run-details"><div><span>Best combo</span><strong id="best-combo">${game.bestCombo}</strong></div><div><span>${icon('flower')} Gold collected</span><strong id="gold-count">${game.goldCollected}</strong></div></div><div class="upgrade-inventory"><h2>Tour upgrades</h2>${inventoryMarkup()}</div><p class="game-tip">${icon('bolt')} Valid hits charge FEVER. At 100%, the next valid hit starts 6 seconds of double score.</p>${game.config.mode === 'live' && wheel ? `<p class="live-run">${escape(wheel.state.toLowerCase())} · ${wheel.rpm.toFixed(1)} RPM<br>Observed ${new Date(wheel.observedAt).toLocaleTimeString()}<br><a href="${STATUS_URL}" target="_blank" rel="noopener noreferrer">Wheel data source</a><br>Pace is fixed for this run. Let the hamster rest when it wants.</p>` : game.config.mode === 'daily' ? `<p class="live-run">Daily · ${game.config.date} UTC<br>Fixed notes and upgrade opportunities.</p>` : ''}</aside></div><p class="game-footnote">${game.config.difficulty === 'relaxed' ? 'Relaxed' : 'Standard'} timing · ${game.windows.perfect} ms perfect / ${game.windows.good} ms good · Empty taps cost 10 points · Sound optional</p>`;
  paint();
}
function inventoryMarkup() {
  if (!game?.upgrades.length) return '<p>Pick an upgrade after each act.</p>';
  return game.upgrades.map((u, i) => `<div class="inventory-item">${icon(UPGRADE_INFO[u].icon)}<span>${UPGRADE_INFO[u].name}${u === 'shield' && game!.shields === 0 ? ' · Used' : ''}</span><span class="sr-only">Choice ${i + 1}</span></div>`).join('') + (game.shields ? `<p>${game.shields} shield${game.shields === 1 ? '' : 's'} ready</p>` : '');
}
function startCountdown() {
  if (!game) return;
  phase = 'countdown'; main().classList.add('is-paused'); countdownStart = performance.now(); lastCount = -1; lastFrame = countdownStart; void audio.resume(); heldKeys.clear();
  main().focus({ preventScroll: true });
  cancelAnimationFrame(frame); frame = requestAnimationFrame(loop);
}
function loop(now: number) {
  if (!game || screen !== 'game') return;
  const delta = Math.max(0, now - lastFrame); lastFrame = now;
  if (phase === 'countdown') {
    const beat = 60000 / game.config.bpm; const elapsed = now - countdownStart; const count = 3 - Math.floor(elapsed / beat);
    if (count > 0) { if (count !== lastCount) { lastCount = count; audio.tone(count === 1 ? 659 : 440, .1); document.querySelector('#game-overlay')!.innerHTML = `<div class="countdown"><strong>${count}</strong><span>${game.time ? 'Back into the groove' : 'Find the beat'}</span></div>`; } }
    else { phase = 'running'; main().classList.remove('is-paused'); lastPulse = Math.floor((game.time - game.act * ACT_MS) / beat); audio.pulse(true); document.querySelector('#game-overlay')!.innerHTML = ''; announce(`Act ${game.act + 1}. ${acts[game.act]}.`); }
  } else if (phase === 'running') {
    if (delta > 1000) { pause(); return; }
    game.advance(delta);
    const pulse = Math.floor((game.time - game.act * ACT_MS) / (60000 / game.config.bpm));
    if (pulse !== lastPulse) { lastPulse = pulse; audio.pulse(pulse % 4 === 0); }
    updateHUD();
    if (game.status === 'upgrade') { phase = 'upgrade'; audio.stop(); renderUpgrade(); return; }
    if (game.status === 'finished') { finish(); return; }
  }
  paint();
  frame = requestAnimationFrame(loop);
}
function syncTime() { if (phase === 'running' && game) { const now = performance.now(); const delta = now - lastFrame; if (delta >= 0 && delta <= 1000) { game.advance(delta); lastFrame = now; } } }
function hit(lane: Lane) {
  if (!game || phase !== 'running') return;
  syncTime();
  if (game.status !== 'running') return;
  const feedback = game.hit(lane); if (!feedback) return;
  if (feedback.grade === 'perfect' || feedback.grade === 'good') audio.hit(feedback.grade === 'perfect', feedback.gold);
  updateHUD(); paint();
}
function updateHUD() {
  if (!game) return;
  const values: Record<string, string> = { score: number(game.score), accuracy: `${game.accuracy.toFixed(1)}<small>%</small>`, combo: `${game.combo}<small>×</small>`, remaining: `${Math.ceil((RUN_MS - game.time) / 1000)}<small>s</small>`, 'best-combo': String(game.bestCombo), 'gold-count': String(game.goldCollected), 'fever-label': game.fever ? 'FEVER ×2' : game.energy >= 100 ? 'Ready! Next hit' : 'FEVER', 'fever-value': game.fever ? `${((game.feverUntil - game.time) / 1000).toFixed(1)}s` : `${Math.floor(game.energy)}%` };
  for (const [id, value] of Object.entries(values)) { const el = document.getElementById(id); if (el && el.innerHTML !== value) el.innerHTML = value; }
  const fill = document.querySelector<HTMLElement>('#energy-fill'); if (fill) fill.style.width = `${game.fever ? (game.feverUntil - game.time) / 6000 * 100 : game.energy}%`;
  document.querySelector('.energy-track')?.setAttribute('aria-valuenow', String(Math.round(game.energy)));
  document.querySelector<HTMLElement>('#run-progress')!.style.width = `${game.progress * 100}%`;
  document.querySelector('.arcade')?.classList.toggle('fever-active', game.fever);
  document.querySelector('.game-scene')?.classList.toggle('celebrate', game.fever);
  const inv = document.querySelector('.upgrade-inventory'); const inventory = `<h2>Tour upgrades</h2>${inventoryMarkup()}`; if (inv && inv.innerHTML !== inventory) inv.innerHTML = inventory;
  const f = game.feedback;
  const feedback = document.querySelector<HTMLElement>('#hit-feedback');
  if (feedback) { const visible = f && game.time - f.at < 650; feedback.className = `hit-feedback ${visible ? f.grade : ''}`; feedback.innerHTML = visible ? feedbackText(f) : ''; }
}
function feedbackText(f: Feedback) { return `<strong>${f.shielded ? 'Shield saved your combo' : f.grade === 'empty' ? 'Empty tap' : f.grade === 'miss' ? 'Miss' : f.gold ? 'Golden ' + f.grade : f.grade === 'perfect' ? 'Perfect' : 'Good'}</strong>${f.points ? `<span>${f.points > 0 ? '+' : ''}${f.points}</span>` : ''}`; }
function setupCanvas(canvas: HTMLCanvasElement) {
  const box = canvas.getBoundingClientRect(); const ratio = Math.min(devicePixelRatio || 1, 2); const w = box.width, h = box.height;
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) { canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio); }
  const ctx = canvas.getContext('2d')!; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); return { ctx, w, h };
}
function drawLanes(ctx: CanvasRenderingContext2D, w: number, h: number, fever: boolean) {
  ctx.fillStyle = highContrast ? '#0a0d09' : '#141b12'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = highContrast ? '#171d13' : '#1b2318'; ctx.fillRect(w * .1, 0, w * .34, h); ctx.fillRect(w * .56, 0, w * .34, h);
  ctx.strokeStyle = highContrast ? '#f7eed9' : '#3c4931'; ctx.lineWidth = 1;
  for (const x of [.1, .44, .56, .9]) { ctx.beginPath(); ctx.moveTo(w * x, 0); ctx.lineTo(w * x, h); ctx.stroke(); }
  ctx.strokeStyle = fever ? '#f0c96b' : '#c6ed89'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * .08, h * .8); ctx.lineTo(w * .92, h * .8); ctx.stroke();
  for (const x of [.27, .73]) { ctx.fillStyle = '#1e2a19'; ctx.strokeStyle = fever ? '#f0c96b' : '#b1d374'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(w * x - 26, h * .8 - 14, 52, 28, 8); ctx.fill(); ctx.stroke(); }
}
function drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, gold: boolean, size = 18) {
  ctx.save(); ctx.translate(x, y);
  if (gold) {
    ctx.fillStyle = '#efc56a'; for (let i = 0; i < 8; i++) { ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.beginPath(); ctx.ellipse(0, -size * .7, size * .32, size * .52, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#44351f'; ctx.beginPath(); ctx.arc(0, 0, size * .52, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#d7a74a'; ctx.beginPath(); ctx.arc(0, 0, size * .24, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#c6ed89'; ctx.beginPath(); ctx.roundRect(-size * 1.25, -size * .48, size * 2.5, size * .96, 6); ctx.fill(); ctx.fillStyle = '#536b34'; ctx.beginPath(); ctx.roundRect(-size * .65, -2, size * 1.3, 4, 2); ctx.fill();
  }
  ctx.restore();
}
function paint() {
  const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas'); if (!canvas || !game) return;
  const { ctx, w, h } = setupCanvas(canvas); ctx.clearRect(0, 0, w, h); drawLanes(ctx, w, h, game.fever);
  const travel = 1700; const judgedTime = game.time - game.config.offset;
  for (const note of game.notes) {
    if (note.act !== game.act || note.judged) continue;
    const y = h * .8 - (note.at - judgedTime) / travel * h * .76;
    if (y > -30 && y < h + 30) drawNote(ctx, w * (note.lane === 0 ? .27 : .73), y, note.gold, w < 350 ? 17 : 20);
  }
  if (game.feedback && game.time - game.feedback.at < 130) {
    const f = game.feedback; ctx.strokeStyle = f.grade === 'empty' || f.grade === 'miss' ? '#efad96' : '#f7eed9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(w * (f.lane ? .56 : .1) + 3, h * .8 - 23, w * .34 - 6, 46, 10); ctx.stroke();
  }
}
function pause() {
  if (!game || (phase !== 'running' && phase !== 'countdown')) return;
  if (phase === 'running') syncTime(); phase = 'paused'; main().classList.add('is-paused'); cancelAnimationFrame(frame); frame = 0; audio.suspend(); heldKeys.clear();
  document.querySelector('#game-overlay')!.innerHTML = `<div class="pause-panel"><h2>Take a little breather.</h2><p>The rhythm will wait for you.</p><button class="button primary" data-action="resume">${icon('play')} Resume with countdown</button><button class="text-button" data-action="quit">Quit to menu</button></div>`;
  document.querySelector<HTMLButtonElement>('[data-action="resume"]')?.focus(); announce('Game paused. Timers are stopped.');
}
function renderUpgrade() {
  if (!game) return;
  main().classList.add('is-paused', 'is-upgrade');
  document.querySelector('#game-overlay')!.innerHTML = `<div class="upgrade-panel"><span class="intermission-label">Act ${game.act + 1} complete · Timer paused</span><h2>A little boost for the road.</h2><p>Choose one upgrade for the rest of the tour.</p><div class="upgrade-options">${upgradeChoices(game.config, game.act).map(u => `<button class="upgrade-choice" data-upgrade="${u}">${icon(UPGRADE_INFO[u].icon)}<strong>${UPGRADE_INFO[u].name}</strong><span>${UPGRADE_INFO[u].text}</span><small>Choose ${icon('arrow')}</small></button>`).join('')}</div></div>`;
  document.querySelector<HTMLButtonElement>('[data-upgrade]')?.focus(); announce('Act complete. Choose one of two upgrades. Timer paused.');
}
function finish() {
  if (!game) return; stopLoops(); phase = 'results'; screen = 'results'; save = saveRun(game); renderResults(); announce('Tour complete. Your results are ready.');
}
function achievementMarkup(earned: string[]) { return ACHIEVEMENTS.map(a => `<div class="achievement ${earned.includes(a.id) ? 'earned' : ''}">${icon(earned.includes(a.id) ? 'trophy' : 'shield')}<span><strong>${a.name}</strong><small>${a.text}</small></span>${earned.includes(a.id) ? icon('check') : '<span class="locked-label">To earn</span>'}</div>`).join(''); }
function resultText() {
  if (!game) return '';
  return `Squeek Beat: Hamster Tour\n${names[game.config.mode]} · ${game.config.difficulty}${game.config.mode === 'daily' ? ` · ${game.config.date} UTC` : ''}\nScore: ${number(game.score)}\nAccuracy: ${game.accuracy.toFixed(1)}%\nMax combo: ${game.bestCombo}\nGolden sunflowers: ${game.goldCollected}\nRating: ${rating(game.accuracy)}\nLocal browser record. Independent Squeekchain fan project. No monetary rewards.`;
}
function renderResults() {
  if (!game || !save) return; const g = game; const newBest = !save.previous || g.score > save.previous.score;
  main().className = 'results-main';
  main().innerHTML = `<section class="results-header"><span class="result-art">${icon('trophy')}</span><h1>What a little journey.</h1><p>${names[g.config.mode]} · ${g.config.difficulty}${g.config.mode === 'daily' ? ` · ${g.config.date} UTC` : ''} · Three acts complete</p><div class="final-score">${number(g.score)}<span>points</span></div><strong class="rating">${rating(g.accuracy)}</strong><p class="pb-message">${newBest ? save.previous ? `New personal best! +${number(g.score - save.previous.score)} points.` : 'Your first personal best. A lovely start.' : `Personal best: ${number(save.best.score)} · ${number(save.best.score - g.score)} points to chase.`}</p><p class="storage-note">${save.saved ? 'Saved locally in this browser.' : 'Browser storage is unavailable. This result could not be saved.'}</p></section><div class="result-columns"><section class="result-stats" aria-labelledby="breakdown-title"><h2 id="breakdown-title">Your tour, by the numbers</h2><div class="result-top-stats"><div><strong>${g.accuracy.toFixed(1)}%</strong><span>Accuracy</span></div><div><strong>${g.bestCombo}</strong><span>Max combo</span></div><div><strong>${g.goldCollected}</strong><span>Gold collected</span></div></div><dl class="breakdown"><div><dt>Ordinary notes</dt><dd>${number(g.ordinaryPoints)}</dd></div><div><dt>Golden notes + boosts</dt><dd>${number(g.goldPoints)}</dd></div><div><dt>FEVER bonus · ${g.feverCount} activations</dt><dd>+${number(g.feverPoints)}</dd></div><div><dt>Empty-tap penalties</dt><dd>−${number(g.penaltyPoints)}</dd></div><div class="total"><dt>Total score</dt><dd>${number(g.score)}</dd></div></dl><p class="judgements">${g.perfect} Perfect · ${g.good} Good · ${g.misses} Miss · ${g.empty} Empty taps<br>${g.shieldSaves} shield saves · ${g.notes.length} chart notes</p><details class="rating-rules"><summary>How accuracy and ratings work</summary><p>Accuracy = (Perfect + 0.5 × Good) ÷ (all judged notes + empty taps). A shield saves combo only.</p><p>S: ≥95% · A: ≥90% · B: ≥75% · C: ≥50% · D: below 50%. Ratings have no monetary value.</p></details></section><section class="results-achievements"><h2>Little milestones</h2><div class="achievement-list">${achievementMarkup(save.achievements)}</div><h2 class="chosen-title">Along for the ride</h2><div class="result-upgrades">${g.upgrades.map(u => `<span>${icon(UPGRADE_INFO[u].icon)}${UPGRADE_INFO[u].name}</span>`).join('')}</div></section></div><div class="result-actions"><button class="button primary" data-action="replay">${icon('restart')} Play again</button><button class="button secondary" data-action="copy">${icon('copy')} Copy result</button><button class="text-button" data-action="home">Back to menu</button></div><p class="copy-status" id="copy-status" role="status">${escape(resultCopy)}</p><textarea id="copy-fallback" aria-label="Plain-text result to select and copy" readonly hidden></textarea>`;
  main().focus();
}
function settings() { openDialog(`<h2 id="dialog-title">Make yourself comfortable</h2><label class="setting-row"><span><strong>High contrast</strong><small>Stronger lane outlines and text contrast.</small></span><input id="high-contrast" type="checkbox" ${highContrast ? 'checked' : ''}></label><label for="offset">Timing offset: <output id="offset-value">${offset > 0 ? '+' : ''}${offset} ms</output></label><input type="range" id="offset" min="-200" max="200" step="5" value="${offset}"><p>Positive offset lets you tap later. Changes apply to your next run. Use the warm-up for sound calibration.</p><p>Sound is optional. Reduced-motion preferences are respected; notes still move because timing is the game.</p><button class="button primary" data-action="close">Save & close</button>`); }
function about() { openDialog(`<h2 id="dialog-title">Made for the joy of play</h2><p>Squeek Beat: Hamster Tour is an independent Squeekchain community fan project. It is not an official product.</p><p>Free play. No wallet, tokens, transactions, wagers, paid play, or prizes of monetary value. No global leaderboard. Personal bests and three achievements are local to this browser.</p><h3>The rules</h3><p>Standard: Perfect within ±85 ms gives 100 points; Good within ±170 ms gives 50. Golden sunflowers give 250 base points on either successful judgement. Every note can score once.</p><p>Empty taps cost 10 points, with a floor of zero. Misses and empty taps break combo unless a one-use shield protects it. The shield does not turn a miss into a hit or remove a tap penalty.</p><p>Perfect hits charge 12 FEVER energy; Good hits charge 7. Gold adds 18 energy. At 100, the next valid hit starts six seconds of double score, including that hit. FEVER ends exactly at six active seconds. Energy does not charge during FEVER.</p><p>One-minute runs have three 20-second acts. Upgrade choices and pauses stop all game timers. Gold boosts and charge upgrades stack additively. Gold rounding is to the nearest whole point before doubling.</p><p>Live wheel: RPM = rpmMilli / 1000. BPM = clamp(80 + RPM, 75, 140), fixed for the run. Readings older than 60 seconds cannot start a run. Sleeping or idle hamsters deserve rest. <a href="${STATUS_URL}" target="_blank" rel="noopener noreferrer">View the wheel data source</a>.</p><p>Daily charts use version 1, the UTC date, and standard difficulty. Calibration does not change chart generation. No real rewards.</p><button class="button primary" data-action="close">Back to the beat</button>`); }
async function perform(action: string) {
  switch (action) {
    case 'home': home(); break;
    case 'start': if (mode === 'live') await loadLive(true); else showTutorial(); break;
    case 'help': showTutorial(); break;
    case 'begin': case 'skip': beginRun(); break;
    case 'close': closeDialog(); break;
    case 'sound': if (audio.enabled) audio.mute(); else { try { await audio.enable(); audio.tone(659); } catch { announce('Sound could not start. The game works muted.'); } } updateSound(); break;
    case 'settings': settings(); break;
    case 'about': about(); break;
    case 'practice': liveIntent++; fetchController?.abort(); mode = 'practice'; loadingLive = false; liveError = ''; renderHome(); break;
    case 'refresh': await loadLive(); break;
    case 'seed': openDialog(`<h2 id="dialog-title">One day. The same groove.</h2><p>UTC date: ${dateUTC()}</p><p class="seed-rule">Seed: squeek-v1:${dateUTC()}:standard</p><p>The date string is hashed with FNV-1a, then Mulberry32 selects pattern mirrors, phrase order, sunflower phase, and two shuffled upgrades per break. Choices use a separate seed per act, so your earlier pick never changes later opportunities.</p><p>108 BPM. Same notes and choices for every player. The daily date is locked when a run begins. No global leaderboard or rewards.</p><button class="button primary" data-action="close">Back to modes</button>`); break;
    case 'pause': pause(); break;
    case 'resume': if (!document.hidden) startCountdown(); break;
    case 'restart': if (game?.config.mode === 'live') { mode = 'live'; home(); await loadLive(true); } else if (game) { const c = { ...game.config, offset }; stopLoops(); game = new Game(c); renderGame(); startCountdown(); } break;
    case 'quit': closeDialog(); home(); break;
    case 'replay': if (game?.config.mode === 'live') { mode = 'live'; home(); await loadLive(true); } else if (game) { const c = { ...game.config, offset }; stopLoops(); screen = 'game'; save = null; game = new Game(c); renderGame(); startCountdown(); } break;
    case 'copy': {
      const text = resultText();
      try { await navigator.clipboard.writeText(text); resultCopy = 'Result copied. Share a little rhythm.'; }
      catch { const area = document.querySelector<HTMLTextAreaElement>('#copy-fallback')!; area.hidden = false; area.value = text; area.focus(); area.select(); resultCopy = 'Copy is unavailable here. Select and copy the result below.'; }
      document.querySelector('#copy-status')!.textContent = resultCopy; break;
    }
    case 'calibrate': {
      try { await audio.enable(); updateSound(); calibrationStart = performance.now() + 600; calibrationTaps = []; calibrationBeat = -1; const tapButton = document.querySelector<HTMLButtonElement>('[data-action="calibration-tap"]')!; tapButton.hidden = false; delete tapButton.dataset.lastBeat; document.querySelector('#calibration-count')!.textContent = '0 / 8'; document.querySelector<HTMLButtonElement>('[data-action="calibrate"]')!.hidden = true; document.querySelector('#calibration-status')!.textContent = 'Listen to the pulse. Tap on each beat, eight times.'; }
      catch { document.querySelector('#calibration-status')!.textContent = 'Sound is unavailable. Adjust the timing slider manually.'; } break;
    }
    case 'calibration-tap': {
      if (!calibrationStart) break;
      const elapsed = performance.now() - calibrationStart;
      if (elapsed < -200) break;
      const beat = Math.round(elapsed / 600);
      const button = document.querySelector<HTMLButtonElement>('[data-action="calibration-tap"]')!;
      if (button.dataset.lastBeat === String(beat)) break;
      button.dataset.lastBeat = String(beat); calibrationTaps.push(elapsed - beat * 600);
      document.querySelector('#calibration-count')!.textContent = `${calibrationTaps.length} / 8`;
      if (calibrationTaps.length >= 8) { const sorted = [...calibrationTaps].sort((a, b) => a - b); offset = Math.min(200, Math.max(-200, Math.round((sorted[3] + sorted[4]) / 10) * 5)); persistSettings(); calibrationStart = 0; button.hidden = true; const start = document.querySelector<HTMLButtonElement>('[data-action="calibrate"]')!; start.hidden = false; start.textContent = 'Calibrate again'; document.querySelector<HTMLInputElement>('#offset')!.value = String(offset); document.querySelector('#offset-value')!.textContent = `${offset > 0 ? '+' : ''}${offset} ms`; document.querySelector('#calibration-status')!.textContent = 'Eight taps measured. Timing offset saved. You can fine-tune it below.'; }
      break;
    }
  }
}
app.addEventListener('click', e => {
  const el = (e.target as Element).closest<HTMLElement>('button, a'); if (!el) return;
  // Touch compatibility clicks can have detail=0; only keyboard/assistive clicks use this path.
  const keyboardClick = e.detail === 0 && !(e as PointerEvent).pointerType && !(e as MouseEvent & { sourceCapabilities?: { firesTouchEvents: boolean } }).sourceCapabilities?.firesTouchEvents;
  if (el.dataset.lane !== undefined) { if (keyboardClick) hit(Number(el.dataset.lane) as Lane); return; }
  if (el.dataset.tutorialLane !== undefined) { if (keyboardClick) tutorialHit(Number(el.dataset.tutorialLane) as Lane); return; }
  if (el.dataset.mode) { mode = el.dataset.mode as Mode; liveIntent++; fetchController?.abort(); loadingLive = false; liveError = ''; renderHome(); return; }
  if (el.dataset.upgrade && game && phase === 'upgrade') { if (game.choose(el.dataset.upgrade as Upgrade)) { renderGame(); startCountdown(); } return; }
  if (el.dataset.action) { e.preventDefault(); void perform(el.dataset.action); }
});
app.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const el = (e.target as Element).closest<HTMLElement>('[data-lane], [data-tutorial-lane]'); if (!el) return;
  e.preventDefault();
  if (el.dataset.lane !== undefined) hit(Number(el.dataset.lane) as Lane); else tutorialHit(Number(el.dataset.tutorialLane) as Lane);
});
app.addEventListener('change', e => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'difficulty') { difficulty = el.value as Difficulty; renderHome(); }
  if (el.id === 'high-contrast') { highContrast = el.checked; document.documentElement.classList.toggle('high-contrast', highContrast); persistSettings(); paint(); }
});
app.addEventListener('input', e => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'offset') { offset = Number(el.value); document.querySelector('#offset-value')!.textContent = `${offset > 0 ? '+' : ''}${offset} ms`; persistSettings(); }
});
document.addEventListener('keydown', e => {
  const target = e.target as HTMLElement;
  const interactive = target.closest('input, textarea, select, button, a, summary, [contenteditable="true"]');
  if (e.key === 'Escape' && screen === 'game' && !document.querySelector<HTMLDialogElement>('#dialog')!.open) { e.preventDefault(); if (phase === 'running' || phase === 'countdown') pause(); return; }
  const key = e.key.toLowerCase();
  if ((key === 'enter' || key === ' ') && target.closest('[data-lane], [data-tutorial-lane]')) {
    // Keep the first native button activation; suppress held-key clicks just like A/L.
    // Clicks without keyboard events (pointer or assistive activation) stay independent.
    if (e.repeat || heldKeys.has(key)) e.preventDefault();
    else heldKeys.add(key);
    return;
  }
  if ((key !== 'a' && key !== 'l') || e.repeat || heldKeys.has(key) || e.altKey || e.ctrlKey || e.metaKey || interactive) return;
  const dialog = document.querySelector<HTMLDialogElement>('#dialog')!;
  if (dialog.open && document.querySelector('#tutorial-canvas')) { e.preventDefault(); heldKeys.add(key); tutorialHit(key === 'a' ? 0 : 1); }
  else if (!dialog.open && screen === 'game' && phase === 'running') { e.preventDefault(); heldKeys.add(key); hit(key === 'a' ? 0 : 1); }
});
document.addEventListener('keyup', e => heldKeys.delete(e.key.toLowerCase()));
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); heldKeys.clear(); audio.suspend(); } });
window.addEventListener('blur', () => { pause(); heldKeys.clear(); });
window.addEventListener('resize', () => paint());
reduced.addEventListener('change', () => paint());
shell();
document.querySelector<HTMLDialogElement>('#dialog')!.addEventListener('cancel', () => { liveReady = false; cancelAnimationFrame(tutorialFrame); tutorialFrame = 0; calibrationStart = 0; audio.stop(); });
home();
