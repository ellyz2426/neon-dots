import {
  World,
  PanelUI,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Color,
  Group,
  AmbientLight,
  PointLight,
  Entity,
  Vector3,
} from '@iwsdk/core';
import { GameSystem } from './game-system.js';
import { UISystem } from './ui-system.js';
import { AudioSystem } from './audio-system.js';
import { EffectsSystem } from './effects-system.js';

const container = document.getElementById('scene-container') as HTMLDivElement;

const world = await World.create(container, {
  xr: { offer: 'once' },
  render: {
    camera: { position: [0, 1.6, 0], lookAt: [0, 1.4, -2] },
  },
  features: {
    locomotion: { browserControls: true },
    grabbing: false,
    physics: false,
  },
});

// === Holodeck Environment ===
const scene = world.scene;

scene.add(new AmbientLight(new Color('#334455'), 0.4));
const l1 = new PointLight(new Color('#00ffff'), 1.5, 30); l1.position.set(0, 4, 0); scene.add(l1);
const l2 = new PointLight(new Color('#8844ff'), 0.8, 20); l2.position.set(-3, 3, -2); scene.add(l2);
const l3 = new PointLight(new Color('#ff4488'), 0.6, 20); l3.position.set(3, 3, 2); scene.add(l3);

// Grid floor
const floorW = new Mesh(new BoxGeometry(20, 0.01, 20, 40, 1, 40),
  new MeshStandardMaterial({ color: new Color('#000811'), emissive: new Color('#001122'), emissiveIntensity: 0.3, wireframe: true, transparent: true, opacity: 0.5 }));
scene.add(floorW);
const floorS = new Mesh(new BoxGeometry(20, 0.02, 20),
  new MeshStandardMaterial({ color: new Color('#000508'), emissive: new Color('#000205'), emissiveIntensity: 0.1 }));
floorS.position.y = -0.01; scene.add(floorS);

// Ceiling
const ceil = new Mesh(new BoxGeometry(20, 0.01, 20, 40, 1, 40),
  new MeshStandardMaterial({ color: new Color('#000811'), emissive: new Color('#001122'), emissiveIntensity: 0.2, wireframe: true, transparent: true, opacity: 0.3 }));
ceil.position.y = 5; scene.add(ceil);

// Walls
for (let i = 0; i < 4; i++) {
  const wall = new Mesh(new BoxGeometry(20, 5, 0.01, 40, 10, 1),
    new MeshStandardMaterial({ color: new Color('#000811'), emissive: new Color('#001133'), emissiveIntensity: 0.15, wireframe: true, transparent: true, opacity: 0.25 }));
  wall.position.y = 2.5;
  if (i === 0) wall.position.z = -10;
  else if (i === 1) wall.position.z = 10;
  else if (i === 2) { wall.rotation.y = Math.PI / 2; wall.position.x = -10; }
  else { wall.rotation.y = Math.PI / 2; wall.position.x = 10; }
  scene.add(wall);
}

// Pillars
for (let i = 0; i < 4; i++) {
  const p = new Mesh(new CylinderGeometry(0.05, 0.05, 5, 8),
    new MeshStandardMaterial({ color: new Color('#00ffff'), emissive: new Color('#00ffff'), emissiveIntensity: 0.8, transparent: true, opacity: 0.6 }));
  p.position.y = 2.5;
  const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
  p.position.x = Math.cos(a) * 7; p.position.z = Math.sin(a) * 7;
  scene.add(p);
}

// Orbs
for (let i = 0; i < 6; i++) {
  const o = new Mesh(new SphereGeometry(0.08, 16, 16),
    new MeshStandardMaterial({ color: new Color('#00ffff'), emissive: new Color('#00ffff'), emissiveIntensity: 1.2, transparent: true, opacity: 0.5 }));
  o.position.set((Math.random() - 0.5) * 10, 1 + Math.random() * 3, (Math.random() - 0.5) * 10);
  scene.add(o);
}

// === Panel Entities ===
const pY = 1.4, pZ = -2.0;
const panelDefs: { key: string; config: string; pos: [number, number, number]; show: boolean }[] = [
  { key: 'menu',     config: './ui/menu.json',     pos: [0, pY, pZ],       show: true },
  { key: 'hud',      config: './ui/hud.json',      pos: [0, 2.1, -1.8],    show: false },
  { key: 'results',  config: './ui/results.json',  pos: [0, pY, pZ],       show: false },
  { key: 'settings', config: './ui/settings.json', pos: [0, pY, pZ],       show: false },
  { key: 'pause',    config: './ui/pause.json',    pos: [0, pY, pZ],       show: false },
  { key: 'achpanel', config: './ui/achpanel.json', pos: [0, pY, pZ],       show: false },
  { key: 'tutorial', config: './ui/tutorial.json', pos: [0, pY, pZ],       show: false },
  { key: 'stats',    config: './ui/stats.json',    pos: [0, pY, pZ],       show: false },
];

const panelEntities: Record<string, Entity> = {};
const panelPositions: Record<string, [number, number, number]> = {};

for (const pd of panelDefs) {
  const grp = new Group();
  grp.position.set(pd.pos[0], pd.show ? pd.pos[1] : -50, pd.pos[2]);
  grp.scale.set(1.4, 1.4, 1.4);
  const entity = world.createTransformEntity(grp);
  entity.addComponent(PanelUI, { config: pd.config });
  panelEntities[pd.key] = entity;
  panelPositions[pd.key] = pd.pos;
}

// === Register Systems ===
world.registerSystem(GameSystem);
world.registerSystem(UISystem);
world.registerSystem(AudioSystem);
world.registerSystem(EffectsSystem);

const gameSystem = world.getSystem(GameSystem)!;
const uiSystem = world.getSystem(UISystem)!;
const audioSystem = world.getSystem(AudioSystem)!;
const effectsSystem = world.getSystem(EffectsSystem)!;

uiSystem.setRefs({ game: gameSystem, panels: panelEntities, positions: panelPositions });

// Wire audio into game callbacks
const origOnScore = gameSystem.onScore;
gameSystem.onScore = () => { origOnScore?.(); audioSystem.sfx('place'); };

// Wire effects into game callbacks
gameSystem.onBoxComplete = (row: number, col: number) => {
  const pos = gameSystem.getBoxWorldPos(row, col);
  if (pos) {
    effectsSystem.burst(new Vector3(pos.x, pos.y, pos.z), gameSystem.st.ci, 14);
    audioSystem.sfx('box');
  }
};

gameSystem.onLinePlaced = (_t, row, col) => {
  const pos = gameSystem.getLineWorldPos(_t, row, col);
  if (pos) {
    effectsSystem.lineBurst(new Vector3(pos.x, pos.y, pos.z), gameSystem.st.ci);
  }
};
