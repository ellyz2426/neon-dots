import {
  createSystem,
  RayInteractable,
  Pressed,
  Hovered,
  Entity,
  Group,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  Color,
  InputComponent,
} from '@iwsdk/core';

// ---- Types ----
type LT = 'h' | 'v';
type P = 0 | 1 | 2;
type Mode = 'classic' | 'speed' | 'zen' | 'challenge';
type Diff = 'easy' | 'medium' | 'hard';

export interface GState {
  n: number; hL: P[][]; vL: P[][]; bx: P[][]; cur: 1 | 2;
  sc: [number, number]; total: number; over: boolean;
  mode: Mode; diff: Diff; ci: number; timer: number; moves: number; on: boolean;
}

export interface GStats {
  played: number; won: number; boxes: number; achvs: string[];
  best: Record<string, number>; wGrid: Record<string, number>;
  wDiff: Record<string, number>; maxChain: number;
}

export const COLORS = [
  { nm: 'Cyan',  p: '#00ffff', a: '#ff44aa', dot: '#aaccdd', emp: '#182838', bg: '#050a12', pF: '#003344', aF: '#330022' },
  { nm: 'Green', p: '#44ff44', a: '#ff8800', dot: '#aaddaa', emp: '#1a2a18', bg: '#050a08', pF: '#003300', aF: '#331100' },
  { nm: 'Gold',  p: '#ffcc00', a: '#8844ff', dot: '#ddccaa', emp: '#2a2218', bg: '#0a0805', pF: '#332200', aF: '#110033' },
  { nm: 'Rose',  p: '#ff6688', a: '#4488ff', dot: '#ddaacc', emp: '#2a1822', bg: '#0a0508', pF: '#330011', aF: '#001133' },
];

export const GRIDS = [
  { n: 3, lbl: '2x2 Easy' }, { n: 4, lbl: '3x3 Normal' }, { n: 5, lbl: '4x4 Hard' },
];

export const ACHVS = [
  { id: 'first_box',     nm: 'First Box',      ds: 'Complete your first box' },
  { id: 'shutout',       nm: 'Shutout',         ds: 'Win without AI scoring' },
  { id: 'speedster',     nm: 'Speedster',       ds: 'Win a Speed mode game' },
  { id: 'strategist',    nm: 'Strategist',      ds: 'Win against Hard AI' },
  { id: 'domination',    nm: 'Domination',      ds: 'Win with 2x the AI score' },
  { id: 'chain3',        nm: 'Chain Reaction',  ds: 'Complete 3+ boxes in one turn' },
  { id: 'close_call',    nm: 'Close Call',      ds: 'Win by exactly 1 box' },
  { id: 'marathon10',    nm: 'Marathon',         ds: 'Play 10 games' },
  { id: 'marathon25',    nm: 'Dedicated',        ds: 'Play 25 games' },
  { id: 'quick_win',     nm: 'Quick Thinker',   ds: 'Win speed mode with 30+ sec left' },
  { id: 'comeback',      nm: 'Comeback',         ds: 'Win after trailing' },
  { id: 'sweep5',        nm: 'Sweep',            ds: 'Complete 5+ boxes in one turn' },
  { id: 'tactician',     nm: 'Tactician',        ds: 'Win on Medium difficulty' },
  { id: 'last_box',      nm: 'Last Box',         ds: 'Complete the final box' },
  { id: 'all_sizes',     nm: 'All Sizes',        ds: 'Win on all 3 grid sizes' },
  { id: 'collector50',   nm: 'Box Collector',    ds: 'Complete 50 total boxes' },
  { id: 'collector200',  nm: 'Box Legend',       ds: 'Complete 200 total boxes' },
  { id: 'perfect_small', nm: 'Perfect Small',   ds: 'Win all boxes on 2x2' },
  { id: 'zen_master',    nm: 'Zen Master',       ds: 'Fill the board in Zen mode' },
  { id: 'challenger',    nm: 'Challenger',        ds: 'Win a Challenge game' },
];

const SP = 0.35, DOT_R = 0.022, LW = 0.028, HIT_W = 0.055;

function loadStats(): GStats {
  try { const r = localStorage.getItem('neon-dots-stats'); if (r) return JSON.parse(r); } catch {}
  return { played: 0, won: 0, boxes: 0, achvs: [], best: {}, wGrid: {}, wDiff: {}, maxChain: 0 };
}
function saveStats(s: GStats) { try { localStorage.setItem('neon-dots-stats', JSON.stringify(s)); } catch {} }

export class GameSystem extends createSystem({
  lines: { required: [RayInteractable] },
}) {
  st!: GState;
  stats!: GStats;
  private bg!: Group;
  private ents: Entity[] = [];
  private infoMap = new Map<number, { t: LT; r: number; c: number }>();
  private meshMap = new Map<string, Mesh>();
  private pressed = new Set<number>();
  private aiDly = 0;
  private aiWasAhead = false;
  private cidx = 0;
  private kdb = 0;

  /** Get the world position of a box center (for effects) */
  getBoxWorldPos(row: number, col: number): { x: number; y: number; z: number } | null {
    if (!this.bg) return null;
    const { n } = this.st, half = (n - 1) / 2;
    const SP = 0.35;
    const x = (col + 0.5 - half) * SP;
    const y = (half - row - 0.5) * SP;
    return {
      x: this.bg.position.x + x,
      y: this.bg.position.y + y,
      z: this.bg.position.z + 0.02,
    };
  }

  /** Get the world position of a line center (for effects) */
  getLineWorldPos(t: LT, row: number, col: number): { x: number; y: number; z: number } | null {
    if (!this.bg) return null;
    const { n } = this.st, half = (n - 1) / 2;
    const SP = 0.35;
    const isH = t === 'h';
    const x = isH ? (col + 0.5 - half) * SP : (col - half) * SP;
    const y = isH ? (half - row) * SP : (half - row - 0.5) * SP;
    return {
      x: this.bg.position.x + x,
      y: this.bg.position.y + y,
      z: this.bg.position.z + 0.02,
    };
  }
  onScore?: () => void;
  onOver?: (w: 'player' | 'ai' | 'draw') => void;
  onTurn?: () => void;
  onAchv?: (id: string) => void;
  onReady?: () => void;
  onTimer?: () => void;
  onChain?: (count: number) => void;
  onBoxComplete?: (row: number, col: number) => void;
  onLinePlaced?: (t: LT, row: number, col: number) => void;

  init() {
    this.stats = loadStats();
    this.st = this.mk(4, 'classic', 'medium', 0);
  }

  mk(n: number, mode: Mode, diff: Diff, ci: number): GState {
    const hL: P[][] = [], vL: P[][] = [], bx: P[][] = [];
    for (let r = 0; r < n; r++) hL.push(new Array(n - 1).fill(0));
    for (let r = 0; r < n - 1; r++) vL.push(new Array(n).fill(0));
    for (let r = 0; r < n - 1; r++) bx.push(new Array(n - 1).fill(0));
    return { n, hL, vL, bx, cur: 1, sc: [0, 0], total: (n - 1) * (n - 1),
      over: false, mode, diff: mode === 'challenge' ? 'hard' : diff,
      ci, timer: mode === 'speed' ? 90 : 0, moves: 0, on: false };
  }

  start(n: number, mode: Mode, diff: Diff, ci: number) {
    this.st = this.mk(n, mode, diff, ci);
    this.st.on = true;
    this.aiDly = 0; this.aiWasAhead = false; this.cidx = 0;
    this.build();
    this.onScore?.(); this.onTurn?.(); this.onReady?.();
  }

  build() {
    if (this.bg) this.world.scene.remove(this.bg);
    for (const e of this.ents) { if (e.object3D) e.object3D.position.set(0, -100, 0); }
    this.ents = []; this.infoMap.clear(); this.meshMap.clear();

    const { n, ci } = this.st;
    const cs = COLORS[ci], half = (n - 1) / 2;

    this.bg = new Group();
    this.bg.position.set(0, 1.3, -2.0);
    this.world.scene.add(this.bg);

    // Background panel
    const sz = (n - 1) * SP + 0.22;
    const bgM = new Mesh(new BoxGeometry(sz, sz, 0.015),
      new MeshStandardMaterial({ color: new Color(cs.bg), emissive: new Color(cs.bg), emissiveIntensity: 0.3 }));
    bgM.position.z = -0.01; this.bg.add(bgM);

    // Border glow
    const bd = new Mesh(new BoxGeometry(sz + 0.02, sz + 0.02, 0.005),
      new MeshStandardMaterial({ color: new Color(cs.p), emissive: new Color(cs.p), emissiveIntensity: 0.4, transparent: true, opacity: 0.3 }));
    bd.position.z = -0.015; this.bg.add(bd);

    // Dots
    const dg = new SphereGeometry(DOT_R, 12, 12);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const d = new Mesh(dg, new MeshStandardMaterial({ color: new Color(cs.dot), emissive: new Color(cs.dot), emissiveIntensity: 0.8 }));
      d.position.set((c - half) * SP, (half - r) * SP, 0.01); this.bg.add(d);
    }

    // Lines
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) this.mkLine('h', r, c, half, cs);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) this.mkLine('v', r, c, half, cs);

    this.updCursor();
  }

  private mkLine(t: LT, row: number, col: number, half: number, cs: typeof COLORS[0]) {
    const isH = t === 'h';
    const x = isH ? (col + 0.5 - half) * SP : (col - half) * SP;
    const y = isH ? (half - row) * SP : (half - row - 0.5) * SP;
    const len = SP - DOT_R * 3;

    // Visual
    const geo = isH ? new BoxGeometry(len, LW, 0.012) : new BoxGeometry(LW, len, 0.012);
    const mat = new MeshStandardMaterial({ color: new Color(cs.emp), emissive: new Color(cs.emp), emissiveIntensity: 0.3, transparent: true, opacity: 0.35 });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(x, y, 0.01); this.bg.add(mesh);
    this.meshMap.set(`${t}_${row}_${col}`, mesh);

    // Hit target
    const hg = isH ? new BoxGeometry(len, HIT_W, 0.02) : new BoxGeometry(HIT_W, len, 0.02);
    const hm = new Mesh(hg, new MeshStandardMaterial({ transparent: true, opacity: 0.0 }));
    const grp = new Group();
    grp.position.set(x, y, 0.015); this.bg.add(grp);
    grp.add(hm);
    const ent = this.world.createTransformEntity(grp);
    ent.addComponent(RayInteractable);
    this.ents.push(ent);
    this.infoMap.set(ent.index, { t, r: row, c: col });
  }

  place(t: LT, r: number, c: number, p: P): number {
    const s = this.st;
    const arr = t === 'h' ? s.hL : s.vL;
    if (arr[r][c] !== 0) return 0;
    arr[r][c] = p; s.moves++;

    const cs = COLORS[s.ci];
    const mesh = this.meshMap.get(`${t}_${r}_${c}`);
    if (mesh) {
      const cl = p === 1 ? cs.p : cs.a;
      (mesh.material as MeshStandardMaterial).color.set(cl);
      (mesh.material as MeshStandardMaterial).emissive.set(cl);
      (mesh.material as MeshStandardMaterial).emissiveIntensity = 0.9;
      (mesh.material as MeshStandardMaterial).opacity = 1.0;
    }
    this.onLinePlaced?.(t, r, c);

    return this.chkBoxes(t, r, c, p);
  }

  private chkBoxes(t: LT, r: number, c: number, p: P): number {
    const s = this.st, n = s.n;
    let done = 0;
    const checks: [number, number][] = [];
    if (t === 'h') { if (r > 0) checks.push([r - 1, c]); if (r < n - 1) checks.push([r, c]); }
    else { if (c > 0) checks.push([r, c - 1]); if (c < n - 1) checks.push([r, c]); }

    for (const [br, bc] of checks) {
      if (s.bx[br][bc] !== 0) continue;
      if (s.hL[br][bc] && s.hL[br + 1][bc] && s.vL[br][bc] && s.vL[br][bc + 1]) {
        s.bx[br][bc] = p; s.sc[p - 1]++; done++;
        this.mkBoxFill(br, bc, p);
        this.onBoxComplete?.(br, bc);
      }
    }
    return done;
  }

  private mkBoxFill(row: number, col: number, p: P) {
    const { n, ci } = this.st, half = (n - 1) / 2, cs = COLORS[ci];
    const x = (col + 0.5 - half) * SP, y = (half - row - 0.5) * SP;
    const sz = SP * 0.75;
    const fc = p === 1 ? cs.pF : cs.aF, ec = p === 1 ? cs.p : cs.a;
    const fill = new Mesh(new BoxGeometry(sz, sz, 0.008),
      new MeshStandardMaterial({ color: new Color(fc), emissive: new Color(ec), emissiveIntensity: 0.5, transparent: true, opacity: 0.7 }));
    fill.position.set(x, y, 0.005); this.bg.add(fill);

    const mk = new Mesh(new SphereGeometry(0.018, 8, 8),
      new MeshStandardMaterial({ color: new Color(ec), emissive: new Color(ec), emissiveIntensity: 1.0 }));
    mk.position.set(x, y, 0.015); this.bg.add(mk);
  }

  // AI
  private avail(): { t: LT; r: number; c: number }[] {
    const s = this.st, n = s.n, res: { t: LT; r: number; c: number }[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) if (!s.hL[r][c]) res.push({ t: 'h', r, c });
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) if (!s.vL[r][c]) res.push({ t: 'v', r, c });
    return res;
  }

  private wouldComplete(t: LT, r: number, c: number): number {
    const s = this.st, n = s.n;
    let cnt = 0;
    const checks: [number, number][] = [];
    if (t === 'h') { if (r > 0) checks.push([r - 1, c]); if (r < n - 1) checks.push([r, c]); }
    else { if (c > 0) checks.push([r, c - 1]); if (c < n - 1) checks.push([r, c]); }
    for (const [br, bc] of checks) {
      if (s.bx[br][bc]) continue;
      let sides = 0;
      if (s.hL[br][bc]) sides++; if (s.hL[br + 1][bc]) sides++;
      if (s.vL[br][bc]) sides++; if (s.vL[br][bc + 1]) sides++;
      if (sides === 3) cnt++;
    }
    return cnt;
  }

  private would3rd(t: LT, r: number, c: number): boolean {
    const s = this.st, n = s.n;
    const checks: [number, number][] = [];
    if (t === 'h') { if (r > 0) checks.push([r - 1, c]); if (r < n - 1) checks.push([r, c]); }
    else { if (c > 0) checks.push([r, c - 1]); if (c < n - 1) checks.push([r, c]); }
    for (const [br, bc] of checks) {
      if (s.bx[br][bc]) continue;
      let sides = 0;
      if (s.hL[br][bc]) sides++; if (s.hL[br + 1][bc]) sides++;
      if (s.vL[br][bc]) sides++; if (s.vL[br][bc + 1]) sides++;
      if (sides === 2) return true;
    }
    return false;
  }

  private aiPick(): { t: LT; r: number; c: number } | null {
    const av = this.avail();
    if (!av.length) return null;
    const d = this.st.diff;
    if (d === 'easy') return av[Math.floor(Math.random() * av.length)];

    const comp = av.filter(l => this.wouldComplete(l.t, l.r, l.c) > 0);
    if (comp.length) {
      comp.sort((a, b) => this.wouldComplete(b.t, b.r, b.c) - this.wouldComplete(a.t, a.r, a.c));
      return comp[0];
    }

    const safe = av.filter(l => !this.would3rd(l.t, l.r, l.c));
    if (safe.length) return safe[Math.floor(Math.random() * safe.length)];

    av.sort((a, b) => this.wouldComplete(a.t, a.r, a.c) - this.wouldComplete(b.t, b.r, b.c));
    if (d === 'hard') {
      const min = this.wouldComplete(av[0].t, av[0].r, av[0].c);
      const mins = av.filter(l => this.wouldComplete(l.t, l.r, l.c) === min);
      return mins[Math.floor(Math.random() * mins.length)];
    }
    return av[0];
  }

  private doAi() {
    const mv = this.aiPick();
    if (!mv) return;
    const done = this.place(mv.t, mv.r, mv.c, 2);
    this.onScore?.();
    if (done > 0) {
      if (this.isDone()) { this.end(); return; }
      this.aiDly = 0.4;
    } else {
      this.st.cur = 1; this.onTurn?.(); this.updCursor();
    }
  }

  private isDone(): boolean { const s = this.st; return s.sc[0] + s.sc[1] >= s.total; }

  end() {
    const s = this.st; s.over = true; s.on = false;
    const st = this.stats; st.played++;
    let w: 'player' | 'ai' | 'draw' = 'draw';
    if (s.sc[0] > s.sc[1]) { w = 'player'; st.won++; }
    else if (s.sc[1] > s.sc[0]) w = 'ai';
    st.boxes += s.sc[0];

    if (w === 'player') {
      st.wGrid[s.n] = (st.wGrid[s.n] || 0) + 1;
      st.wDiff[s.diff] = (st.wDiff[s.diff] || 0) + 1;
    }

    const grant = (id: string) => { if (!st.achvs.includes(id)) { st.achvs.push(id); this.onAchv?.(id); } };
    if (s.sc[0] > 0) grant('first_box');
    if (w === 'player' && !s.sc[1]) grant('shutout');
    if (w === 'player' && s.mode === 'speed') grant('speedster');
    if (w === 'player' && s.diff === 'hard') grant('strategist');
    if (w === 'player' && s.sc[0] >= s.sc[1] * 2 && s.sc[1] > 0) grant('domination');
    if (w === 'player' && s.sc[0] - s.sc[1] === 1) grant('close_call');
    if (st.played >= 10) grant('marathon10');
    if (st.played >= 25) grant('marathon25');
    if (w === 'player' && s.mode === 'speed' && s.timer >= 30) grant('quick_win');
    if (w === 'player' && this.aiWasAhead) grant('comeback');
    if (w === 'player' && s.diff === 'medium') grant('tactician');
    if (w === 'player' && s.mode === 'challenge') grant('challenger');
    if (w === 'player' && s.n === 3 && s.sc[0] === s.total) grant('perfect_small');
    if (s.mode === 'zen' && s.sc[0] === s.total) grant('zen_master');
    if (st.boxes >= 50) grant('collector50');
    if (st.boxes >= 200) grant('collector200');
    if (st.wGrid['3'] && st.wGrid['4'] && st.wGrid['5']) grant('all_sizes');
    if (s.sc[0] + s.sc[1] === s.total && s.cur === 1) grant('last_box');

    saveStats(st);
    this.onOver?.(w);
  }

  private updCursor() {
    const av = this.avail(), cs = COLORS[this.st.ci];
    if (!av.length) return;
    if (this.cidx >= av.length) this.cidx = 0;

    for (const l of av) {
      const m = this.meshMap.get(`${l.t}_${l.r}_${l.c}`);
      if (m) {
        (m.material as MeshStandardMaterial).emissive.set(cs.emp);
        (m.material as MeshStandardMaterial).emissiveIntensity = 0.3;
        (m.material as MeshStandardMaterial).opacity = 0.35;
      }
    }
    const cur = av[this.cidx];
    if (cur) {
      const m = this.meshMap.get(`${cur.t}_${cur.r}_${cur.c}`);
      if (m) {
        (m.material as MeshStandardMaterial).emissive.set(cs.p);
        (m.material as MeshStandardMaterial).emissiveIntensity = 0.6;
        (m.material as MeshStandardMaterial).opacity = 0.7;
      }
    }
  }

  private doPlayerMove(t: LT, r: number, c: number) {
    const s = this.st;
    if (s.cur !== 1 || s.over) return;
    const arr = t === 'h' ? s.hL : s.vL;
    if (arr[r][c]) return;

    const done = this.place(t, r, c, 1);
    this.onScore?.();

    if (done > 0) {
      // Track chain for current turn
      this.onChain?.(done);
      if (done >= 3) {
        if (!this.stats.achvs.includes('chain3')) { this.stats.achvs.push('chain3'); this.onAchv?.('chain3'); }
        if (done >= 5 && !this.stats.achvs.includes('sweep5')) { this.stats.achvs.push('sweep5'); this.onAchv?.('sweep5'); }
        if (done > this.stats.maxChain) this.stats.maxChain = done;
        saveStats(this.stats);
      }
      if (this.isDone()) { this.end(); return; }
      this.updCursor();
    } else {
      if (this.isDone()) { this.end(); return; }
      if (s.mode === 'zen') { this.updCursor(); return; }
      s.cur = 2; this.aiDly = 0.6; this.onTurn?.();
    }
  }

  update(delta: number, _time: number) {
    const s = this.st;
    if (!s.on || s.over) return;

    if (s.mode === 'speed') {
      s.timer -= delta;
      this.onTimer?.();
      if (s.timer <= 0) { s.timer = 0; this.end(); return; }
    }

    if (s.cur === 2) {
      this.aiDly -= delta;
      if (this.aiDly <= 0) this.doAi();
      return;
    }

    // Hover
    const cs = COLORS[s.ci];
    this.queries.lines.entities.forEach(e => {
      const inf = this.infoMap.get(e.index);
      if (!inf) return;
      const arr = inf.t === 'h' ? s.hL : s.vL;
      if (arr[inf.r][inf.c]) return;
      const m = this.meshMap.get(`${inf.t}_${inf.r}_${inf.c}`);
      if (!m) return;
      if (e.hasComponent(Hovered)) {
        (m.material as MeshStandardMaterial).emissive.set(cs.p);
        (m.material as MeshStandardMaterial).emissiveIntensity = 0.6;
        (m.material as MeshStandardMaterial).opacity = 0.65;
      } else {
        const av = this.avail();
        const cl = av[this.cidx];
        const isC = cl && cl.t === inf.t && cl.r === inf.r && cl.c === inf.c;
        if (!isC) {
          (m.material as MeshStandardMaterial).emissive.set(cs.emp);
          (m.material as MeshStandardMaterial).emissiveIntensity = 0.3;
          (m.material as MeshStandardMaterial).opacity = 0.35;
        }
      }
    });

    // Click
    const cp = new Set<number>();
    this.queries.lines.entities.forEach(e => {
      if (e.hasComponent(Pressed)) {
        cp.add(e.index);
        if (!this.pressed.has(e.index)) {
          const inf = this.infoMap.get(e.index);
          if (inf) this.doPlayerMove(inf.t, inf.r, inf.c);
        }
      }
    });
    this.pressed = cp;

    // Keyboard
    this.kdb -= delta;
    const kb = this.input.keyboard;
    const av = this.avail();
    if (av.length && this.kdb <= 0) {
      let moved = false;
      if (kb.getKeyDown('ArrowRight') || kb.getKeyDown('KeyD')) { this.cidx = (this.cidx + 1) % av.length; moved = true; }
      else if (kb.getKeyDown('ArrowLeft') || kb.getKeyDown('KeyA')) { this.cidx = (this.cidx - 1 + av.length) % av.length; moved = true; }
      else if (kb.getKeyDown('ArrowDown') || kb.getKeyDown('KeyS')) { this.cidx = (this.cidx + 5) % av.length; moved = true; }
      else if (kb.getKeyDown('ArrowUp') || kb.getKeyDown('KeyW')) { this.cidx = (this.cidx - 5 + av.length) % av.length; moved = true; }
      if (moved) { this.kdb = 0.12; this.updCursor(); }

      if (kb.getKeyDown('Space') || kb.getKeyDown('Enter')) {
        const cur = av[this.cidx];
        if (cur) this.doPlayerMove(cur.t, cur.r, cur.c);
        this.kdb = 0.2;
      }
    }

    // XR
    const rp = this.input.xr?.gamepads?.right;
    if (rp) {
      if (rp.getButtonDown(InputComponent.A_Button)) {
        const cur = av[this.cidx];
        if (cur) this.doPlayerMove(cur.t, cur.r, cur.c);
      }
      const stk = rp.getAxesValues(InputComponent.Thumbstick);
      if (stk && this.kdb <= 0 && av.length) {
        if (stk.x > 0.5) { this.cidx = (this.cidx + 1) % av.length; this.updCursor(); this.kdb = 0.15; }
        else if (stk.x < -0.5) { this.cidx = (this.cidx - 1 + av.length) % av.length; this.updCursor(); this.kdb = 0.15; }
        else if (stk.y < -0.5) { this.cidx = (this.cidx + 5) % av.length; this.updCursor(); this.kdb = 0.15; }
        else if (stk.y > 0.5) { this.cidx = (this.cidx - 5 + av.length) % av.length; this.updCursor(); this.kdb = 0.15; }
      }
    }

    if (s.sc[1] > s.sc[0]) this.aiWasAhead = true;
  }
}
