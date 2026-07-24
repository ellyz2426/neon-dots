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

interface ScoreFlash {
  ring: Mesh;
  pip: Mesh;
  life: number;
  startY: number;
}

interface BoardShake {
  intensity: number;
  duration: number;
  elapsed: number;
  origX: number;
  origY: number;
}

export class EffectsSystem extends createSystem({}) {
  private particles: Particle[] = [];
  private pulses: PulseObj[] = [];
  private group!: Group;
  private ambientParticles: { mesh: Mesh; baseY: number; phase: number; speed: number }[] = [];
  private aiPulseActive = false;
  private aiPulseT = 0;
  private aiPulseMeshes: Mesh[] = [];
  private scoreFlashes: ScoreFlash[] = [];
  private boardShake: BoardShake | null = null;
  private boardGroup: Group | null = null;

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

  /** Score flash indicator — expanding ring + pip floating upward at box center */
  scoreFlash(worldPos: Vector3, colorIdx: number, count: number = 1) {
    const cs = COLORS[colorIdx];
    // Expanding ring
    const ringGeo = new SphereGeometry(0.04, 12, 12);
    const ringMat = new MeshStandardMaterial({
      color: new Color(cs.p),
      emissive: new Color(cs.p),
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.copy(worldPos);
    ring.position.z += 0.03;
    this.group.add(ring);

    // Bright pip that floats up
    const pipGeo = new SphereGeometry(0.012, 8, 8);
    const pipColor = count >= 2 ? '#ffcc00' : cs.p;
    const pipMat = new MeshStandardMaterial({
      color: new Color(pipColor),
      emissive: new Color(pipColor),
      emissiveIntensity: 2.5,
      transparent: true,
      opacity: 1.0,
    });
    const pip = new Mesh(pipGeo, pipMat);
    pip.position.copy(worldPos);
    pip.position.z += 0.04;
    // Scale pip by count for multi-box chains
    const ps = 0.8 + count * 0.4;
    pip.scale.set(ps, ps, ps);
    this.group.add(pip);

    this.scoreFlashes.push({
      ring, pip,
      life: 0.7,
      startY: worldPos.y,
    });
  }

  /** Draw-specific effect — neutral golden shimmer */
  drawShimmer(colorIdx: number) {
    const geo = new SphereGeometry(0.015, 8, 8);
    const colors = ['#ffcc00', '#ccaa44', '#ffffff', '#aabb88'];
    for (let i = 0; i < 30; i++) {
      const c = colors[i % colors.length];
      const mat = new MeshStandardMaterial({
        color: new Color(c),
        emissive: new Color(c),
        emissiveIntensity: 1.0,
        transparent: true,
        opacity: 0.8,
      });
      const m = new Mesh(geo, mat);
      const angle = (i / 30) * Math.PI * 2;
      const radius = 0.8 + Math.random() * 0.5;
      m.position.set(
        Math.cos(angle) * radius,
        1.3 + (Math.random() - 0.5) * 0.6,
        -2 + Math.sin(angle) * radius * 0.4,
      );
      const s = 0.4 + Math.random() * 0.8;
      m.scale.set(s, s, s);
      this.group.add(m);
      this.particles.push({
        mesh: m,
        vel: new Vector3(
          Math.cos(angle) * 0.3,
          0.3 + Math.random() * 0.5,
          Math.sin(angle) * 0.2,
        ),
        life: 1.5 + Math.random() * 0.8,
        maxLife: 1.5 + Math.random() * 0.8,
        startScale: s,
      });
    }
  }

  /** Board shake — register a shake on the board group ref */
  setBoardGroup(bg: Group) {
    this.boardGroup = bg;
  }

  shakeBoard(intensity: number = 0.008, duration: number = 0.3) {
    if (!this.boardGroup) return;
    this.boardShake = {
      intensity,
      duration,
      elapsed: 0,
      origX: this.boardGroup.position.x,
      origY: this.boardGroup.position.y,
    };
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

    // Animate score flashes
    for (let i = this.scoreFlashes.length - 1; i >= 0; i--) {
      const sf = this.scoreFlashes[i];
      sf.life -= delta;
      if (sf.life <= 0) {
        this.group.remove(sf.ring);
        this.group.remove(sf.pip);
        sf.ring.geometry.dispose();
        (sf.ring.material as MeshStandardMaterial).dispose();
        sf.pip.geometry.dispose();
        (sf.pip.material as MeshStandardMaterial).dispose();
        this.scoreFlashes.splice(i, 1);
        continue;
      }
      const t = sf.life / 0.7; // normalized remaining
      // Ring expands and fades
      const ringScale = 1 + (1 - t) * 3;
      sf.ring.scale.set(ringScale, ringScale, ringScale);
      (sf.ring.material as MeshStandardMaterial).opacity = t * 0.7;
      (sf.ring.material as MeshStandardMaterial).emissiveIntensity = t * 2.0;
      // Pip floats upward and fades
      sf.pip.position.y = sf.startY + (1 - t) * 0.25;
      (sf.pip.material as MeshStandardMaterial).opacity = Math.min(1, t * 1.5);
    }

    // Board shake
    if (this.boardShake && this.boardGroup) {
      this.boardShake.elapsed += delta;
      const t = this.boardShake.elapsed / this.boardShake.duration;
      if (t >= 1) {
        this.boardGroup.position.x = this.boardShake.origX;
        this.boardGroup.position.y = this.boardShake.origY;
        this.boardShake = null;
      } else {
        const decay = 1 - t;
        const intensity = this.boardShake.intensity * decay;
        this.boardGroup.position.x = this.boardShake.origX + (Math.random() - 0.5) * 2 * intensity;
        this.boardGroup.position.y = this.boardShake.origY + (Math.random() - 0.5) * 2 * intensity;
      }
    }
  }
}
