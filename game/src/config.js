// NOVA DRIFT — tuning and constants. One place for every number the game
// balances on, so the feel can be tuned without touching the logic.
export const STEP = 1 / 60;

export const FIELD = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 14,
  speed: 330,
  accel: 2600,
  drag: 6.5,
  maxHull: 100,
  fireInterval: 0.16,
  bulletSpeed: 660,
  bulletDamage: 12,
  bulletRadius: 5,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 2.4,
  dashInvuln: 0.24,
  pickupRadius: 46,
  novaNeed: 100,
  novaDamage: 160,
  novaRadius: 9999,
};

export const COMBO = {
  window: 3.0,
  perKill: 1,
  // Multiplier grows 0.1 per combo point, capped at x5.
  step: 0.1,
  cap: 5,
};

export const ENEMY = {
  mote:    { radius: 12, hp: 10,  speed: 95,  contact: 8,  score: 50,  ember: 1, color: '#ff4d9d' },
  darter:  { radius: 11, hp: 14,  speed: 150, contact: 12, score: 80,  ember: 1, color: '#ff9a3d' },
  spitter: { radius: 14, hp: 24,  speed: 72,  contact: 10, score: 120, ember: 2, color: '#b46bff' },
  brute:   { radius: 27, hp: 95,  speed: 46,  contact: 20, score: 250, ember: 3, color: '#ff3b4e' },
};

export const BOSS = {
  radius: 64,
  hpBase: 850,
  hpPerBoss: 260,
  speed: 52,
  contact: 26,
  score: 5000,
  ember: 12,
  color: '#ff2d55',
  coreColor: '#ffd166',
};

export const WAVES = {
  finalWave: 15,
  bossEvery: 5,
  // How many enemies may be alive at once; grows slowly with the wave.
  aliveCapBase: 7,
  aliveCapPerWave: 0.9,
  spawnIntervalBase: 1.15,
  spawnIntervalMin: 0.34,
  hpScalePerWave: 0.09,
  speedScalePerWave: 0.022,
};

export const PICKUP = {
  emberScore: 10,
  emberNova: 6,
  heartHeal: 30,
  shieldAmount: 35,
  life: 11,
  radius: 9,
};

export const COLORS = {
  bg0: '#04050e',
  bg1: '#0a1030',
  player: '#4df3ff',
  playerCore: '#eaffff',
  bullet: '#aefcff',
  enemyBullet: '#ff5c8a',
  ember: '#ffd166',
  heart: '#ff6b81',
  shield: '#7dd7ff',
  nova: '#b8fff4',
  text: '#d8f4ff',
  dim: '#7fa3c7',
  panel: 'rgba(8, 16, 40, 0.82)',
  panelEdge: 'rgba(120, 200, 255, 0.35)',
  danger: '#ff4d6a',
  gold: '#ffd166',
};

export const SCREENS = {
  title: 'title',
  play: 'play',
  upgrade: 'upgrade',
  pause: 'pause',
  over: 'over',
  victory: 'victory',
};

// Event flags returned by stepWorld (bitmask).
export const EVENT_NONE = 0;
export const EVENT_WAVE_CLEAR = 1;
export const EVENT_BOSS = 2;
export const EVENT_OVER = 4;
export const EVENT_VICTORY = 8;
export const EVENT_HURT = 16;
export const EVENT_NOVA = 32;
