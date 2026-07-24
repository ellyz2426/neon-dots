import {
  createSystem,
  Group,
  Mesh,
  SphereGeometry,
  BoxGeometry,
  MeshStandardMaterial,
  Color,
  Vector3,
} from '@iwsdk/core';
import { COLORS } from './game-system.js';

interface Particle {
  mesh: Mesh;
  vel: Vector3;
  life: number;
  maxLife: number;
  startScale: number;
}

interface PulseObj {
  mesh: Mesh;
  time: number;
  speed: number;
  minEm: number;
  maxEm: number;
}

export class EffectsSystem extends createSystem({}) {
  private particles: Particle[] = [];
  private pulses: PulseObj[] = [];
  private group!: Group;
  private ambientParticles: { mesh: Mesh; baseY: number; phase: number; speed: number }[] = [];
  private aiPulseActive = false;
  private aiPulseT = 0;
  private aiPulseMeshes: Mesh[] = [];

  init() {
    this.group = new Group();
    this.world.scene.add(this.group);
    this.spawnAmbient();
  }

  /** Ambient floating particles for atmosphere */
  private spawnAmbient() {
    const geo = new SphereGeometry(0.012, 6, 6);
    const colors = ['#00ffff', '#8844ff', '#ff4488', '#44ff88'];
    for (let i = 0; i < 20; i++) {
      const c = colors[i % colors.length];
      const mat = new MeshStandardMaterial({
        color: new Color(c),
        emissive: new Color(c),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.4,
      });
      const m = new Mesh(geo, mat);
      const x = (Math.random() - 0.5) * 12;
      const y = 0.5 + Math.random() * 4;
      const z = (Math.random() - 0.5) * 12;
      m.position.set(x, y, z);
      this.world.scene.add(m);
      this.ambientParticles.push({
        mesh: m,
        baseY: y,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
      });
    }
  }

  /** Burst of particles at a world position — used on box completion */
  burst(worldPos: Vector3, colorIdx: number, count: number = 12) {
    const cs = COLORS[colorIdx];
    const geo = new SphereGeometry(0.015, 6, 6);
    for (let i = 0; i < count; i++) {
      const mat = new MeshStandardMaterial({
        color: new Color(i % 2 === 0 ? cs.p : cs.a),
        emissive: new Color(i % 2 === 0 ? cs.p : cs.a),
        emissiveIntensity: 1.2,
        transparent: true,
        opacity: 1.0,
      });
      const m = new Mesh(geo, mat);
      m.position.copy(worldPos);
      const s = 0.6 + Math.random() * 0.6;
      m.scale.set(s, s, s);
      this.group.add(m);

      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 0.8 + Math.random() * 1.2;
      const vx = Math.cos(angle) * speed * 0.3;
      const vy = 0.4 + Math.random() * 0.8;
      const vz = Math.sin(angle) * speed * 0.3;

      this.particles.push({
        mesh: m,
        vel: new Vector3(vx, vy, vz),
        life: 0.6 + Math.random() * 0.4,
        maxLife: 0.6 + Math.random() * 0.4,
        startScale: s,
      });
    }
  }

  /** Line glow burst — smaller, directional */
  lineBurst(worldPos: Vector3, colorIdx: number) {
    const cs = COLORS[colorIdx];
    const geo = new BoxGeometry(0.02, 0.02, 0.02);
    for (let i = 0; i < 6; i++) {
      const mat = new MeshStandardMaterial({
        color: new Color(cs.p),
        emissive: new Color(cs.p),
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.9,
      });
      const m = new Mesh(geo, mat);
      m.position.copy(worldPos);
      this.group.add(m);

      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 0.5;
      this.particles.push({
        mesh: m,
        vel: new Vector3(
          Math.cos(angle) * speed * 0.2,
          0.2 + Math.random() * 0.4,
          Math.sin(angle) * speed * 0.2,
        ),
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.3 + Math.random() * 0.2,
        startScale: 1,
      });
    }
  }

  /** Victory celebration — big particle shower from above */
  celebrate(colorIdx: number) {
    const cs = COLORS[colorIdx];
    const geo = new SphereGeometry(0.02, 8, 8);
    const colors = [cs.p, cs.a, '#ffffff', '#ffcc00'];
    for (let i = 0; i < 50; i++) {
      const c = colors[i % colors.length];
      const mat = new MeshStandardMaterial({
        color: new Color(c),
        emissive: new Color(c),
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 1.0,
      });
      const m = new Mesh(geo, mat);
      const x = (Math.random() - 0.5) * 3;
      const y = 3 + Math.random() * 2;
      const z = -2 + (Math.random() - 0.5) * 2;
      m.position.set(x, y, z);
      const s = 0.5 + Math.random() * 1.0;
      m.scale.set(s, s, s);
      this.group.add(m);
      this.particles.push({
        mesh: m,
        vel: new Vector3(
          (Math.random() - 0.5) * 1.5,
          -1 - Math.random() * 2,
          (Math.random() - 0.5) * 0.5,
        ),
        life: 2.0 + Math.random() * 1.5,
        maxLife: 2.0 + Math.random() * 1.5,
        startScale: s,
      });
    }
  }

  /** Defeat effect — subtle red/grey dust */
  defeatDust(colorIdx: number) {
    const geo = new BoxGeometry(0.015, 0.015, 0.015);
    for (let i = 0; i < 20; i++) {
      const c = i % 2 === 0 ? '#ff4444' : '#666666';
      const mat = new MeshStandardMaterial({
        color: new Color(c),
        emissive: new Color(c),
        emissiveIntensity: 0.6,
        transparent: true,
        opacity: 0.7,
      });
      const m = new Mesh(geo, mat);
      m.position.set(
        (Math.random() - 0.5) * 2,
        1.0 + Math.random() * 0.5,
        -2 + (Math.random() - 0.5) * 1.5,
      );
      this.group.add(m);
      this.particles.push({
        mesh: m,
        vel: new Vector3(
          (Math.random() - 0.5) * 0.5,
          -0.3 - Math.random() * 0.3,
          (Math.random() - 0.5) * 0.3,
        ),
        life: 1.5 + Math.random() * 0.5,
        maxLife: 1.5 + Math.random() * 0.5,
        startScale: 1,
      });
    }
  }

  /** Register a mesh for continuous pulsing glow */
  addPulse(mesh: Mesh, speed: number = 2, minEm: number = 0.3, maxEm: number = 1.0) {
    this.pulses.push({ mesh, time: Math.random() * Math.PI * 2, speed, minEm, maxEm });
  }

  /** Set AI thinking pulse state — pulses ambient orbs faster */
  setAiPulse(active: boolean) {
    this.aiPulseActive = active;
    if (active) this.aiPulseT = 0;
  }

  update(delta: number, time: number) {
    // Animate particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as MeshStandardMaterial).dispose();
        this.particles.splice(i, 1);
        continue;
      }
      const t = p.life / p.maxLife;
      p.vel.y -= delta * 2.0; // gravity
      p.mesh.position.x += p.vel.x * delta;
      p.mesh.position.y += p.vel.y * delta;
      p.mesh.position.z += p.vel.z * delta;
      const s = p.startScale * t;
      p.mesh.scale.set(s, s, s);
      (p.mesh.material as MeshStandardMaterial).opacity = t * 0.8;
    }

    // Animate pulses
    for (const p of this.pulses) {
      p.time += delta * p.speed;
      const t = (Math.sin(p.time) + 1) * 0.5;
      const em = p.minEm + t * (p.maxEm - p.minEm);
      (p.mesh.material as MeshStandardMaterial).emissiveIntensity = em;
    }

    // Animate ambient particles (float and bob — faster pulse during AI thinking)
    for (const ap of this.ambientParticles) {
      const spd = this.aiPulseActive ? ap.speed * 3 : ap.speed;
      ap.phase += delta * spd;
      ap.mesh.position.y = ap.baseY + Math.sin(ap.phase) * 0.3;
      const baseO = this.aiPulseActive ? 0.35 : 0.2;
      const ampO = this.aiPulseActive ? 0.25 : 0.15;
      const o = baseO + Math.sin(ap.phase * 0.7) * ampO;
      (ap.mesh.material as MeshStandardMaterial).opacity = Math.max(0.1, Math.min(0.6, o));
      if (this.aiPulseActive) {
        (ap.mesh.material as MeshStandardMaterial).emissiveIntensity = 1.2 + Math.sin(ap.phase * 2) * 0.6;
      } else {
        (ap.mesh.material as MeshStandardMaterial).emissiveIntensity = 0.8;
      }
    }
  }
}
