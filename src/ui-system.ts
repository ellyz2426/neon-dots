import {
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  eq,
  Entity,
  InputComponent,
} from '@iwsdk/core';
import { GameSystem, ACHVS, COLORS, GRIDS, type GState } from './game-system.js';
import { AudioSystem } from './audio-system.js';
import { EffectsSystem } from './effects-system.js';

type PanelKey = 'menu' | 'hud' | 'results' | 'settings' | 'pause' | 'achpanel' | 'tutorial' | 'stats';

export class UISystem extends createSystem({
  menuP:    { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/menu.json')] },
  hudP:     { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  resultsP: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/results.json')] },
  settingsP:{ required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
  pauseP:   { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
  achP:     { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achpanel.json')] },
  tutP:     { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/tutorial.json')] },
  statsP:   { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/stats.json')] },
}) {
  private game!: GameSystem;
  private panels!: Record<PanelKey, Entity>;
  private positions!: Record<PanelKey, [number, number, number]>;
  private docs: Partial<Record<PanelKey, UIKitDocument>> = {};
  private visible: PanelKey = 'menu';
  private gridIdx = 1;
  private diffIdx = 1;
  private colorIdx = 0;
  private modeIdx = 0;
  private modes: ('classic' | 'speed' | 'zen' | 'challenge' | '2player')[] = ['classic', 'speed', 'zen', 'challenge', '2player'];
  private kdb = 0;
  private audio!: AudioSystem;
  private effects!: EffectsSystem;
  private onThemeChange?: (colorIdx: number) => void;

  // Delta-time notification timer (replaces setTimeout)
  private notifyTimer = 0;

  // Achievements pagination
  private achvPage = 0;

  // Chain combo tracking
  private chainCount = 0;
  private chainTimer = 0;

  // Elapsed time display
  private elapsedDisplayTimer = 0;

  // Timer urgency
  private lastWarningBeep = 0;

  // AI thinking pulse
  private aiThinking = false;
  private aiPulseT = 0;

  // Performance star rating
  private calcStars(winner: 'player' | 'ai' | 'draw'): number {
    const s = this.game.st;
    if (winner !== 'player') return 0;
    const ratio = s.sc[0] / Math.max(1, s.total);
    const margin = s.sc[0] - s.sc[1];
    const marginRatio = margin / Math.max(1, s.total);
    // 3 stars: >60% boxes + win by >30% margin (or shutout)
    if (s.sc[1] === 0 || (ratio > 0.6 && marginRatio > 0.3)) return 3;
    // 2 stars: >50% boxes
    if (ratio > 0.5) return 2;
    // 1 star: won
    return 1;
  }

  setRefs(r: { game: GameSystem; panels: Record<string, Entity>; positions: Record<string, [number, number, number]>; audio: AudioSystem; effects: EffectsSystem; onThemeChange?: (colorIdx: number) => void }) {
    this.game = r.game;
    this.panels = r.panels as Record<PanelKey, Entity>;
    this.positions = r.positions as Record<PanelKey, [number, number, number]>;
    this.audio = r.audio;
    this.effects = r.effects;
    this.onThemeChange = r.onThemeChange;

    // Wire game callbacks
    this.game.onScore = () => this.updHud();
    this.game.onTurn = () => { this.updHud(); this.chainCount = 0; };
    this.game.onTimer = () => this.updTimer();
    this.game.onOver = (w) => this.showResults(w);
    this.game.onAchv = (id) => this.showAchvNotify(id);
    this.game.onReady = () => { this.showPanel('hud'); this.updHud(); this.lastWarningBeep = 0; };
    this.game.onChain = (count) => this.showChainCombo(count);
    this.game.onTimerUrgent = (secsLeft) => this.handleTimerUrgency(secsLeft);
    this.game.onAiThinking = (thinking) => { this.aiThinking = thinking; };
  }

  init() {
    const wirePanel = (qName: string, key: PanelKey, cb: (doc: UIKitDocument, ent: Entity) => void) => {
      (this.queries as any)[qName].subscribe('qualify', (entity: Entity) => {
        const doc = entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
        if (!doc) return;
        this.docs[key] = doc;
        cb(doc, entity);
      });
    };

    wirePanel('menuP', 'menu', (doc) => {
      this.btn(doc, 'btn-play', () => this.startGame());
      this.btn(doc, 'btn-settings', () => this.showPanel('settings'));
      this.btn(doc, 'btn-tutorial', () => this.showPanel('tutorial'));
      this.btn(doc, 'btn-achievements', () => { this.achvPage = 0; this.updAchvPanel(); this.showPanel('achpanel'); });
      this.btn(doc, 'btn-stats', () => { this.updStatsPanel(); this.showPanel('stats'); });
    });

    wirePanel('hudP', 'hud', (_doc) => {});

    wirePanel('resultsP', 'results', (doc) => {
      this.btn(doc, 'btn-replay', () => this.startGame());
      this.btn(doc, 'btn-menu', () => this.showPanel('menu'));
    });

    wirePanel('settingsP', 'settings', (doc) => {
      this.btn(doc, 'btn-grid-prev', () => { this.gridIdx = (this.gridIdx - 1 + GRIDS.length) % GRIDS.length; this.updSettings(); });
      this.btn(doc, 'btn-grid-next', () => { this.gridIdx = (this.gridIdx + 1) % GRIDS.length; this.updSettings(); });
      this.btn(doc, 'btn-diff-prev', () => { this.diffIdx = (this.diffIdx - 1 + 3) % 3; this.updSettings(); });
      this.btn(doc, 'btn-diff-next', () => { this.diffIdx = (this.diffIdx + 1) % 3; this.updSettings(); });
      this.btn(doc, 'btn-mode-prev', () => { this.modeIdx = (this.modeIdx - 1 + 5) % 5; this.updSettings(); });
      this.btn(doc, 'btn-mode-next', () => { this.modeIdx = (this.modeIdx + 1) % 5; this.updSettings(); });
      this.btn(doc, 'btn-color-prev', () => { this.colorIdx = (this.colorIdx - 1 + COLORS.length) % COLORS.length; this.updSettings(); });
      this.btn(doc, 'btn-color-next', () => { this.colorIdx = (this.colorIdx + 1) % COLORS.length; this.updSettings(); });
      this.btn(doc, 'btn-sound-toggle', () => { this.audio.toggleMute(); this.updSettings(); });
      this.btn(doc, 'btn-back', () => this.showPanel('menu'));
      this.updSettings();
    });

    wirePanel('pauseP', 'pause', (doc) => {
      this.btn(doc, 'btn-resume', () => { this.game.st.on = true; this.showPanel('hud'); });
      this.btn(doc, 'btn-restart', () => this.startGame());
      this.btn(doc, 'btn-quit', () => { this.game.st.on = false; this.game.st.over = true; this.showPanel('menu'); });
    });

    wirePanel('achP', 'achpanel', (doc) => {
      this.btn(doc, 'btn-back', () => this.showPanel('menu'));
      this.btn(doc, 'btn-achv-prev', () => { this.achvPage = Math.max(0, this.achvPage - 1); this.updAchvPanel(); });
      this.btn(doc, 'btn-achv-next', () => { this.achvPage = Math.min(1, this.achvPage + 1); this.updAchvPanel(); });
    });

    wirePanel('tutP', 'tutorial', (doc) => {
      this.btn(doc, 'btn-back', () => this.showPanel('menu'));
    });

    wirePanel('statsP', 'stats', (doc) => {
      this.btn(doc, 'btn-back', () => this.showPanel('menu'));
    });
  }

  private btn(doc: UIKitDocument, id: string, cb: () => void) {
    const el = doc.getElementById(id) as UIKit.Text | undefined;
    el?.addEventListener('click', cb);
  }

  private txt(key: PanelKey, id: string, text: string) {
    const el = this.docs[key]?.getElementById(id) as UIKit.Text | undefined;
    el?.setProperties({ text });
  }

  showPanel(key: PanelKey) {
    this.visible = key;
    const keys: PanelKey[] = ['menu', 'hud', 'results', 'settings', 'pause', 'achpanel', 'tutorial', 'stats'];
    for (const k of keys) {
      const ent = this.panels[k];
      if (!ent?.object3D) continue;
      const pos = this.positions[k];
      if (k === key) {
        ent.object3D.position.set(pos[0], pos[1], pos[2]);
      } else {
        ent.object3D.position.set(0, -50, 0);
      }
    }
  }

  private startGame() {
    const g = GRIDS[this.gridIdx];
    const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    this.chainCount = 0;
    this.chainTimer = 0;
    this.notifyTimer = 0;
    this.onThemeChange?.(this.colorIdx);
    this.game.start(g.n, this.modes[this.modeIdx], diffs[this.diffIdx], this.colorIdx);
  }

  private updHud() {
    const s = this.game.st;
    const is2p = s.mode === '2player';
    this.txt('hud', 'txt-p1-score', `${is2p ? 'P1' : 'You'}: ${s.sc[0]}`);
    this.txt('hud', 'txt-p2-score', `${is2p ? 'P2' : 'AI'}: ${s.sc[1]}`);
    this.txt('hud', 'txt-turn', is2p
      ? (s.cur === 1 ? "P1's Turn" : "P2's Turn")
      : (s.cur === 1 ? 'Your Turn' : 'AI Thinking...'));
    this.txt('hud', 'txt-boxes', `${s.sc[0] + s.sc[1]}/${s.total}`);
    if (s.mode === 'speed') {
      this.txt('hud', 'txt-timer', `${Math.ceil(s.timer)}s`);
    } else {
      this.txt('hud', 'txt-timer', `Moves: ${s.moves}`);
    }
    // Mode and difficulty indicator
    const modeNames: Record<string, string> = { classic: 'Classic', speed: 'Speed', zen: 'Zen', challenge: 'Challenge', '2player': '2 Player' };
    const diffCaps: Record<string, string> = { easy: 'Easy', medium: 'Med', hard: 'Hard' };
    this.txt('hud', 'txt-mode-info', is2p ? '2 Player' : `${modeNames[s.mode]} · ${diffCaps[s.diff]}`);
    // Undo hint for Zen mode
    this.txt('hud', 'txt-undo', this.game.canUndo() ? '[Z] Undo' : '');
  }

  private updTimer() {
    const s = this.game.st;
    if (s.mode === 'speed') {
      this.txt('hud', 'txt-timer', `${Math.ceil(s.timer)}s`);
    }
  }

  private showResults(winner: 'player' | 'ai' | 'draw') {
    const s = this.game.st;
    const is2p = s.mode === '2player';
    const titles: Record<string, string> = is2p
      ? { player: 'Player 1 Wins!', ai: 'Player 2 Wins!', draw: 'Draw!' }
      : { player: 'You Win!', ai: 'AI Wins!', draw: 'Draw!' };
    this.txt('results', 'txt-title', titles[winner]);
    this.txt('results', 'txt-score', `${s.sc[0]} - ${s.sc[1]}`);

    // Star rating
    const stars = this.calcStars(winner);
    const starStr = stars > 0 ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '';
    this.txt('results', 'txt-stars', starStr);

    // Stats row: moves, time, chains, efficiency
    this.txt('results', 'txt-moves-val', `${s.moves}`);

    const em = Math.floor(s.elapsed / 60);
    const es = Math.floor(s.elapsed % 60);
    this.txt('results', 'txt-time-val', `${em}:${es.toString().padStart(2, '0')}`);

    this.txt('results', 'txt-chains-val', `${this.game.totalChains}`);

    // Efficiency: boxes per move (higher = better)
    const eff = s.moves > 0 ? (s.sc[0] / s.moves * 100).toFixed(0) : '0';
    this.txt('results', 'txt-efficiency-val', `${eff}%`);

    // Record line
    const streakTxt = !is2p && this.game.stats.streak > 1 ? ` | Streak: ${this.game.stats.streak}` : '';
    this.txt('results', 'txt-record',
      `Record: ${this.game.stats.won}W / ${this.game.stats.played - this.game.stats.won}L${streakTxt}`);

    // Celebration or defeat effects
    if (winner === 'player') {
      this.effects.celebrate(s.ci);
      this.audio.sfx('win');
    } else if (winner === 'ai') {
      this.effects.defeatDust(s.ci);
      this.audio.sfx('lose');
    } else {
      this.audio.sfx('lose');
    }

    this.showPanel('results');
  }

  private updSettings() {
    const g = GRIDS[this.gridIdx];
    const diffs = ['Easy', 'Medium', 'Hard'];
    const modeNames = ['Classic', 'Speed (90s)', 'Zen', 'Challenge', '2 Player'];
    this.txt('settings', 'txt-grid', g.lbl);
    this.txt('settings', 'txt-diff', diffs[this.diffIdx]);
    this.txt('settings', 'txt-mode', modeNames[this.modeIdx]);
    this.txt('settings', 'txt-color', COLORS[this.colorIdx].nm);
    this.txt('settings', 'txt-sound', this.audio.isMuted() ? 'OFF' : 'ON');
  }

  private updAchvPanel() {
    const stats = this.game.stats;
    this.txt('achpanel', 'txt-count', `${stats.achvs.length}/${ACHVS.length}`);
    this.txt('achpanel', 'txt-achv-page', `Page ${this.achvPage + 1}/2`);

    const offset = this.achvPage * 10;
    for (let i = 0; i < 10; i++) {
      const idx = offset + i;
      const a = ACHVS[idx];
      if (!a) {
        this.txt('achpanel', `txt-a${i}-name`, '');
        this.txt('achpanel', `txt-a${i}-desc`, '');
        continue;
      }
      const unlocked = stats.achvs.includes(a.id);
      this.txt('achpanel', `txt-a${i}-name`, unlocked ? a.nm : '???');
      this.txt('achpanel', `txt-a${i}-desc`, unlocked ? a.ds : 'Locked');
    }
  }

  private updStatsPanel() {
    const stats = this.game.stats;
    const wr = stats.played > 0 ? Math.round((stats.won / stats.played) * 100) : 0;
    this.txt('stats', 'txt-played', `${stats.played}`);
    this.txt('stats', 'txt-won', `${stats.won}`);
    this.txt('stats', 'txt-winrate', `${wr}%`);
    this.txt('stats', 'txt-boxes', `${stats.boxes}`);
    this.txt('stats', 'txt-chain', `${stats.maxChain}`);
    this.txt('stats', 'txt-streak', `${stats.streak || 0}`);
    this.txt('stats', 'txt-best-streak', `${stats.bestStreak || 0}`);
    this.txt('stats', 'txt-w-2x2', `${stats.wGrid['3'] || 0}`);
    this.txt('stats', 'txt-w-3x3', `${stats.wGrid['4'] || 0}`);
    this.txt('stats', 'txt-w-4x4', `${stats.wGrid['5'] || 0}`);
    this.txt('stats', 'txt-w-easy', `${stats.wDiff['easy'] || 0}`);
    this.txt('stats', 'txt-w-med', `${stats.wDiff['medium'] || 0}`);
    this.txt('stats', 'txt-w-hard', `${stats.wDiff['hard'] || 0}`);
    this.txt('stats', 'txt-achvs', `${stats.achvs.length}/${ACHVS.length}`);
  }

  private showAchvNotify(id: string) {
    const a = ACHVS.find(x => x.id === id);
    if (a) {
      this.txt('hud', 'txt-notify', `Achievement: ${a.nm}!`);
      this.notifyTimer = 3.0; // Clear after 3 seconds via delta-time
    }
  }

  private showChainCombo(count: number) {
    this.chainCount = count;
    if (count >= 2) {
      this.txt('hud', 'txt-notify', `Chain x${count}!`);
      this.chainTimer = 2.0;
    }
  }

  private handleTimerUrgency(secsLeft: number) {
    // Color change on HUD timer text
    if (secsLeft <= 5) {
      this.txt('hud', 'txt-timer', `⚠ ${Math.ceil(secsLeft)}s`);
    } else if (secsLeft <= 10) {
      this.txt('hud', 'txt-timer', `${Math.ceil(secsLeft)}s`);
    }
    // Warning beep at 10s, 5s, 3s, 2s, 1s
    const thresholds = [10, 5, 3, 2, 1];
    for (const t of thresholds) {
      if (secsLeft <= t && this.lastWarningBeep > t) {
        this.audio.sfx('turn');
        this.lastWarningBeep = secsLeft;
        break;
      }
    }
    if (this.lastWarningBeep === 0 || secsLeft > this.lastWarningBeep) {
      this.lastWarningBeep = secsLeft;
    }
  }

  update(delta: number, _time: number) {
    this.kdb -= delta;

    // Delta-time notification clearing (replaces setTimeout)
    if (this.notifyTimer > 0) {
      this.notifyTimer -= delta;
      if (this.notifyTimer <= 0) {
        this.notifyTimer = 0;
        // Only clear if chain timer isn't also active
        if (this.chainTimer <= 0) {
          this.txt('hud', 'txt-notify', '');
        }
      }
    }

    if (this.chainTimer > 0) {
      this.chainTimer -= delta;
      if (this.chainTimer <= 0) {
        this.chainTimer = 0;
        if (this.notifyTimer <= 0) {
          this.txt('hud', 'txt-notify', '');
        }
      }
    }

    // Elapsed time display (update every second)
    if (this.game.st.on && !this.game.st.over) {
      this.elapsedDisplayTimer -= delta;
      if (this.elapsedDisplayTimer <= 0) {
        this.elapsedDisplayTimer = 1.0;
        const el = this.game.st.elapsed;
        const m = Math.floor(el / 60);
        const s = Math.floor(el % 60);
        this.txt('hud', 'txt-elapsed', `${m}:${s.toString().padStart(2, '0')}`);
      }
    }

    // Pause with Escape or B button
    const kb = this.input.keyboard;
    if (kb.getKeyDown('Escape') && this.game.st.on && !this.game.st.over) {
      this.game.st.on = false;
      this.showPanel('pause');
    }

    // Undo with Z key (Zen mode only)
    if (kb.getKeyDown('KeyZ') && this.game.canUndo()) {
      this.game.undo();
      this.audio.sfx('undo');
      this.updHud();
    }

    const rp = this.input.xr?.gamepads?.right;
    if (rp?.getButtonDown(InputComponent.B_Button) && this.game.st.on && !this.game.st.over) {
      this.game.st.on = false;
      this.showPanel('pause');
    }

    // XR undo with Y button on left controller
    const lp = this.input.xr?.gamepads?.left;
    if (lp?.getButtonDown(InputComponent.Y_Button) && this.game.canUndo()) {
      this.game.undo();
      this.audio.sfx('undo');
      this.updHud();
    }
  }
}
