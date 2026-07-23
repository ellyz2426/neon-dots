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

  /** Register a mesh for continuous pulsing glow */
  addPulse(mesh: Mesh, speed: number = 2, minEm: number = 0.3, maxEm: number = 1.0) {
    this.pulses.push({ mesh, time: Math.random() * Math.PI * 2, speed, minEm, maxEm });
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

    // Animate ambient particles (float and bob)
    for (const ap of this.ambientParticles) {
      ap.phase += delta * ap.speed;
      ap.mesh.position.y = ap.baseY + Math.sin(ap.phase) * 0.3;
      const o = 0.2 + Math.sin(ap.phase * 0.7) * 0.15;
      (ap.mesh.material as MeshStandardMaterial).opacity = Math.max(0.1, Math.min(0.5, o));
    }
  }
}
