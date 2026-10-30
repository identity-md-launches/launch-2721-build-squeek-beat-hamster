import type { Config, Game } from './engine';
export interface RecordEntry { score: number; accuracy: number; bestCombo: number; completedAt: string }
export interface SaveResult { previous: RecordEntry | null; best: RecordEntry; achievements: string[]; saved: boolean }
export const ACHIEVEMENTS = [ { id: 'first', name: 'First lap', text: 'Complete a run' }, { id: 'combo', name: 'On a roll', text: 'Reach a 20-note combo' }, { id: 'accuracy', name: 'Golden ears', text: 'Finish with 90% accuracy' } ];
export function recordKey(c: Config) { return `squeek-beat:v1:${c.mode}:${c.difficulty}${c.mode === 'daily' ? `:${c.date}` : ''}`; }
export function getRecord(c: Config, storage: Storage = localStorage): RecordEntry | null {
  try { const v = JSON.parse(storage.getItem(recordKey(c)) ?? 'null'); return v && Number.isFinite(v.score) && v.score >= 0 && Number.isFinite(v.accuracy) && Number.isFinite(v.bestCombo) ? v : null; } catch { return null; }
}
export function getAchievements(storage: Storage = localStorage): string[] {
  try { const a: unknown = JSON.parse(storage.getItem('squeek-beat:v1:achievements') ?? '[]'); return Array.isArray(a) ? a.filter((v): v is string => typeof v === 'string' && ACHIEVEMENTS.some(a => a.id === v)) : []; } catch { return []; }
}
export function saveRun(game: Game, storage: Storage = localStorage): SaveResult {
  const previous = getRecord(game.config, storage);
  const entry = { score: game.score, accuracy: game.accuracy, bestCombo: game.bestCombo, completedAt: new Date().toISOString() };
  const best = previous && previous.score >= entry.score ? previous : entry;
  const achievements = [...new Set([...getAchievements(storage), 'first', ...(game.bestCombo >= 20 ? ['combo'] : []), ...(game.accuracy >= 90 ? ['accuracy'] : [])])];
  try { storage.setItem(recordKey(game.config), JSON.stringify(best)); storage.setItem('squeek-beat:v1:achievements', JSON.stringify(achievements)); return { previous, best, achievements, saved: true }; }
  catch { return { previous, best, achievements, saved: false }; }
}
