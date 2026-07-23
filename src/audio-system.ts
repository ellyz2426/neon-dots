import { createSystem, AudioSource, AudioUtils, Entity, Group } from '@iwsdk/core';

function genWav(freq: number, dur: number, vol: number, decay: number): ArrayBuffer {
  const sr = 44100, ns = Math.floor(sr * dur);
  const buf = new ArrayBuffer(44 + ns * 2);
  const v = new DataView(buf);
  // WAV header
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + ns * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, ns * 2, true);
  for (let i = 0; i < ns; i++) {
    const t = i / sr;
    const env = Math.exp(-t * decay) * vol;
    const s = Math.sin(2 * Math.PI * freq * t) * env;
    v.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, s * 32767)), true);
  }
  return buf;
}

/** Multi-note melody WAV — plays notes sequentially */
function genMelodyWav(notes: { freq: number; dur: number }[], vol: number, decay: number): ArrayBuffer {
  const sr = 44100;
  const totalDur = notes.reduce((s, n) => s + n.dur, 0);
  const ns = Math.floor(sr * totalDur);
  const buf = new ArrayBuffer(44 + ns * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + ns * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, ns * 2, true);

  let offset = 0;
  for (const note of notes) {
    const noteSamples = Math.floor(sr * note.dur);
    for (let i = 0; i < noteSamples; i++) {
      const t = i / sr;
      const env = Math.exp(-t * decay) * vol;
      const sample = Math.sin(2 * Math.PI * note.freq * t) * env;
      const idx = offset + i;
      if (idx < ns) {
        v.setInt16(44 + idx * 2, Math.max(-32768, Math.min(32767, sample * 32767)), true);
      }
    }
    offset += noteSamples;
  }
  return buf;
}

function mkUrl(freq: number, dur: number, vol: number, decay: number): string {
  return URL.createObjectURL(new Blob([genWav(freq, dur, vol, decay)], { type: 'audio/wav' }));
}

function mkMelodyUrl(notes: { freq: number; dur: number }[], vol: number, decay: number): string {
  return URL.createObjectURL(new Blob([genMelodyWav(notes, vol, decay)], { type: 'audio/wav' }));
}

export class AudioSystem extends createSystem({}) {
  private sounds: Record<string, string> = {};
  private entities: Record<string, Entity> = {};
  private muted = false;

  init() {
    // Restore mute state
    try { this.muted = localStorage.getItem('neon-dots-muted') === '1'; } catch {}

    // Victory melody: C5-E5-G5-C6 ascending arpeggio
    const victoryMelody = mkMelodyUrl([
      { freq: 523, dur: 0.15 }, { freq: 659, dur: 0.15 },
      { freq: 784, dur: 0.15 }, { freq: 1047, dur: 0.3 },
    ], 0.6, 5);

    // Defeat melody: G4-Eb4-C4 descending minor
    const defeatMelody = mkMelodyUrl([
      { freq: 392, dur: 0.2 }, { freq: 311, dur: 0.2 },
      { freq: 261, dur: 0.4 },
    ], 0.45, 4);

    this.sounds = {
      place:   mkUrl(800, 0.1, 0.5, 20),
      box:     mkUrl(1200, 0.25, 0.6, 8),
      turn:    mkUrl(400, 0.08, 0.3, 25),
      win:     victoryMelody,
      lose:    defeatMelody,
      click:   mkUrl(600, 0.06, 0.3, 30),
      achv:    mkUrl(1400, 0.3, 0.5, 6),
      undo:    mkUrl(500, 0.12, 0.35, 18),
    };

    for (const [k, src] of Object.entries(this.sounds)) {
      const grp = new Group();
      grp.position.set(0, 1.5, -1);
      this.world.scene.add(grp);
      const ent = this.world.createTransformEntity(grp);
      ent.addComponent(AudioSource, { src, volume: 0.5, positional: false });
      this.entities[k] = ent;
    }
  }

  sfx(name: string) {
    if (this.muted) return;
    const ent = this.entities[name];
    if (ent) {
      try { AudioUtils.play(ent); } catch {}
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try { localStorage.setItem('neon-dots-muted', this.muted ? '1' : '0'); } catch {}
    return this.muted;
  }

  isMuted(): boolean { return this.muted; }

  update() {}
}
