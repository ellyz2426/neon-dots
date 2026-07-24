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
type Mode = 'classic' | 'speed' | 'zen' | 'challenge' | '2player';
type Diff = 'easy' | 'medium' | 'hard';

export interface GState {
  n: number; hL: P[][]; vL: P[][]; bx: P[][]; cur: 1 | 2;
  sc: [number, number]; total: number; over: boolean;
  mode: Mode; diff: Diff; ci: number; timer: number; moves: number; on: boolean;
  elapsed: number;
}

export interface UndoEntry {
  t: LT; r: number; c: number; p: P;
  boxesFilled: { r: number; c: number }[];
}

export interface GStats {
  played: number; won: number; boxes: number; achvs: string[];
  best: Record<string, number>; wGrid: Record<string, number>;
  wDiff: Record<string, number>; maxChain: number;
  streak: number; bestStreak: number;
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

export const SP = 0.35, DOT_R = 0.022, LW = 0.028, HIT_W = 0.055;

function loadStats(): GStats {
  try { const r = localStorage.getItem('neon-dots-stats'); if (r) return JSON.parse(r); } catch {}
  return { played: 0, won: 0, boxes: 0, achvs: [], best: {}, wGrid: {}, wDiff: {}, maxChain: 0, streak: 0, bestStreak: 0 };
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
  private dotMeshes: Mesh[] = [];
  private pressed = new Set<number>();
  private aiDly = 0;
  private aiWasAhead = false;
  private cidx = 0;
  private kdb = 0;
  private undoStack: UndoEntry[] = [];
  private boxFillAnims: { mesh: Mesh; mark: Mesh; t: number }[] = [];
  private boardEntranceT = -1;
  private lastMoveKey = '';
  private lastMoveFade = 0;
  private hoverPreviewMeshes: Mesh[] = [];
  private scoreBarP1!: Mesh;
  private scoreBarP2!: Mesh;
  private scoreBarBg!: Mesh;
  private borderMesh!: Mesh;
  private borderPulseT = 0;
  private lineGrowAnims: { mesh: Mesh; t: number; isH: boolean }[] = [];
  totalChains = 0;
  totalChainBoxes = 0;

  /** Get the board group for external effects (e.g. shake) */
  getBoardGroup(): Group { return this.bg; }

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
  onUndo?: () => void;
  onTimerUrgent?: (secsLeft: number) => void;
  onAiThinking?: (thinking: boolean) => void;

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
      ci, timer: mode === 'speed' ? 90 : 0, moves: 0, on: false, elapsed: 0 };
  }

  start(n: number, mode: Mode, diff: Diff, ci: number) {
    this.st = this.mk(n, mode, diff, ci);
    this.st.on = true;
    this.aiDly = 0; this.aiWasAhead = false; this.cidx = 0;
    this.undoStack = [];
    this.totalChains = 0;
    this.totalChainBoxes = 0;
    this.build();

    // Challenge mode: pre-place random lines to create a mid-game position
    if (mode === 'challenge') {
      this.prefillChallenge();
    }

    this.onScore?.(); this.onTurn?.(); this.onReady?.();
  }

  /** Pre-fill some random lines for Challenge mode to create a mid-game start */
  private prefillChallenge() {
    const s = this.st, n = s.n;
    const allLines: { t: LT; r: number; c: number }[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) allLines.push({ t: 'h', r, c });
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) allLines.push({ t: 'v', r, c });

    // Shuffle
    for (let i = allLines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allLines[i], allLines[j]] = [allLines[j], allLines[i]];
    }

    // Place ~25% of lines, alternating players, avoiding completing any box
    const target = Math.floor(allLines.length * 0.25);
    let placed = 0;
    for (const line of allLines) {
      if (placed >= target) break;
      // Check if placing would complete a box — skip if so
      const wouldComp = this.wouldComplete(line.t, line.r, line.c);
      if (wouldComp > 0) continue;
      // Check if placing would create a 3-sided box — skip most of the time to avoid easy setups
      if (this.would3rd(line.t, line.r, line.c) && Math.random() < 0.7) continue;

      const p: P = (placed % 2 === 0) ? 1 : 2;
      const arr = line.t === 'h' ? s.hL : s.vL;
      arr[line.r][line.c] = p;

      // Color the line visual
      const cs = COLORS[s.ci];
      const mesh = this.meshMap.get(`${line.t}_${line.r}_${line.c}`);
      if (mesh) {
        const cl = p === 1 ? cs.p : cs.a;
        (mesh.material as MeshStandardMaterial).color.set(cl);
        (mesh.material as MeshStandardMaterial).emissive.set(cl);
        (mesh.material as MeshStandardMaterial).emissiveIntensity = 0.7;
        (mesh.material as MeshStandardMaterial).opacity = 0.85;
      }
      placed++;
    }
  }

  build() {
    if (this.bg) this.world.scene.remove(this.bg);
    for (const e of this.ents) { if (e.object3D) e.object3D.position.set(0, -100, 0); }
    this.ents = []; this.infoMap.clear(); this.meshMap.clear();
    this.dotMeshes = []; this.boxFillAnims = [];

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
      this.dotMeshes.push(d);
    }

    // Lines
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) this.mkLine('h', r, c, half, cs);
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) this.mkLine('v', r, c, half, cs);

    // Score ratio bar below the board
    const barW = sz * 0.8, barH = 0.025;
    const barY = -(sz / 2) - 0.06;
    this.scoreBarBg = new Mesh(new BoxGeometry(barW, barH, 0.006),
      new MeshStandardMaterial({ color: new Color('#111822'), emissive: new Color('#111822'), emissiveIntensity: 0.2 }));
    this.scoreBarBg.position.set(0, barY, 0.01); this.bg.add(this.scoreBarBg);

    this.scoreBarP1 = new Mesh(new BoxGeometry(0.001, barH, 0.008),
      new MeshStandardMaterial({ color: new Color(cs.p), emissive: new Color(cs.p), emissiveIntensity: 0.8 }));
    this.scoreBarP1.position.set(-barW / 2, barY, 0.012); this.bg.add(this.scoreBarP1);

    this.scoreBarP2 = new Mesh(new BoxGeometry(0.001, barH, 0.008),
      new MeshStandardMaterial({ color: new Color(cs.a), emissive: new Color(cs.a), emissiveIntensity: 0.8 }));
    this.scoreBarP2.position.set(barW / 2, barY, 0.012); this.bg.add(this.scoreBarP2);

    // Save border mesh for pulse effects
    this.borderMesh = bd;

    this.updCursor();
    this.updScoreBar();
    // Board entrance animation — start tiny, scale up
    this.bg.scale.set(0.01, 0.01, 0.01);
    this.boardEntranceT = 0;
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

  /** Update score ratio bar */
  updScoreBar() {
    const s = this.st;
    if (!this.scoreBarBg) return;
    const bgGeo = this.scoreBarBg.geometry as BoxGeometry;
    const barW = bgGeo.parameters.width;
    const barY = this.scoreBarBg.position.y;
    const total = Math.max(1, s.total);
    const p1Ratio = s.sc[0] / total;
    const p2Ratio = s.sc[1] / total;
    const cs = COLORS[s.ci];

    // P1 bar grows from left
    const p1W = Math.max(0.001, barW * p1Ratio);
    this.scoreBarP1.scale.x = p1W / 0.001;
    this.scoreBarP1.position.x = -barW / 2 + p1W / 2;

    // P2 bar grows from right
    const p2W = Math.max(0.001, barW * p2Ratio);
    this.scoreBarP2.scale.x = p2W / 0.001;
    this.scoreBarP2.position.x = barW / 2 - p2W / 2;
  }

  /** Show preview highlights on boxes that would complete if a line is placed */
  showHoverPreview(t: LT, r: number, c: number) {
    this.clearHoverPreview();
    const s = this.st, n = s.n;
    if (s.over || !s.on) return;
    const arr = t === 'h' ? s.hL : s.vL;
    if (arr[r][c]) return;

    const checks: [number, number][] = [];
    if (t === 'h') { if (r > 0) checks.push([r - 1, c]); if (r < n - 1) checks.push([r, c]); }
    else { if (c > 0) checks.push([r, c - 1]); if (c < n - 1) checks.push([r, c]); }

    const cs = COLORS[s.ci];
    const half = (n - 1) / 2;
    for (const [br, bc] of checks) {
      if (s.bx[br][bc]) continue;
      let sides = 0;
      if (s.hL[br][bc]) sides++; if (s.hL[br + 1][bc]) sides++;
      if (s.vL[br][bc]) sides++; if (s.vL[br][bc + 1]) sides++;
      if (sides === 3) {
        // This box would complete — show preview
        const x = (bc + 0.5 - half) * SP, y = (half - br - 0.5) * SP;
        const sz = SP * 0.75;
        const preview = new Mesh(new BoxGeometry(sz, sz, 0.007),
          new MeshStandardMaterial({
            color: new Color(cs.p), emissive: new Color(cs.p),
            emissiveIntensity: 0.4, transparent: true, opacity: 0.25,
          }));
        preview.position.set(x, y, 0.004);
        this.bg.add(preview);
        this.hoverPreviewMeshes.push(preview);
      }
    }
  }

  /** Clear hover preview meshes */
  clearHoverPreview() {
    for (const m of this.hoverPreviewMeshes) {
      this.bg.remove(m);
      m.geometry.dispose();
      (m.material as MeshStandardMaterial).dispose();
    }
    this.hoverPreviewMeshes = [];
  }

  /** Trigger border pulse */
  pulseBorder() {
    this.borderPulseT = 1.0;
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
      // Start line grow animation — scale from 0 on primary axis
      const isH = t === 'h';
      if (isH) mesh.scale.x = 0.05;
      else mesh.scale.y = 0.05;
      this.lineGrowAnims.push({ mesh, t: 0, isH });
    }
    this.onLinePlaced?.(t, r, c);
    this.lastMoveKey = `${t}_${r}_${c}`;
    this.lastMoveFade = 1.0;

    const boxesFilled = this.chkBoxes(t, r, c, p);

    // Update score bar after placement
    if (boxesFilled > 0) {
      this.updScoreBar();
      this.totalChains++;
      this.totalChainBoxes += boxesFilled;
    }
    // Clear hover preview after placing
    this.clearHoverPreview();

    // Track undo for Zen mode (player moves only)
    if (p === 1 && s.mode === 'zen') {
      this.undoStack.push({ t, r, c, p, boxesFilled: this.lastFilledBoxes });
    }

    return boxesFilled;
  }

  private lastFilledBoxes: { r: number; c: number }[] = [];

  private chkBoxes(t: LT, r: number, c: number, p: P): number {
    const s = this.st, n = s.n;
    let done = 0;
    this.lastFilledBoxes = [];
    const checks: [number, number][] = [];
    if (t === 'h') { if (r > 0) checks.push([r - 1, c]); if (r < n - 1) checks.push([r, c]); }
    else { if (c > 0) checks.push([r, c - 1]); if (c < n - 1) checks.push([r, c]); }

    for (const [br, bc] of checks) {
      if (s.bx[br][bc] !== 0) continue;
      if (s.hL[br][bc] && s.hL[br + 1][bc] && s.vL[br][bc] && s.vL[br][bc + 1]) {
        s.bx[br][bc] = p; s.sc[p - 1]++; done++;
        this.lastFilledBoxes.push({ r: br, c: bc });
        this.mkBoxFill(br, bc, p);
        this.onBoxComplete?.(br, bc);
      }
    }
    return done;
  }

  private boxFillMeshes = new Map<string, Mesh[]>();

  private mkBoxFill(row: number, col: number, p: P) {
    const { n, ci } = this.st, half = (n - 1) / 2, cs = COLORS[ci];
    const x = (col + 0.5 - half) * SP, y = (half - row - 0.5) * SP;
    const sz = SP * 0.75;
    const fc = p === 1 ? cs.pF : cs.aF, ec = p === 1 ? cs.p : cs.a;
    const fill = new Mesh(new BoxGeometry(sz, sz, 0.008),
      new MeshStandardMaterial({ color: new Color(fc), emissive: new Color(ec), emissiveIntensity: 0.5, transparent: true, opacity: 0.7 }));
    fill.position.set(x, y, 0.005);
    fill.scale.set(0, 0, 1); // Start at 0 scale for animation
    this.bg.add(fill);

    const mk = new Mesh(new SphereGeometry(0.018, 8, 8),
      new MeshStandardMaterial({ color: new Color(ec), emissive: new Color(ec), emissiveIntensity: 1.0 }));
    mk.position.set(x, y, 0.015);
    mk.scale.set(0, 0, 0); // Start at 0 scale for animation
    this.bg.add(mk);

    // Add to animation queue
    this.boxFillAnims.push({ mesh: fill, mark: mk, t: 0 });

    const key = `${row}_${col}`;
    this.boxFillMeshes.set(key, [fill, mk]);
  }

  /** Get dot meshes for external highlighting */
  getDotMeshes(): Mesh[] { return this.dotMeshes; }

  /** Check if a specific box position has 3 sides filled (completable) */
  getCompletableBoxes(): { r: number; c: number }[] {
    const s = this.st, n = s.n, result: { r: number; c: number }[] = [];
    if (!s.on || s.over || s.cur !== 1) return result;
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        if (s.bx[r][c]) continue;
        let sides = 0;
        if (s.hL[r][c]) sides++;
        if (s.hL[r + 1][c]) sides++;
        if (s.vL[r][c]) sides++;
        if (s.vL[r][c + 1]) sides++;
        if (sides === 3) result.push({ r, c });
      }
    }
    return result;
  }

  /** Get dots (row, col in dot grid) adjacent to completable boxes */
  getHintDots(): Set<string> {
    const completable = this.getCompletableBoxes();
    const hints = new Set<string>();
    for (const { r, c } of completable) {
      hints.add(`${r}_${c}`);
      hints.add(`${r}_${c + 1}`);
      hints.add(`${r + 1}_${c}`);
      hints.add(`${r + 1}_${c + 1}`);
    }
    return hints;
  }

  /** Undo last player move (Zen mode only). Returns true if undo succeeded. */
  undo(): boolean {
    const s = this.st;
    if (s.mode !== 'zen' || !s.on || s.over || this.undoStack.length === 0) return false;

    const entry = this.undoStack.pop()!;
    const cs = COLORS[s.ci];

    // Undo boxes
    for (const box of entry.boxesFilled) {
      s.bx[box.r][box.c] = 0;
      s.sc[entry.p - 1]--;
      const meshes = this.boxFillMeshes.get(`${box.r}_${box.c}`);
      if (meshes) {
        for (const m of meshes) {
          this.bg.remove(m);
          m.geometry.dispose();
          (m.material as MeshStandardMaterial).dispose();
        }
        this.boxFillMeshes.delete(`${box.r}_${box.c}`);
      }
    }

    // Undo line
    const arr = entry.t === 'h' ? s.hL : s.vL;
    arr[entry.r][entry.c] = 0;
    s.moves--;

    // Reset line visual
    const mesh = this.meshMap.get(`${entry.t}_${entry.r}_${entry.c}`);
    if (mesh) {
      (mesh.material as MeshStandardMaterial).color.set(cs.emp);
      (mesh.material as MeshStandardMaterial).emissive.set(cs.emp);
      (mesh.material as MeshStandardMaterial).emissiveIntensity = 0.3;
      (mesh.material as MeshStandardMaterial).opacity = 0.35;
    }

    this.onScore?.();
    this.updCursor();
    this.onUndo?.();
    return true;
  }

  canUndo(): boolean {
    return this.st.mode === 'zen' && this.st.on && !this.st.over && this.undoStack.length > 0;
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

    // Priority 1: Complete boxes (greedy — take the most boxes)
    const comp = av.filter(l => this.wouldComplete(l.t, l.r, l.c) > 0);
    if (comp.length) {
      comp.sort((a, b) => this.wouldComplete(b.t, b.r, b.c) - this.wouldComplete(a.t, a.r, a.c));
      return comp[0];
    }

    // Priority 2: Avoid giving opponent boxes
    const safe = av.filter(l => !this.would3rd(l.t, l.r, l.c));

    if (d === 'hard' && safe.length) {
      // Hard AI: among safe moves, prefer those that don't open chains
      // A "chain" is a connected sequence of boxes with 2 sides each
      const scored = safe.map(l => {
        // Prefer moves near the center of the board for strategic positioning
        const { n } = this.st;
        const half = (n - 1) / 2;
        const isH = l.t === 'h';
        const cx = isH ? l.c + 0.5 : l.c;
        const cy = isH ? l.r : l.r + 0.5;
        const dist = Math.abs(cx - half) + Math.abs(cy - half);
        return { move: l, score: -dist }; // Lower distance = better
      });
      scored.sort((a, b) => b.score - a.score);
      // Among top tier (within 0.5 of best), pick randomly
      const best = scored[0].score;
      const top = scored.filter(s => s.score >= best - 0.5);
      return top[Math.floor(Math.random() * top.length)].move;
    }

    if (safe.length) return safe[Math.floor(Math.random() * safe.length)];

    // No safe moves — sacrifice the shortest chain (give up fewest boxes)
    if (d === 'hard') {
      // Count how many boxes each move would give the opponent
      const sacrifices = av.map(l => ({
        move: l,
        gives: this.countChainFrom(l.t, l.r, l.c),
      }));
      sacrifices.sort((a, b) => a.gives - b.gives);
      const minGives = sacrifices[0].gives;
      const best = sacrifices.filter(s => s.gives === minGives);
      return best[Math.floor(Math.random() * best.length)].move;
    }

    av.sort((a, b) => this.wouldComplete(a.t, a.r, a.c) - this.wouldComplete(b.t, b.r, b.c));
    return av[0];
  }

  /** Count how many boxes opponent would chain-capture if we place the 3rd side */
  private countChainFrom(t: LT, r: number, c: number): number {
    const s = this.st, n = s.n;
    const checks: [number, number][] = [];
    if (t === 'h') { if (r > 0) checks.push([r - 1, c]); if (r < n - 1) checks.push([r, c]); }
    else { if (c > 0) checks.push([r, c - 1]); if (c < n - 1) checks.push([r, c]); }

    let total = 0;
    for (const [br, bc] of checks) {
      if (s.bx[br][bc]) continue;
      let sides = 0;
      if (s.hL[br][bc]) sides++; if (s.hL[br + 1][bc]) sides++;
      if (s.vL[br][bc]) sides++; if (s.vL[br][bc + 1]) sides++;
      if (sides === 2) {
        // This box would become 3-sided, opponent completes on next move
        // and may chain into adjacent boxes
        total += this.floodChain(br, bc, new Set());
      }
    }
    return total;
  }

  /** Flood-fill count of chain-capturable boxes from a given box */
  private floodChain(br: number, bc: number, visited: Set<string>): number {
    const key = `${br}_${bc}`;
    if (visited.has(key)) return 0;
    visited.add(key);
    const s = this.st, n = s.n;
    if (br < 0 || br >= n - 1 || bc < 0 || bc >= n - 1) return 0;
    if (s.bx[br][bc]) return 0;

    let sides = 0;
    if (s.hL[br][bc]) sides++; if (s.hL[br + 1][bc]) sides++;
    if (s.vL[br][bc]) sides++; if (s.vL[br][bc + 1]) sides++;
    if (sides < 2) return 0; // Not part of a chain

    let count = 1;
    // Check adjacent boxes
    count += this.floodChain(br - 1, bc, visited);
    count += this.floodChain(br + 1, bc, visited);
    count += this.floodChain(br, bc - 1, visited);
    count += this.floodChain(br, bc + 1, visited);
    return count;
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
      this.st.cur = 1; this.onTurn?.(); this.updCursor(); this.pulseBorder();
    }
  }

  private isDone(): boolean { const s = this.st; return s.sc[0] + s.sc[1] >= s.total; }

  end() {
    const s = this.st; s.over = true; s.on = false;
    const st = this.stats; st.played++;
    let w: 'player' | 'ai' | 'draw' = 'draw';
    if (s.sc[0] > s.sc[1]) { w = 'player'; if (s.mode !== '2player') st.won++; }
    else if (s.sc[1] > s.sc[0]) w = 'ai';
    st.boxes += s.sc[0];

    if (w === 'player' && s.mode !== '2player') {
      st.wGrid[s.n] = (st.wGrid[s.n] || 0) + 1;
      st.wDiff[s.diff] = (st.wDiff[s.diff] || 0) + 1;
      st.streak = (st.streak || 0) + 1;
      if (st.streak > (st.bestStreak || 0)) st.bestStreak = st.streak;
    } else if (w !== 'player' && s.mode !== '2player') {
      st.streak = 0;
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
    if (s.over) return;
    if (s.mode !== '2player' && s.cur !== 1) return;
    const arr = t === 'h' ? s.hL : s.vL;
    if (arr[r][c]) return;

    const p = s.cur as P;
    const done = this.place(t, r, c, p);
    this.onScore?.();

    if (done > 0) {
      // Track chain for current turn
      this.onChain?.(done);
      if (s.mode !== '2player' && done >= 3) {
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
      if (s.mode === '2player') {
        s.cur = s.cur === 1 ? 2 : 1;
        this.onTurn?.(); this.updCursor();
      } else {
        s.cur = 2; this.aiDly = 0.6; this.onTurn?.(); this.pulseBorder();
      }
    }
  }

  update(delta: number, _time: number) {
    const s = this.st;
    if (!s.on || s.over) return;

    // Track elapsed time
    s.elapsed += delta;

    // Board entrance animation
    if (this.boardEntranceT >= 0 && this.boardEntranceT < 1) {
      this.boardEntranceT += delta * 3;
      if (this.boardEntranceT >= 1) {
        this.boardEntranceT = -1;
        this.bg.scale.set(1, 1, 1);
      } else {
        const bt = this.boardEntranceT;
        const ease = bt < 0.7 ? (bt / 0.7) * 1.1 : 1.1 - (bt - 0.7) / 0.3 * 0.1;
        this.bg.scale.set(ease, ease, ease);
      }
    }

    // Last move highlight fade
    if (this.lastMoveFade > 0) {
      this.lastMoveFade -= delta * 2;
      if (this.lastMoveFade < 0) this.lastMoveFade = 0;
      const lm = this.meshMap.get(this.lastMoveKey);
      if (lm) {
        (lm.material as MeshStandardMaterial).emissiveIntensity = 0.9 + this.lastMoveFade * 0.8;
      }
    }

    // Animate box fills (scale up from 0 to 1)
    for (let i = this.boxFillAnims.length - 1; i >= 0; i--) {
      const a = this.boxFillAnims[i];
      a.t += delta * 4; // complete in ~0.25s
      if (a.t >= 1) {
        a.mesh.scale.set(1, 1, 1);
        a.mark.scale.set(1, 1, 1);
        this.boxFillAnims.splice(i, 1);
      } else {
        // Ease-out bounce: overshoot then settle
        const t = a.t;
        const ease = t < 0.7 ? (t / 0.7) * 1.15 : 1.15 - (t - 0.7) / 0.3 * 0.15;
        a.mesh.scale.set(ease, ease, 1);
        a.mark.scale.set(ease, ease, ease);
      }
    }

    // Animate line grow (scale from 0 to 1 on primary axis)
    for (let i = this.lineGrowAnims.length - 1; i >= 0; i--) {
      const lg = this.lineGrowAnims[i];
      lg.t += delta * 8; // complete in ~0.125s — snappy
      if (lg.t >= 1) {
        if (lg.isH) lg.mesh.scale.x = 1;
        else lg.mesh.scale.y = 1;
        this.lineGrowAnims.splice(i, 1);
      } else {
        // Ease-out with slight overshoot
        const t = lg.t;
        const ease = t < 0.8 ? (t / 0.8) * 1.08 : 1.08 - (t - 0.8) / 0.2 * 0.08;
        if (lg.isH) lg.mesh.scale.x = ease;
        else lg.mesh.scale.y = ease;
      }
    }

    // Border pulse animation
    if (this.borderPulseT > 0) {
      this.borderPulseT -= delta * 2.5;
      if (this.borderPulseT < 0) this.borderPulseT = 0;
      const bm = this.borderMesh;
      if (bm) {
        const intensity = 0.4 + this.borderPulseT * 0.8;
        const opacity = 0.3 + this.borderPulseT * 0.4;
        (bm.material as MeshStandardMaterial).emissiveIntensity = intensity;
        (bm.material as MeshStandardMaterial).opacity = opacity;
      }
    }

    // Hover preview — animate preview meshes pulsing
    if (this.hoverPreviewMeshes.length > 0) {
      const pulse = 0.2 + Math.sin(_time * 6) * 0.1;
      for (const m of this.hoverPreviewMeshes) {
        (m.material as MeshStandardMaterial).opacity = pulse;
      }
    }

    // Strategic dot highlighting — pulse dots near completable boxes
    const hints = this.getHintDots();
    const n = s.n;
    const cs = COLORS[s.ci];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const idx = r * n + c;
        const dm = this.dotMeshes[idx];
        if (!dm) continue;
        const mat = dm.material as MeshStandardMaterial;
        if (hints.has(`${r}_${c}`)) {
          // Pulse between 0.8 and 1.8 emissive intensity
          const pulse = 1.3 + Math.sin(_time * 5) * 0.5;
          mat.emissive.set(cs.p);
          mat.emissiveIntensity = pulse;
          const sc = 1.0 + Math.sin(_time * 5) * 0.15;
          dm.scale.set(sc, sc, sc);
        } else {
          mat.emissive.set(cs.dot);
          mat.emissiveIntensity = 0.8;
          dm.scale.set(1, 1, 1);
        }
      }
    }

    if (s.mode === 'speed') {
      s.timer -= delta;
      this.onTimer?.();
      if (s.timer <= 15 && s.timer > 0) this.onTimerUrgent?.(s.timer);
      if (s.timer <= 0) { s.timer = 0; this.end(); return; }
    }

    if (s.cur === 2 && s.mode !== '2player') {
      this.aiDly -= delta;
      if (this.aiDly > 0 && this.aiDly + delta >= 0.55) this.onAiThinking?.(true);
      if (this.aiDly <= 0) { this.onAiThinking?.(false); this.doAi(); }
      return;
    }

    // Hover
    const hcs = COLORS[s.ci];
    const hoverClr = (s.mode === '2player' && s.cur === 2) ? hcs.a : hcs.p;
    let anyHovered = false;
    this.queries.lines.entities.forEach(e => {
      const inf = this.infoMap.get(e.index);
      if (!inf) return;
      const arr = inf.t === 'h' ? s.hL : s.vL;
      if (arr[inf.r][inf.c]) return;
      const m = this.meshMap.get(`${inf.t}_${inf.r}_${inf.c}`);
      if (!m) return;
      if (e.hasComponent(Hovered)) {
        (m.material as MeshStandardMaterial).emissive.set(hoverClr);
        (m.material as MeshStandardMaterial).emissiveIntensity = 0.6;
        (m.material as MeshStandardMaterial).opacity = 0.65;
        // Show completion preview for hovered line
        this.showHoverPreview(inf.t, inf.r, inf.c);
        anyHovered = true;
      } else {
        const av = this.avail();
        const cl = av[this.cidx];
        const isC = cl && cl.t === inf.t && cl.r === inf.r && cl.c === inf.c;
        if (!isC) {
          (m.material as MeshStandardMaterial).emissive.set(hcs.emp);
          (m.material as MeshStandardMaterial).emissiveIntensity = 0.3;
          (m.material as MeshStandardMaterial).opacity = 0.35;
        }
      }
    });
    if (!anyHovered) this.clearHoverPreview();

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

    // Keyboard — spatial navigation
    this.kdb -= delta;
    const kb = this.input.keyboard;
    const av = this.avail();
    if (av.length && this.kdb <= 0) {
      let moved = false;
      const cur = av[this.cidx];
      if (cur && (kb.getKeyDown('ArrowRight') || kb.getKeyDown('KeyD'))) {
        this.cidx = this.findNearest(av, cur, 1, 0); moved = true;
      } else if (cur && (kb.getKeyDown('ArrowLeft') || kb.getKeyDown('KeyA'))) {
        this.cidx = this.findNearest(av, cur, -1, 0); moved = true;
      } else if (cur && (kb.getKeyDown('ArrowDown') || kb.getKeyDown('KeyS'))) {
        this.cidx = this.findNearest(av, cur, 0, 1); moved = true;
      } else if (cur && (kb.getKeyDown('ArrowUp') || kb.getKeyDown('KeyW'))) {
        this.cidx = this.findNearest(av, cur, 0, -1); moved = true;
      }
      if (moved) { this.kdb = 0.12; this.updCursor(); }

      if (kb.getKeyDown('Space') || kb.getKeyDown('Enter')) {
        const sel = av[this.cidx];
        if (sel) this.doPlayerMove(sel.t, sel.r, sel.c);
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
        const cur = av[this.cidx];
        if (cur) {
          if (stk.x > 0.5) { this.cidx = this.findNearest(av, cur, 1, 0); this.updCursor(); this.kdb = 0.15; }
          else if (stk.x < -0.5) { this.cidx = this.findNearest(av, cur, -1, 0); this.updCursor(); this.kdb = 0.15; }
          else if (stk.y < -0.5) { this.cidx = this.findNearest(av, cur, 0, 1); this.updCursor(); this.kdb = 0.15; }
          else if (stk.y > 0.5) { this.cidx = this.findNearest(av, cur, 0, -1); this.updCursor(); this.kdb = 0.15; }
        }
      }
    }

    if (s.sc[1] > s.sc[0]) this.aiWasAhead = true;
  }

  /** Find nearest available line in a direction (spatial navigation) */
  private findNearest(av: { t: LT; r: number; c: number }[], cur: { t: LT; r: number; c: number }, dx: number, dy: number): number {
    const n = this.st.n, half = (n - 1) / 2;
    // Convert current line to center position in grid space
    const cx = cur.t === 'h' ? cur.c + 0.5 : cur.c;
    const cy = cur.t === 'h' ? cur.r : cur.r + 0.5;

    let bestIdx = this.cidx;
    let bestDist = Infinity;

    for (let i = 0; i < av.length; i++) {
      if (i === this.cidx) continue;
      const a = av[i];
      const ax = a.t === 'h' ? a.c + 0.5 : a.c;
      const ay = a.t === 'h' ? a.r : a.r + 0.5;
      const ddx = ax - cx, ddy = ay - cy;

      // Only consider lines in the requested direction
      if (dx > 0 && ddx <= 0.01) continue;
      if (dx < 0 && ddx >= -0.01) continue;
      if (dy > 0 && ddy <= 0.01) continue;
      if (dy < 0 && ddy >= -0.01) continue;

      // Distance with preference for the primary axis
      const primaryDist = dx !== 0 ? Math.abs(ddx) : Math.abs(ddy);
      const crossDist = dx !== 0 ? Math.abs(ddy) : Math.abs(ddx);
      const dist = primaryDist + crossDist * 2; // penalize cross-axis movement

      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    return bestIdx;
  }
}
