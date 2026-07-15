/** @typedef {{ dx: number, dy: number, durationTicks: number }} MotionFrame */

export const GAME_TITLE = 'Grok Prince';

export const LOGICAL_W = 320;
export const LOGICAL_H = 200;
export const HUD_H = 16;
export const PLAYFIELD_H = 184; // LOGICAL_H - HUD_H
export const TILE = 32;
export const ROOM_W_TILES = 10;
export const ROOM_H_TILES = 6;

export const FIXED_DT = 1 / 60;
export const MAX_STEPS = 8;

export const RUN_SPEED = 1.6;
export const GRAVITY = 0.25;
export const MAX_FALL_VY = 6;
export const CAREFUL_STEP_PX = 32;
export const CAREFUL_STEP_TICKS = 20;

export const FALL_DMG_SOFT = 2 * TILE;   // soft land
export const FALL_DMG_HARD = 3 * TILE;   // 1 pip
export const FALL_LETHAL = 4.5 * TILE;

export const PLAYER_W = 18;
export const PLAYER_H = 40;
export const PLAYER_HURT_INSET = { x: 3, y: 4, w: 12, h: 34 };

/** Jump-up: mostly vertical (~1 tile) */
export const JUMP_UP_FRAMES = [
  { dx: 0, dy: -3.6, durationTicks: 5 },
  { dx: 0, dy: -3.0, durationTicks: 5 },
  { dx: 0, dy: -2.0, durationTicks: 4 },
  { dx: 0, dy: -0.6, durationTicks: 3 },
  { dx: 0, dy: 0.6, durationTicks: 3 },
];

/** Jump-forward: clears a 2-tile (64px) gap with margin */
export const JUMP_FORWARD_FRAMES = [
  { dx: 4.5, dy: -3.5, durationTicks: 4 },
  { dx: 4.6, dy: -2.8, durationTicks: 4 },
  { dx: 4.4, dy: -1.5, durationTicks: 4 },
  { dx: 4.0, dy: -0.2, durationTicks: 4 },
  { dx: 3.2, dy: 1.0, durationTicks: 3 },
  { dx: 2.4, dy: 1.8, durationTicks: 3 },
  { dx: 1.6, dy: 2.2, durationTicks: 3 },
];

export const CLIMB_FRAMES = [
  { dx: 0, dy: -4, durationTicks: 4 },
  { dx: 0, dy: -4, durationTicks: 4 },
  { dx: 0, dy: -4, durationTicks: 4 },
  { dx: 2, dy: -2, durationTicks: 4 },
  { dx: 2, dy: 0, durationTicks: 3 },
];

export const Combat = {
  ENGAGE_RANGE_PX: 100,
  STRIKE_RANGE_PX: 48,
  PREFERRED_AI_RANGE_PX: 34,
  FLOOR_BAND_PX: 16,
  STRIKE_WINDUP: 8,
  STRIKE_ACTIVE: 8,
  STRIKE_RECOVERY: 12,
  PARRY_ACTIVE: 10,
  // Must stay near run speed — large values made combat walk feel 2–6× faster after drawing sword
  ADVANCE_STEP_PX: 1.6,
  RETREAT_STEP_PX: 1.6,
  HIT_KNOCKBACK_PX: 8,
  BLOCK_PUSH_PX: 4,
  SHEATHE_TICKS: 18,
  HURT_TICKS: 14,
};

export const LOOSE_SHAKE_TICKS = 20;
export const CHOMPER_OPEN = 40;
export const CHOMPER_CLOSED = 20;

export const START_TIME_SEC = 420; // 7 minutes
export const START_HEALTH = 3;
export const MAX_HEALTH_CAP = 10;

export const COLORS = {
  bg: '#1a1410',
  wall: '#5a4530',
  wallHi: '#7a6244',
  wallLo: '#3a2c1c',
  floor: '#4a3828',
  floorHi: '#6a5040',
  floorLo: '#2e2218',
  sky: '#12161e',
  skyDeep: '#0a0c12',
  skySilhouette: '#0e1218',
  grit: 'rgba(255,220,160,0.04)',
  hudBg: '#0c0a08',
  hudText: '#e8d4a8',
  hudDim: '#7a6a50',
  player: '#c4a06a',
  playerFlash: '#fff0d0',
  playerSash: '#8b1e1e',
  playerHair: '#2a1810',
  playerBoot: '#3a2818',
  playerSword: '#d8d4c8',
  enemy: '#7a3030',
  enemySash: '#2a1010',
  enemyHelm: '#3a2020',
  enemyBoot: '#2a1515',
  skin: '#e0c8a0',
  sword: '#c8d0d8',
  swordTip: '#f0f4f8',
  parryGlow: '#80c0ff',
  gate: '#4a3a28',
  gateBar: '#2a2010',
  gateOpen: '#3a3020',
  plate: '#8a7040',
  plateHi: '#c0a060',
  plateOn: '#d0b050',
  plateOnHi: '#f0e080',
  spikes: '#a8a8b0',
  spikesHi: '#d0d0d8',
  loose: '#6a5038',
  looseShake: '#9a7048',
  looseCrack: '#2a1810',
  dust: '#c0a080',
  chomper: '#5a2828',
  chomperDark: '#301010',
  chomperTooth: '#c8c0b0',
  chomperWarn: '#a04030',
  potionLife: '#38a060',
  potionPoison: '#7040a0',
  potionGlass: 'rgba(255,255,255,0.35)',
  exit: '#c9a227',
  blood: '#b01818',
  debug: '#00ff88',
};
