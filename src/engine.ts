export type Lane = 0 | 1;
export type Mode = 'practice' | 'daily' | 'live';
export type Difficulty = 'standard' | 'relaxed';
export type Upgrade = 'shield' | 'gold' | 'charge';
export type Grade = 'perfect' | 'good' | 'miss' | 'empty';
export interface Note { id: number; at: number; lane: Lane; gold: boolean; act: number; judged?: Grade }
export interface Config { mode: Mode; difficulty: Difficulty; bpm: number; date: string; offset: number }
export interface Feedback { grade: Grade; points: number; lane: Lane; shielded: boolean; gold: boolean; at: number }
export const ACT_MS = 20_000;
export const RUN_MS = 60_000;
export const UPGRADE_INFO: Record<Upgrade, { name: string; text: string; icon: string }> = {
  shield: { name: 'Pocket shield', text: 'Protect your combo from one miss or empty tap. The miss or tap penalty still counts.', icon: 'shield' },
  gold: { name: 'Sunflower boost', text: '+25% golden-note points for the rest of this run. Stacks to +50%.', icon: 'flower' },
  charge: { name: 'Wheel power', text: '+20% FEVER charge on every valid hit. Stacks to +40%.', icon: 'bolt' },
};
export function hashSeed(text: string): number {
  let seed = 2166136261;
  for (const c of text) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
  return seed >>> 0;
}
export function random(seed: number): () => number {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function seedRule(config: Config): string {
  return `squeek-v1:${config.mode === 'daily' ? config.date : config.mode}:${config.difficulty}`;
}
export function makeChart(config: Config): Note[] {
  const rng = random(hashSeed(seedRule(config)));
  const beat = 60000 / config.bpm;
  const notes: Note[] = [];
  const goldenPhase = Math.floor(rng() * 9);
  const patterns = [[0, 1, 0, 1], [0, 0, 1, 1], [0, 1, 0, 1, 0, 1]];
  for (let act = 0; act < 3; act++) {
    // Phrase starts land on the backing pulse after a safe lead-in.
    let at = Math.ceil(1800 / beat) * beat;
    let phrase = 0;
    const families = act === 0 ? [0, 0, 1, 0] : act === 1 ? [1, 0, 2, 1] : [2, 1, 0, 2];
    const shift = act === 0 ? 0 : Math.floor(rng() * families.length);
    while (at < 18_400) {
      const family = families[(phrase + shift) % families.length];
      const pattern = patterns[family];
      // Above 120 BPM, use two-thirds-beat bursts to retain a musical grid and >=250ms spacing.
      const interval = family === 2 ? (beat >= 500 ? beat / 2 : beat * 2 / 3) : beat;
      const flip = rng() > .5 ? 1 : 0;
      for (const lane of pattern) {
        if (at > 18_800) break;
        notes.push({ id: notes.length, at: Math.round(act * ACT_MS + at), lane: (lane ^ flip) as Lane, gold: (notes.length + goldenPhase) % 9 === 8, act });
        at += interval;
      }
      at += beat;
      phrase++;
    }
  }
  return notes;
}
export function upgradeChoices(config: Config, act: number): Upgrade[] {
  const rng = random(hashSeed(`${seedRule(config)}:choice:${act}`));
  const pool: Upgrade[] = ['shield', 'gold', 'charge'];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 2);
}
export class Game {
  notes: Note[];
  time = 0;
  act = 0;
  status: 'running' | 'upgrade' | 'finished' = 'running';
  score = 0;
  combo = 0;
  bestCombo = 0;
  perfect = 0;
  good = 0;
  misses = 0;
  empty = 0;
  goldCollected = 0;
  energy = 0;
  feverUntil = 0;
  feverCount = 0;
  shields = 0;
  shieldSaves = 0;
  upgrades: Upgrade[] = [];
  ordinaryPoints = 0;
  goldPoints = 0;
  feverPoints = 0;
  penaltyPoints = 0;
  feedback: Feedback | null = null;
  constructor(public config: Config, chart?: Note[]) { this.notes = (chart ?? makeChart(config)).map(n => ({ ...n })); }
  get windows() { return this.config.difficulty === 'relaxed' ? { perfect: 120, good: 230 } : { perfect: 85, good: 170 }; }
  get fever() { return this.feverUntil > this.time; }
  get accuracy() { const count = this.perfect + this.good + this.misses + this.empty; return count ? (this.perfect + .5 * this.good) / count * 100 : 0; }
  get progress() { return this.time / RUN_MS; }
  advance(delta: number) {
    if (this.status !== 'running' || !Number.isFinite(delta) || delta < 0) return;
    this.time = Math.min(this.time + delta, (this.act + 1) * ACT_MS);
    if (this.feverUntil && !this.fever) this.feverUntil = 0;
    const judgedTime = this.time - this.config.offset;
    for (const note of this.notes) {
      if (!note.judged && note.act === this.act && judgedTime > note.at + this.windows.good) {
        note.judged = 'miss'; this.misses++;
        const shielded = this.breakCombo();
        this.feedback = { grade: 'miss', points: 0, lane: note.lane, gold: note.gold, shielded, at: this.time };
      }
    }
    if (this.time >= (this.act + 1) * ACT_MS) this.status = this.act === 2 ? 'finished' : 'upgrade';
  }
  private breakCombo(): boolean {
    if (this.shields > 0) { this.shields--; this.shieldSaves++; return true; }
    this.combo = 0; return false;
  }
  hit(lane: Lane): Feedback | null {
    if (this.status !== 'running') return null;
    const judgedTime = this.time - this.config.offset;
    const candidates = this.notes.filter(n => !n.judged && n.act === this.act && n.lane === lane);
    const note = candidates.reduce<Note | undefined>((nearest, n) => !nearest || Math.abs(n.at - judgedTime) < Math.abs(nearest.at - judgedTime) ? n : nearest, undefined);
    if (!note || Math.abs(note.at - judgedTime) > this.windows.good) {
      this.empty++; const penalty = Math.min(10, this.score); this.score -= penalty; this.penaltyPoints += penalty;
      return this.feedback = { grade: 'empty', points: -penalty, lane, gold: false, shielded: this.breakCombo(), at: this.time };
    }
    const grade = Math.abs(note.at - judgedTime) <= this.windows.perfect ? 'perfect' : 'good';
    note.judged = grade;
    if (grade === 'perfect') this.perfect++; else this.good++;
    this.combo++; this.bestCombo = Math.max(this.combo, this.bestCombo);
    if (this.energy >= 100 && !this.fever) { this.feverUntil = this.time + 6000; this.energy = 0; this.feverCount++; }
    const goldBoost = this.upgrades.filter(u => u === 'gold').length * .25;
    const base = note.gold ? Math.round(250 * (1 + goldBoost)) : grade === 'perfect' ? 100 : 50;
    if (note.gold) { this.goldCollected++; this.goldPoints += base; } else this.ordinaryPoints += base;
    const points = base * (this.fever ? 2 : 1);
    if (this.fever) this.feverPoints += base;
    this.score += points;
    if (!this.fever) {
      const chargeBoost = this.upgrades.filter(u => u === 'charge').length * .2;
      this.energy = Math.min(100, this.energy + ((grade === 'perfect' ? 12 : 7) + (note.gold ? 18 : 0)) * (1 + chargeBoost));
    }
    return this.feedback = { grade, points, lane, gold: note.gold, shielded: false, at: this.time };
  }
  choose(upgrade: Upgrade): boolean {
    if (this.status !== 'upgrade' || !upgradeChoices(this.config, this.act).includes(upgrade)) return false;
    this.upgrades.push(upgrade); if (upgrade === 'shield') this.shields++;
    this.act++; this.status = 'running'; return true;
  }
}
export function rating(accuracy: number): string {
  return accuracy >= 95 ? 'S · Sunflower legend' : accuracy >= 90 ? 'A · Wheel wonder' : accuracy >= 75 ? 'B · Groove keeper' : accuracy >= 50 ? 'C · Finding the beat' : 'D · Keep on squeeking';
}
