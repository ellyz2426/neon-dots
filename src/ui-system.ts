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
  private modes: ('classic' | 'speed' | 'zen' | 'challenge')[] = ['classic', 'speed', 'zen', 'challenge'];
  private kdb = 0;

  // Delta-time notification timer (replaces setTimeout)
  private notifyTimer = 0;

  // Achievements pagination
  private achvPage = 0;

  // Chain combo tracking
  private chainCount = 0;
  private chainTimer = 0;

  setRefs(r: { game: GameSystem; panels: Record<string, Entity>; positions: Record<string, [number, number, number]> }) {
    this.game = r.game;
    this.panels = r.panels as Record<PanelKey, Entity>;
    this.positions = r.positions as Record<PanelKey, [number, number, number]>;

    // Wire game callbacks
    this.game.onScore = () => this.updHud();
    this.game.onTurn = () => { this.updHud(); this.chainCount = 0; };
    this.game.onTimer = () => this.updTimer();
    this.game.onOver = (w) => this.showResults(w);
    this.game.onAchv = (id) => this.showAchvNotify(id);
    this.game.onReady = () => { this.showPanel('hud'); this.updHud(); };
    this.game.onChain = (count) => this.showChainCombo(count);
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
      this.btn(doc, 'btn-mode-prev', () => { this.modeIdx = (this.modeIdx - 1 + 4) % 4; this.updSettings(); });
      this.btn(doc, 'btn-mode-next', () => { this.modeIdx = (this.modeIdx + 1) % 4; this.updSettings(); });
      this.btn(doc, 'btn-color-prev', () => { this.colorIdx = (this.colorIdx - 1 + COLORS.length) % COLORS.length; this.updSettings(); });
      this.btn(doc, 'btn-color-next', () => { this.colorIdx = (this.colorIdx + 1) % COLORS.length; this.updSettings(); });
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
    this.game.start(g.n, this.modes[this.modeIdx], diffs[this.diffIdx], this.colorIdx);
  }

  private updHud() {
    const s = this.game.st;
    this.txt('hud', 'txt-p1-score', `You: ${s.sc[0]}`);
    this.txt('hud', 'txt-p2-score', `AI: ${s.sc[1]}`);
    this.txt('hud', 'txt-turn', s.cur === 1 ? 'Your Turn' : 'AI Thinking...');
    this.txt('hud', 'txt-boxes', `${s.sc[0] + s.sc[1]}/${s.total}`);
    if (s.mode === 'speed') {
      this.txt('hud', 'txt-timer', `${Math.ceil(s.timer)}s`);
    } else {
      this.txt('hud', 'txt-timer', `Moves: ${s.moves}`);
    }
  }

  private updTimer() {
    const s = this.game.st;
    if (s.mode === 'speed') {
      this.txt('hud', 'txt-timer', `${Math.ceil(s.timer)}s`);
    }
  }

  private showResults(winner: 'player' | 'ai' | 'draw') {
    const s = this.game.st;
    const titles: Record<string, string> = { player: 'You Win!', ai: 'AI Wins!', draw: 'Draw!' };
    this.txt('results', 'txt-title', titles[winner]);
    this.txt('results', 'txt-score', `${s.sc[0]} - ${s.sc[1]}`);
    this.txt('results', 'txt-moves', `Moves: ${s.moves}`);
    const stats = this.game.stats;
    this.txt('results', 'txt-record', `Record: ${stats.won}W / ${stats.played - stats.won}L`);
    this.showPanel('results');
  }

  private updSettings() {
    const g = GRIDS[this.gridIdx];
    const diffs = ['Easy', 'Medium', 'Hard'];
    const modeNames = ['Classic', 'Speed (90s)', 'Zen', 'Challenge'];
    this.txt('settings', 'txt-grid', g.lbl);
    this.txt('settings', 'txt-diff', diffs[this.diffIdx]);
    this.txt('settings', 'txt-mode', modeNames[this.modeIdx]);
    this.txt('settings', 'txt-color', COLORS[this.colorIdx].nm);
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

    // Pause with Escape or B button
    const kb = this.input.keyboard;
    if (kb.getKeyDown('Escape') && this.game.st.on && !this.game.st.over) {
      this.game.st.on = false;
      this.showPanel('pause');
    }

    const rp = this.input.xr?.gamepads?.right;
    if (rp?.getButtonDown(InputComponent.B_Button) && this.game.st.on && !this.game.st.over) {
      this.game.st.on = false;
      this.showPanel('pause');
    }
  }
}
