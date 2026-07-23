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

function mkUrl(freq: number, dur: number, vol: number, decay: number): string {
  return URL.createObjectURL(new Blob([genWav(freq, dur, vol, decay)], { type: 'audio/wav' }));
}

export class AudioSystem extends createSystem({}) {
  private sounds: Record<string, string> = {};
  private entities: Record<string, Entity> = {};

  init() {
    this.sounds = {
      place:   mkUrl(800, 0.1, 0.5, 20),
      box:     mkUrl(1200, 0.25, 0.6, 8),
      turn:    mkUrl(400, 0.08, 0.3, 25),
      win:     mkUrl(880, 0.5, 0.7, 4),
      lose:    mkUrl(300, 0.4, 0.5, 6),
      click:   mkUrl(600, 0.06, 0.3, 30),
      achv:    mkUrl(1400, 0.3, 0.5, 6),
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
    const ent = this.entities[name];
    if (ent) {
      try { AudioUtils.play(ent); } catch {}
    }
  }

  update() {}
}
