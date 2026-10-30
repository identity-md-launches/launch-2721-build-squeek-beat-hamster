import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, makeChart, upgradeChoices, hashSeed, seedRule, rating } from '../test/scratch/compiled/engine.js';
import { parseWheel, isFresh, fetchWheel } from '../test/scratch/compiled/live.js';
import { getRecord, getAchievements, saveRun, recordKey } from '../test/scratch/compiled/records.js';
const config = (overrides = {}) => ({ mode: 'practice', difficulty: 'standard', bpm: 90, date: '2026-10-30', offset: 0, ...overrides });
const note = (at = 2000, lane = 0, gold = false, id = 0, act = 0) => ({ id, at, lane, gold, act });
const fixture = (notes = [note()], overrides = {}) => new Game(config(overrides), notes);
const at = (g, t) => g.advance(t - g.time);

test('daily chart and choices reproduce exactly, independent of calibration and selected upgrades', () => {
  const c = config({ mode: 'daily', bpm: 108 });
  assert.deepEqual(makeChart(c), makeChart(c));
  assert.deepEqual(makeChart(c), makeChart({ ...c, offset: 160 }));
  assert.notDeepEqual(makeChart(c), makeChart({ ...c, date: '2026-10-31' }));
  assert.deepEqual(upgradeChoices(c, 0), upgradeChoices(c, 0));
  assert.equal(new Set(upgradeChoices(c, 0)).size, 2);
  assert.equal(seedRule(c), 'squeek-v1:2026-10-30:standard');
  assert.equal(hashSeed('same'), hashSeed('same'));
});
test('handcrafted charts obey all gaps, no chords, gold ratio, lead-ins and clear-outs at every supported pace', () => {
  for (const bpm of [75, 80, 90, 108, 140]) for (const mode of ['daily', 'practice', 'live']) {
    const notes = makeChart(config({ bpm, mode }));
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]; const local = n.at - n.act * 20000;
      assert.ok(local >= 1800 && local <= 18800);
      if (i) assert.ok(n.at - notes[i - 1].at >= 250, `gap at ${bpm}`);
    }
    const golden = notes.filter(n => n.gold).length;
    assert.ok(Math.abs(golden - notes.length / 9) <= 1);
    assert.deepEqual([...new Set(notes.map(n => n.act))], [0, 1, 2]);
  }
});
test('authored phrases align to the act backing pulse, including fast-pace triplet bursts', () => {
  for (const bpm of [75, 90, 108, 120, 125, 140]) {
    const beat = 60000 / bpm;
    const chart = makeChart(config({ mode: 'live', bpm }));
    for (const n of chart) {
      const local = n.at - n.act * 20000;
      const sixths = local / beat * 6;
      assert.ok(Math.abs(sixths - Math.round(sixths)) <= .008, `note ${n.id} at ${bpm} is off the musical grid`);
    }
    for (let act = 0; act < 3; act++) {
      const first = chart.find(n => n.act === act);
      const startBeats = (first.at - act * 20000) / beat;
      assert.ok(Math.abs(startBeats - Math.round(startBeats)) < .002);
    }
  }
});
for (const [delta, grade, points] of [[-170, 'good', 50], [-85, 'perfect', 100], [0, 'perfect', 100], [85, 'perfect', 100], [85.001, 'good', 50], [170, 'good', 50]]) {
  test(`inclusive scoring boundary ${delta}ms → ${grade}`, () => { const g = fixture(); at(g, 2000 + delta); assert.equal(g.hit(0).grade, grade); assert.equal(g.score, points); });
}
test('outside timing window gives no successful hit and later consumes overdue note once', () => {
  const g = fixture(); at(g, 1829.9); assert.equal(g.hit(0).grade, 'empty'); at(g, 2170.1); assert.equal(g.misses, 1); g.advance(100); assert.equal(g.misses, 1); assert.equal(g.score, 0);
});
test('each note can be judged once; repeated taps incur a real penalty', () => {
  const g = fixture(); at(g, 2000); g.hit(0); g.hit(0); assert.equal(g.perfect, 1); assert.equal(g.empty, 1); assert.equal(g.score, 90); assert.equal(g.combo, 0);
});
test('nearest unconsumed note is judged, not the first chart entry', () => {
  const g = fixture([note(2000), note(2250, 0, false, 1)]); at(g, 2140); g.hit(0); assert.equal(g.notes[0].judged, undefined); assert.equal(g.notes[1].judged, 'good');
});
test('wrong-lane tap cannot consume a note; empty taps floor at zero', () => {
  const g = fixture(); at(g, 2000); g.hit(1); assert.equal(g.notes[0].judged, undefined); assert.equal(g.score, 0); g.hit(0); assert.equal(g.score, 100); assert.equal(g.accuracy, 50);
});
test('normal misses break combo and reduce accuracy', () => {
  const g = fixture([note(), note(3000, 1, false, 1)]); at(g, 2000); g.hit(0); at(g, 3171); assert.equal(g.combo, 0); assert.equal(g.bestCombo, 1); assert.equal(g.misses, 1); assert.equal(g.accuracy, 50);
});
test('shield protects one miss, does not add a successful hit, then expires', () => {
  const g = fixture([note(), note(3000, 1, false, 1), note(4000, 0, false, 2)]); g.shields = 1; at(g, 2000); g.hit(0); at(g, 3171); assert.equal(g.combo, 1); assert.equal(g.shields, 0); assert.equal(g.perfect, 1); assert.equal(g.accuracy, 50); assert.equal(g.shieldSaves, 1); at(g, 4171); assert.equal(g.combo, 0);
});
test('shield protects empty-tap combo but retains score and accuracy penalties', () => {
  const g = fixture(); g.shields = 1; at(g, 2000); g.hit(0); g.hit(1); assert.equal(g.combo, 1); assert.equal(g.score, 90); assert.equal(g.accuracy, 50); assert.equal(g.shields, 0);
});
test('gold has 250 base points for either successful grade, extra energy, normal miss', () => {
  for (const delta of [0, 150]) { const g = fixture([note(2000, 0, true)]); at(g, 2000 + delta); g.hit(0); assert.equal(g.score, 250); assert.equal(g.goldCollected, 1); assert.equal(g.energy, delta ? 25 : 30); }
  const g = fixture([note(2000, 0, true)]); at(g, 2171); assert.equal(g.misses, 1); assert.equal(g.score, 0); assert.equal(g.goldCollected, 0);
});
test('full energy arms FEVER; the next successful hit starts exactly 6s including its double score', () => {
  const g = fixture([note(), note(3000, 0, false, 1)]); g.energy = 88; at(g, 2000); g.hit(0); assert.equal(g.energy, 100); assert.equal(g.fever, false); at(g, 3000); g.hit(0); assert.equal(g.score, 300); assert.equal(g.feverUntil, 9000); assert.equal(g.feverCount, 1); assert.equal(g.energy, 0); assert.equal(g.feverPoints, 100);
});
test('FEVER boundary is exclusive at the end; charge restarts after expiry', () => {
  for (const [time, expected] of [[7999.999, 200], [8000, 100], [8000.001, 100]]) {
    const g = fixture([note(time)]); g.feverUntil = 8000; at(g, time); g.hit(0); assert.equal(g.score, expected); assert.equal(g.energy, expected === 200 ? 0 : 12);
  }
});
test('empty taps neither activate armed FEVER nor charge it', () => {
  const g = fixture(); g.energy = 100; at(g, 1000); g.hit(1); assert.equal(g.fever, false); assert.equal(g.energy, 100);
});
test('FEVER golden note boost rounds before doubling; charge and gold stack additively', () => {
  const g = fixture([note(2000, 0, true)]); g.upgrades = ['gold']; g.energy = 100; at(g, 2000); g.hit(0); assert.equal(g.score, 626); assert.equal(g.goldPoints, 313); assert.equal(g.feverPoints, 313);
  const h = fixture([note(2000, 0, true)]); h.upgrades = ['gold', 'gold', 'charge', 'charge']; at(h, 2000); h.hit(0); assert.equal(h.score, 375); assert.equal(h.energy, 42);
});
test('20s/40s transitions and 60s end freeze notes, FEVER, time, score and accept only offered upgrades', () => {
  const g = new Game(config()); at(g, 19900); g.feverUntil = 25000; g.advance(5000); assert.equal(g.time, 20000); assert.equal(g.status, 'upgrade'); const snapshot = [g.time, g.feverUntil, g.score, g.misses]; g.advance(10000); g.hit(0); assert.deepEqual([g.time, g.feverUntil, g.score, g.misses], snapshot);
  const offered = upgradeChoices(g.config, 0); const absent = ['shield','gold','charge'].find(u => !offered.includes(u)); assert.equal(g.choose(absent), false); assert.equal(g.choose(offered[0]), true); assert.equal(g.choose(offered[1]), false); assert.equal(g.act, 1); assert.equal(g.feverUntil - g.time, 5000);
  g.advance(99999); assert.equal(g.time, 40000); g.choose(upgradeChoices(g.config, 1)[0]); g.advance(99999); assert.equal(g.status, 'finished'); assert.equal(g.time, 60000); assert.equal(g.notes.filter(n => n.judged).length, g.notes.length); g.advance(50000); assert.equal(g.time, 60000);
});
test('positive and negative calibration shifts affect judgement while preserving chart', () => {
  for (const offset of [-200, 200]) { const g = fixture(undefined, { offset }); at(g, 2000 + offset); assert.equal(g.hit(0).grade, 'perfect'); }
});
test('relaxed practice has explicit wider windows', () => {
  const g = fixture(undefined, { difficulty: 'relaxed' }); at(g, 2120); assert.equal(g.hit(0).grade, 'perfect'); const h = fixture(undefined, { difficulty: 'relaxed' }); at(h, 2230); assert.equal(h.hit(0).grade, 'good');
});
test('fresh game resets all run state and regenerates identical chart', () => {
  const g = new Game(config()); g.score = 999; g.combo = 8; g.shields = 1; g.upgrades.push('gold'); const h = new Game(g.config); assert.equal(h.score, 0); assert.equal(h.time, 0); assert.equal(h.shields, 0); assert.deepEqual(h.upgrades, []); assert.deepEqual(h.notes, makeChart(g.config));
});
test('a complete autoplay run accounts for all notes, scoring and shield-free accuracy', () => {
  const g = new Game(config()); for (let act = 0; act < 3; act++) { for (const n of g.notes.filter(n => n.act === act)) { at(g, n.at); g.hit(n.lane); } at(g, (act + 1) * 20000); if (act < 2) g.choose(upgradeChoices(g.config, act)[0]); }
  assert.equal(g.status, 'finished'); assert.equal(g.accuracy, 100); assert.equal(g.perfect, g.notes.length); assert.equal(g.bestCombo, g.notes.length); assert.equal(g.score, g.ordinaryPoints + g.goldPoints + g.feverPoints - g.penaltyPoints); assert.ok(g.feverCount > 0);
});
test('rating boundaries are transparent and inclusive', () => {
  assert.match(rating(95), /^S/); assert.match(rating(90), /^A/); assert.match(rating(75), /^B/); assert.match(rating(50), /^C/); assert.match(rating(49.99), /^D/);
});
const now = Date.parse('2026-10-30T10:00:00Z');
const body = (m = {}) => ({ measurement: { rpmMilli: 15000, coreStatus: 'RUNNING', observedAt: new Date(now - 1000).toISOString(), ...m } });
test('live telemetry validates actual field types, maps RPM, clamps BPM and uses observation freshness', () => {
  const d = parseWheel(body(), now); assert.equal(d.rpm, 15); assert.equal(d.bpm, 95); assert.equal(isFresh(d, now), true);
  assert.equal(parseWheel(body({ rpmMilli: 999000 }), now).bpm, 140);
  assert.equal(parseWheel(body({ rpmMilli: 0, coreStatus: 'IDLE' }), now).bpm, 80);
  assert.equal(isFresh(parseWheel(body({ observedAt: new Date(now - 60000).toISOString() }), now), now), true);
  assert.equal(isFresh(parseWheel(body({ observedAt: new Date(now - 60001).toISOString() }), now), now), false);
});
test('live schema rejects missing fields, non-finite, negative, fractional, strings, bad state and bad timestamps', () => {
  for (const value of [null, {}, { measurement: null }, body({ rpmMilli: '15000' }), body({ rpmMilli: -1 }), body({ rpmMilli: Infinity }), body({ rpmMilli: .1 }), body({ coreStatus: 3 }), body({ coreStatus: '<script>' }), body({ observedAt: 'not a date' }), body({ observedAt: new Date(now + 10000).toISOString() })]) assert.throws(() => parseWheel(value, now));
});
test('live network timeout aborts pending fetch, bad HTTP/schema fail, and valid stale reading stays marked stale', async () => {
  let aborted = false;
  const slow = async (_, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }));
  await assert.rejects(fetchWheel(slow, 15), /7 seconds/); assert.equal(aborted, true);
  await assert.rejects(fetchWheel(async () => ({ ok: false })), /unavailable/);
  await assert.rejects(fetchWheel(async () => ({ ok: true, json: async () => ({ measurement: {} }) })), /invalid/);
  const result = await fetchWheel(async () => ({ ok: true, json: async () => body() })); assert.equal(result.bpm, 95);
});
function memoryStorage() { const values = new Map(); return { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) }; }
test('local records split modes, difficulty and UTC days; comparisons and achievements persist', () => {
  const storage = memoryStorage(), g = fixture(); at(g, 2000); g.hit(0); g.bestCombo = 20; const saved = saveRun(g, storage); assert.equal(saved.previous, null); assert.deepEqual(getAchievements(storage), ['first', 'combo', 'accuracy']); assert.equal(getRecord(g.config, storage).score, 100);
  for (const c of [config({ mode: 'daily' }), config({ difficulty: 'relaxed' }), config({ mode: 'live' })]) assert.equal(getRecord(c, storage), null);
  assert.notEqual(recordKey(config({ mode: 'daily' })), recordKey(config({ mode: 'daily', date: '2026-10-31' })));
  g.score = 50; assert.equal(saveRun(g, storage).best.score, 100); assert.equal(saveRun(g, storage).previous.score, 100);
});
test('blocked and malformed storage fail safely with truthful save result', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(getRecord(config(), storage), null); assert.deepEqual(getAchievements(storage), []); assert.equal(saveRun(fixture(), storage).saved, false);
  assert.equal(getRecord(config(), { getItem: () => '{bad' }), null);
});
