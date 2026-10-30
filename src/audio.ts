export class GameAudio {
  context: AudioContext | null = null;
  enabled = false;
  private voices = new Set<OscillatorNode>();
  async enable() {
    if (!this.context || this.context.state === 'closed') this.context = new AudioContext();
    await this.context.resume(); this.enabled = true;
  }
  tone(frequency: number, duration = .08, volume = .08, type: OscillatorType = 'sine') {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    const voice = ctx.createOscillator(), gain = ctx.createGain();
    voice.type = type; voice.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + .006); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    voice.connect(gain); gain.connect(ctx.destination); voice.start(); voice.stop(ctx.currentTime + duration + .01); this.voices.add(voice);
    voice.onended = () => { this.voices.delete(voice); voice.disconnect(); gain.disconnect(); };
  }
  pulse(strong: boolean) { this.tone(strong ? 164.81 : 220, .12, .065, 'triangle'); if (strong) this.tone(82.41, .16, .07); }
  hit(perfect: boolean, gold: boolean) { this.tone(gold ? 987.77 : perfect ? 659.25 : 493.88, .1, .06); }
  stop() { for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } voice.disconnect(); } this.voices.clear(); }
  mute() { this.enabled = false; this.stop(); }
  suspend() { this.stop(); void this.context?.suspend(); }
  async resume() { if (this.enabled) await this.context?.resume(); }
}
