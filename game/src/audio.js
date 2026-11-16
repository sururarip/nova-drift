// All sound is synthesised with WebAudio — no audio files, no network.
// The engine is silent until the player first interacts (browsers demand a
// gesture before AudioContext may start), and it never throws when audio is
// unavailable (headless runs, muted tabs).

const MUSIC_STEPS = 16;
// A minor-key bass line (Hz) the sequencer walks, one step per beat.
const BASS_LINE = [55, 0, 55, 65.41, 55, 0, 49, 58.27, 55, 0, 55, 65.41, 82.41, 0, 73.42, 65.41];

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = true;
    this.musicStep = 0;
    this.musicTimer = 0;
    this.musicBpm = 112;
  }

  /** Create the context on first user gesture; safe to call any time. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = typeof AudioContext !== 'undefined' ? AudioContext : null;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** One short oscillator blip. */
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  /** A burst of filtered noise (explosions, hits). */
  noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // Audio is decoration; never let it break the game.
    }
  }

  shoot() { this.blip(880, 0.07, 'square', 0.08, 320); }
  enemyShoot() { this.blip(220, 0.12, 'sawtooth', 0.05, 110); }
  hit() { this.noise(0.08, 0.12, 2400); }
  explode() { this.noise(0.35, 0.3, 900); this.blip(140, 0.3, 'sine', 0.22, 36); }
  bigExplode() { this.noise(0.7, 0.42, 620); this.blip(90, 0.6, 'sine', 0.3, 28); }
  pickup() { this.blip(1320, 0.09, 'sine', 0.12, 1760); }
  heart() { this.blip(520, 0.16, 'sine', 0.14, 780); this.blip(780, 0.2, 'sine', 0.1, 1040); }
  hurt() { this.blip(160, 0.25, 'sawtooth', 0.22, 60); this.noise(0.15, 0.18, 700); }
  dash() { this.noise(0.14, 0.12, 3200); }
  nova() { this.blip(180, 0.7, 'sawtooth', 0.2, 1400); this.noise(0.5, 0.25, 1800); }
  waveClear() { this.blip(523, 0.12, 'sine', 0.14); this.blip(659, 0.12, 'sine', 0.14); this.blip(784, 0.22, 'sine', 0.16); }
  bossWarn() { this.blip(98, 0.4, 'sawtooth', 0.2, 49); this.blip(147, 0.4, 'sawtooth', 0.16, 73); }
  upgrade() { this.blip(660, 0.1, 'triangle', 0.14, 990); this.blip(990, 0.18, 'triangle', 0.12, 1320); }
  gameOver() { this.blip(392, 0.3, 'sawtooth', 0.16, 196); this.blip(311, 0.4, 'sawtooth', 0.16, 155); this.blip(233, 0.7, 'sawtooth', 0.16, 58); }
  victory() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((n, i) => {
      if (!this.ctx || this.muted) return;
      try {
        const t = this.ctx.currentTime + i * 0.13;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = n;
        gain.gain.setValueAtTime(0.14, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t);
        osc.stop(t + 0.32);
      } catch {
        // Audio is decoration.
      }
    });
  }

  /** Advance the music sequencer; call every frame with dt. */
  update(dt) {
    if (!this.ctx || this.muted || !this.musicOn) return;
    this.musicTimer += dt;
    const stepDur = 60 / this.musicBpm / 2;
    while (this.musicTimer >= stepDur) {
      this.musicTimer -= stepDur;
      const note = BASS_LINE[this.musicStep % MUSIC_STEPS];
      if (note > 0) this.blip(note, stepDur * 0.9, 'triangle', 0.07);
      if (this.musicStep % 4 === 0) this.blip(note > 0 ? note * 4 : 440, 0.05, 'sine', 0.03);
      this.musicStep += 1;
    }
  }
}
