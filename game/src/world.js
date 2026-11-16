// NOVA DRIFT — the world: everything that moves, collides and scores.
// Pure logic: no DOM, no canvas, no audio here. Sounds go out through the
// optional sfx object (shoot, hit, explode, pickup, hurt, nova, ...), so a
// headless test can drive the whole game with a recording stub.

import {
  BOSS, COLORS, COMBO, ENEMY, EVENT_BOSS, EVENT_HURT, EVENT_NONE, EVENT_NOVA,
  EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR, FIELD, PICKUP, PLAYER, WAVES,
} from './config.js';
import { angleTo, clamp, dist, makeRng, range } from './random.js';
import { rollUpgrades } from './upgrades.js';
import {
  aliveCap, bossHp, bossIndex, bossName, hpScale, isBossWave, spawnInterval,
  spawnPoint, speedScale, wavePlan,
} from './waves.js';

const TAU = Math.PI * 2;

function makePlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hull: PLAYER.maxHull,
    maxHull: PLAYER.maxHull,
    shield: 0,
    speed: PLAYER.speed,
    fireInterval: PLAYER.fireInterval,
    fireCd: 0,
    bulletSpeed: PLAYER.bulletSpeed,
    bulletDamage: PLAYER.bulletDamage,
    projectiles: 1,
    pierce: 0,
    dashCd: 0,
    dashCdMax: PLAYER.dashCooldown,
    dashTime: 0,
    invuln: 0,
    nova: 0,
    novaRate: 1,
    pickupRadius: PLAYER.pickupRadius,
    alive: true,
    thrust: 0,
  };
}

/** A fresh world for a seeded run. */
export function createWorld(seed) {
  const rng = makeRng(seed >>> 0 || 1);
  const state = {
    seed: seed >>> 0 || 1,
    rng,
    time: 0,
    wave: 0,
    score: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    kills: 0,
    player: makePlayer(),
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    pickups: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    bossPending: -1,
    boss: null,
    bossWarned: false,
    waveState: 'fighting',
    pendingUpgrades: null,
    shake: 0,
    flash: 0,
    novaFx: 0,
    stats: { shots: 0, hits: 0, kills: 0, damageTaken: 0, wavesCleared: 0, novas: 0 },
    over: false,
    victory: false,
    banner: '',
    bannerTimer: 0,
  };
  return state;
}

/** Start a new run in an existing world (keeps the best score). */
export function resetWorld(state) {
  const best = state.best;
  const fresh = createWorld(state.seed);
  fresh.best = best;
  Object.keys(fresh).forEach((k) => { state[k] = fresh[k]; });
  startWave(state, 1);
}

/** Begin a wave: build its spawn plan, arm the boss if it has one. */
export function startWave(state, wave) {
  state.wave = wave;
  state.waveState = 'fighting';
  state.spawnQueue = [];
  const plan = wavePlan(wave, state.rng);
  for (const entry of plan) {
    for (let i = 0; i < entry.count; i += 1) state.spawnQueue.push(entry.type);
  }
  state.spawnTimer = 0.6;
  state.bossPending = isBossWave(wave) ? 2.2 : -1;
  state.bossWarned = false;
  state.banner = isBossWave(wave) ? bossName(bossIndex(wave)) : `WAVE ${wave}`;
  state.bannerTimer = 2.2;
}

export function comboMultiplier(state) {
  return Math.min(COMBO.cap, 1 + Math.min(state.combo, 40) * COMBO.step);
}

export function aliveEnemyCount(state) {
  return state.enemies.length;
}

function addText(state, x, y, text, color, size) {
  state.texts.push({ x, y, text, color: color || COLORS.text, size: size || 15, life: 0.9, maxLife: 0.9 });
}

function burst(state, x, y, color, count, speed, size) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * TAU;
    const s = range(state.rng, speed * 0.3, speed);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: range(state.rng, 0.3, 0.7),
      maxLife: 0.7,
      size: range(state.rng, size * 0.6, size * 1.4),
      color,
    });
  }
}

function dropPickups(state, enemy) {
  const n = enemy.ember || 0;
  for (let i = 0; i < n; i += 1) {
    const a = state.rng() * TAU;
    state.pickups.push({
      kind: 'ember',
      x: enemy.x,
      y: enemy.y,
      vx: Math.cos(a) * range(state.rng, 30, 90),
      vy: Math.sin(a) * range(state.rng, 30, 90),
      life: PICKUP.life,
      value: PICKUP.emberScore,
    });
  }
  // Heals and shields are rare mercy drops.
  const roll = state.rng();
  if (enemy.kind === 'brute' || roll < 0.02) {
    state.pickups.push({
      kind: enemy.kind === 'brute' && roll < 0.5 ? 'heart' : 'shield',
      x: enemy.x, y: enemy.y,
      vx: range(state.rng, -40, 40), vy: range(state.rng, -40, 40),
      life: PICKUP.life, value: 0,
    });
  }
}

function spawnEnemy(state, kind) {
  const base = ENEMY[kind];
  const p = spawnPoint(state.rng, FIELD, state.player);
  const hpMul = hpScale(state.wave);
  const spMul = speedScale(state.wave);
  const enemy = {
    kind,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    radius: base.radius,
    hp: base.hp * hpMul,
    maxHp: base.hp * hpMul,
    speed: base.speed * spMul,
    contact: base.contact,
    score: base.score,
    ember: base.ember,
    color: base.color,
    t: 0,
    shootCd: range(state.rng, 1.2, 2.4),
    hitCd: 0,
    lungeT: 0,
    lungeCd: range(state.rng, 1.0, 2.0),
    wobble: range(state.rng, 0, TAU),
    flash: 0,
  };
  state.enemies.push(enemy);
  return enemy;
}

function spawnBoss(state) {
  const index = bossIndex(state.wave);
  const boss = {
    kind: 'boss',
    x: FIELD.width / 2,
    y: -80,
    vx: 0,
    vy: 60,
    radius: BOSS.radius,
    hp: bossHp(index),
    maxHp: bossHp(index),
    speed: BOSS.speed,
    contact: BOSS.contact,
    score: BOSS.score,
    ember: BOSS.ember,
    color: BOSS.color,
    t: 0,
    shootCd: 2.0,
    hitCd: 0,
    attackCd: 2.4,
    spiralA: 0,
    summonCd: 6,
    phase: 1,
    flash: 0,
    entering: true,
  };
  state.enemies.push(boss);
  state.boss = boss;
  state.banner = bossName(index);
  state.bannerTimer = 2.4;
  return boss;
}

function killEnemy(state, enemy, sfx) {
  const mult = comboMultiplier(state);
  const gained = Math.round(enemy.score * mult);
  state.score += gained;
  state.kills += 1;
  state.stats.kills += 1;
  state.combo += 1;
  state.comboTimer = COMBO.window;
  addText(state, enemy.x, enemy.y, `+${gained}`, enemy.color, enemy.kind === 'boss' ? 26 : 15);
  burst(state, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' ? 60 : 16, enemy.kind === 'boss' ? 320 : 220, 3.5);
  dropPickups(state, enemy);
  if (enemy.kind === 'brute') {
    for (let i = 0; i < 3; i += 1) {
      const mote = spawnEnemy(state, 'mote');
      mote.x = enemy.x + range(state.rng, -30, 30);
      mote.y = enemy.y + range(state.rng, -30, 30);
    }
  }
  if (enemy.kind === 'boss') {
    state.boss = null;
    state.shake = Math.max(state.shake, 18);
    state.flash = 0.5;
    if (sfx) sfx.bigExplode();
  } else if (sfx) {
    sfx.explode();
  }
}

function damagePlayer(state, amount, sx, sy, sfx) {
  const p = state.player;
  if (!p.alive || p.invuln > 0 || p.dashTime > 0) return false;
  let rest = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, rest);
    p.shield -= absorbed;
    rest -= absorbed;
  }
  p.hull -= rest;
  p.invuln = 0.7;
  state.stats.damageTaken += amount;
  state.shake = Math.max(state.shake, 10);
  burst(state, p.x, p.y, '#ff5c8a', 14, 260, 3);
  if (sfx) sfx.hurt();
  if (p.hull <= 0) {
    p.hull = 0;
    p.alive = false;
    state.over = true;
    burst(state, p.x, p.y, COLORS.player, 70, 380, 4);
    burst(state, p.x, p.y, '#ffffff', 30, 220, 3);
    state.shake = 22;
    if (sfx) sfx.bigExplode();
    if (sfx) sfx.gameOver();
    return true;
  }
  return false;
}

function fireNova(state, sfx) {
  const p = state.player;
  if (p.nova < PLAYER.novaNeed) return false;
  p.nova = 0;
  state.novaFx = 0.6;
  state.flash = 0.65;
  state.shake = Math.max(state.shake, 14);
  state.stats.novas += 1;
  for (const enemy of state.enemies.slice()) {
    enemy.hp -= PLAYER.novaDamage;
    enemy.flash = 0.15;
    if (enemy.hp <= 0) killEnemy(state, enemy, null);
  }
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  state.enemyBullets = [];
  addText(state, p.x, p.y - 30, 'NOVA!', COLORS.nova, 30);
  if (sfx) sfx.nova();
  return true;
}

function fireBullet(state, angle, sfx) {
  const p = state.player;
  const spread = p.projectiles > 1 ? 0.09 : 0;
  for (let i = 0; i < p.projectiles; i += 1) {
    const off = (i - (p.projectiles - 1) / 2) * spread;
    const a = angle + off;
    state.bullets.push({
      x: p.x + Math.cos(a) * (p.radius + 6),
      y: p.y + Math.sin(a) * (p.radius + 6),
      vx: Math.cos(a) * p.bulletSpeed,
      vy: Math.sin(a) * p.bulletSpeed,
      radius: PLAYER.bulletRadius,
      dmg: p.bulletDamage,
      pierce: p.pierce,
      life: 1.1,
    });
  }
  state.stats.shots += p.projectiles;
  if (sfx) sfx.shoot();
}

function updateEnemy(state, enemy, dt, sfx) {
  const p = state.player;
  enemy.t += dt;
  if (enemy.flash > 0) enemy.flash -= dt;
  if (enemy.hitCd > 0) enemy.hitCd -= dt;
  const d = dist(enemy.x, enemy.y, p.x, p.y);
  const toPlayer = angleTo(enemy.x, enemy.y, p.x, p.y);

  if (enemy.kind === 'mote') {
    const wob = Math.sin(enemy.t * 3 + enemy.wobble) * 0.5;
    enemy.vx = Math.cos(toPlayer + wob) * enemy.speed;
    enemy.vy = Math.sin(toPlayer + wob) * enemy.speed;
  } else if (enemy.kind === 'darter') {
    enemy.lungeCd -= dt;
    if (enemy.lungeT > 0) {
      enemy.lungeT -= dt;
      enemy.vx = Math.cos(enemy.lungeA) * 520;
      enemy.vy = Math.sin(enemy.lungeA) * 520;
    } else if (d < 230 && enemy.lungeCd <= 0) {
      enemy.lungeA = toPlayer;
      enemy.lungeT = 0.32;
      enemy.lungeCd = 1.7;
      enemy.flash = 0.25;
    } else {
      enemy.vx = Math.cos(toPlayer) * enemy.speed;
      enemy.vy = Math.sin(toPlayer) * enemy.speed;
    }
  } else if (enemy.kind === 'spitter') {
    const want = 280;
    const dir = d > want + 30 ? 1 : d < want - 30 ? -1 : 0;
    const strafe = Math.sin(enemy.t * 1.4 + enemy.wobble) * 0.8;
    enemy.vx = Math.cos(toPlayer) * enemy.speed * dir + Math.cos(toPlayer + Math.PI / 2) * 60 * strafe;
    enemy.vy = Math.sin(toPlayer) * enemy.speed * dir + Math.sin(toPlayer + Math.PI / 2) * 60 * strafe;
    enemy.shootCd -= dt;
    if (enemy.shootCd <= 0 && d < 560 && p.alive) {
      enemy.shootCd = range(state.rng, 1.9, 2.5);
      state.enemyBullets.push({
        x: enemy.x, y: enemy.y,
        vx: Math.cos(toPlayer) * 230,
        vy: Math.sin(toPlayer) * 230,
        radius: 7, dmg: 10, life: 4,
      });
      if (sfx) sfx.enemyShoot();
    }
  } else if (enemy.kind === 'brute') {
    enemy.vx = Math.cos(toPlayer) * enemy.speed;
    enemy.vy = Math.sin(toPlayer) * enemy.speed;
  } else if (enemy.kind === 'boss') {
    updateBoss(state, enemy, dt, sfx, d, toPlayer);
  }

  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  // Bosses and brutes stay in the field; small fry may drift in from outside.
  if (enemy.kind === 'boss' || enemy.kind === 'brute') {
    enemy.x = clamp(enemy.x, enemy.radius, FIELD.width - enemy.radius);
    enemy.y = clamp(enemy.y, enemy.radius, FIELD.height - enemy.radius);
  }
}

function updateBoss(state, boss, dt, sfx, d, toPlayer) {
  const p = state.player;
  if (boss.entering) {
    boss.vy = 60;
    if (boss.y >= 130) {
      boss.entering = false;
      boss.vy = 0;
    }
    return;
  }
  const hpFrac = boss.hp / boss.maxHp;
  boss.phase = hpFrac < 0.34 ? 3 : hpFrac < 0.67 ? 2 : 1;
  const speedMul = boss.phase === 3 ? 1.7 : boss.phase === 2 ? 1.35 : 1;
  // Slow drift: circle the player at a distance.
  const want = 300;
  const dir = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
  boss.vx = Math.cos(toPlayer) * boss.speed * speedMul * dir + Math.cos(toPlayer + Math.PI / 2) * 46 * Math.sin(boss.t * 0.9);
  boss.vy = Math.sin(toPlayer) * boss.speed * speedMul * dir + Math.sin(toPlayer + Math.PI / 2) * 46 * Math.sin(boss.t * 0.9);

  boss.attackCd -= dt;
  boss.summonCd -= dt;
  if (boss.attackCd <= 0 && p.alive) {
    const interval = boss.phase === 3 ? 1.5 : boss.phase === 2 ? 1.9 : 2.4;
    boss.attackCd = interval;
    const mode = Math.floor(state.rng() * (boss.phase === 1 ? 2 : 3));
    if (mode === 0) {
      // Radial burst.
      const n = boss.phase === 3 ? 16 : 12;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * TAU + boss.t;
        state.enemyBullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(a) * 190, vy: Math.sin(a) * 190,
          radius: 8, dmg: 12, life: 5,
        });
      }
    } else if (mode === 1) {
      // Aimed fan.
      for (let i = -2; i <= 2; i += 1) {
        const a = toPlayer + i * 0.16;
        state.enemyBullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
          radius: 8, dmg: 12, life: 4,
        });
      }
    } else {
      // Spiral stream.
      boss.spiralA += 0.55;
      for (let k = 0; k < 3; k += 1) {
        const a = boss.spiralA + (k * TAU) / 3;
        state.enemyBullets.push({
          x: boss.x, y: boss.y,
          vx: Math.cos(a) * 210, vy: Math.sin(a) * 210,
          radius: 7, dmg: 10, life: 5,
        });
      }
    }
    if (sfx) sfx.enemyShoot();
  }
  if (boss.summonCd <= 0 && state.enemies.length < 14) {
    boss.summonCd = boss.phase === 3 ? 5 : 7;
    for (let i = 0; i < 3; i += 1) {
      const mote = spawnEnemy(state, 'mote');
      mote.x = boss.x + range(state.rng, -70, 70);
      mote.y = boss.y + range(state.rng, -70, 70);
    }
    addText(state, boss.x, boss.y - 70, 'SUMMON', BOSS.color, 16);
  }
}

/**
 * Step the world one fixed step. `input` is { moveX, moveY, aimX, aimY,
 * firing, dash, nova }. Returns an event bitmask (see config.js).
 */
export function stepWorld(state, input, dt, sfx) {
  let events = EVENT_NONE;
  const p = state.player;
  if (state.over || state.victory) return events;
  state.time += dt;
  if (state.bannerTimer > 0) state.bannerTimer -= dt;
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
  if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.6);
  if (state.novaFx > 0) state.novaFx = Math.max(0, state.novaFx - dt * 1.4);

  // Combo decay.
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
  }

  // --- Player movement ---
  if (p.alive) {
    if (input.dash && p.dashCd <= 0 && p.dashTime <= 0) {
      p.dashTime = PLAYER.dashTime;
      p.dashCd = p.dashCdMax;
      p.invuln = Math.max(p.invuln, PLAYER.dashInvuln);
      const dx = input.moveX;
      const dy = input.moveY;
      const len = Math.hypot(dx, dy);
      const a = len > 0.1 ? Math.atan2(dy, dx) : p.angle;
      p.vx = Math.cos(a) * PLAYER.dashSpeed;
      p.vy = Math.sin(a) * PLAYER.dashSpeed;
      burst(state, p.x, p.y, COLORS.player, 10, 200, 2.5);
      if (sfx) sfx.dash();
    }
    if (p.dashTime > 0) {
      p.dashTime -= dt;
    } else {
      p.vx += input.moveX * PLAYER.accel * dt;
      p.vy += input.moveY * PLAYER.accel * dt;
      const drag = Math.max(0, 1 - PLAYER.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp > p.speed) {
        p.vx = (p.vx / sp) * p.speed;
        p.vy = (p.vy / sp) * p.speed;
      }
    }
    p.x = clamp(p.x + p.vx * dt, p.radius, FIELD.width - p.radius);
    p.y = clamp(p.y + p.vy * dt, p.radius, FIELD.height - p.radius);
    p.angle = angleTo(p.x, p.y, input.aimX, input.aimY);
    p.thrust = Math.hypot(input.moveX, input.moveY) > 0.1 ? 1 : 0;
    if (p.thrust > 0 && state.rng() < 0.5) {
      state.particles.push({
        x: p.x - Math.cos(p.angle) * p.radius,
        y: p.y - Math.sin(p.angle) * p.radius,
        vx: -p.vx * 0.2 + range(state.rng, -20, 20),
        vy: -p.vy * 0.2 + range(state.rng, -20, 20),
        life: 0.3, maxLife: 0.3, size: 2.5, color: COLORS.player,
      });
    }
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (input.firing && p.fireCd <= 0) {
      p.fireCd = p.fireInterval;
      fireBullet(state, p.angle, sfx);
    }
    if (input.nova && p.nova >= PLAYER.novaNeed) {
      if (fireNova(state, sfx)) events |= EVENT_NOVA;
    }
    // Nova charges slowly on its own, faster on ember pickups.
    p.nova = Math.min(PLAYER.novaNeed, p.nova + dt * 1.6 * p.novaRate);
  }

  // --- Boss scheduling ---
  if (state.bossPending > 0) {
    state.bossPending -= dt;
    if (state.bossPending <= 0) {
      state.bossPending = -1;
      spawnBoss(state);
      events |= EVENT_BOSS;
      if (sfx) sfx.bossWarn();
    }
  }

  // --- Spawning ---
  if (state.spawnQueue.length > 0 && state.waveState === 'fighting') {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.enemies.length < aliveCap(state.wave)) {
      state.spawnTimer = spawnInterval(state.wave);
      const kind = state.spawnQueue.shift();
      spawnEnemy(state, kind);
    }
  }

  // --- Enemies ---
  for (const enemy of state.enemies) updateEnemy(state, enemy, dt, sfx);
  state.enemies = state.enemies.filter((e) => e.hp > 0);

  // --- Player bullets ---
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      const rr = b.radius + enemy.radius;
      const dx = enemy.x - b.x;
      const dy = enemy.y - b.y;
      if (dx * dx + dy * dy < rr * rr) {
        enemy.hp -= b.dmg;
        enemy.flash = 0.08;
        state.stats.hits += 1;
        b.pierce -= 1;
        burst(state, b.x, b.y, '#ffffff', 3, 120, 2);
        if (sfx) sfx.hit();
        if (enemy.hp <= 0) killEnemy(state, enemy, sfx);
        if (b.pierce < 0) {
          b.life = 0;
          break;
        }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.x > -40 && b.x < FIELD.width + 40 && b.y > -40 && b.y < FIELD.height + 40);

  // --- Enemy bullets ---
  for (const b of state.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (p.alive) {
      const rr = b.radius + p.radius - 2;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy < rr * rr) {
        b.life = 0;
        if (damagePlayer(state, b.dmg, b.x, b.y, sfx)) events |= EVENT_OVER;
      }
    }
  }
  state.enemyBullets = state.enemyBullets.filter((b) => b.life > 0 && b.x > -60 && b.x < FIELD.width + 60 && b.y > -60 && b.y < FIELD.height + 60);

  // --- Contact damage ---
  if (p.alive) {
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.hitCd > 0) continue;
      const rr = enemy.radius + p.radius - 2;
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      if (dx * dx + dy * dy < rr * rr) {
        enemy.hitCd = 0.6;
        // Shove the enemy back so it cannot sit on the player.
        const d = Math.max(1, Math.hypot(dx, dy));
        enemy.x -= (dx / d) * 26;
        enemy.y -= (dy / d) * 26;
        if (damagePlayer(state, enemy.contact, enemy.x, enemy.y, sfx)) events |= EVENT_OVER;
        if (state.over) break;
      }
    }
  }

  // --- Pickups ---
  for (const pk of state.pickups) {
    pk.life -= dt;
    pk.vx *= Math.max(0, 1 - 2.2 * dt);
    pk.vy *= Math.max(0, 1 - 2.2 * dt);
    if (p.alive) {
      const d = dist(pk.x, pk.y, p.x, p.y);
      if (d < p.pickupRadius + 60) {
        const a = angleTo(pk.x, pk.y, p.x, p.y);
        const pull = d < p.pickupRadius ? 420 : 180;
        pk.vx += Math.cos(a) * pull * dt;
        pk.vy += Math.sin(a) * pull * dt;
      }
      if (d < p.radius + PICKUP.radius + 6) {
        pk.life = 0;
        if (pk.kind === 'ember') {
          state.score += PICKUP.emberScore;
          p.nova = Math.min(PLAYER.novaNeed, p.nova + PICKUP.emberNova * p.novaRate);
          if (sfx) sfx.pickup();
        } else if (pk.kind === 'heart') {
          p.hull = Math.min(p.maxHull, p.hull + PICKUP.heartHeal);
          addText(state, p.x, p.y - 24, `+${PICKUP.heartHeal} HULL`, COLORS.heart, 16);
          if (sfx) sfx.heart();
        } else if (pk.kind === 'shield') {
          p.shield = Math.min(100, p.shield + PICKUP.shieldAmount);
          addText(state, p.x, p.y - 24, `+${PICKUP.shieldAmount} SHIELD`, COLORS.shield, 16);
          if (sfx) sfx.pickup();
        }
      }
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
  }
  state.pickups = state.pickups.filter((pk) => pk.life > 0);

  // --- Particles and floating texts ---
  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= Math.max(0, 1 - 2.4 * dt);
    pt.vy *= Math.max(0, 1 - 2.4 * dt);
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);
  for (const t of state.texts) {
    t.y -= 34 * dt;
    t.life -= dt;
  }
  state.texts = state.texts.filter((t) => t.life > 0);

  // --- Wave clear / victory ---
  if (!state.over && state.waveState === 'fighting' && state.spawnQueue.length === 0 && state.enemies.length === 0 && state.bossPending < 0) {
    state.waveState = 'clear';
    state.stats.wavesCleared += 1;
    if (state.wave >= WAVES.finalWave) {
      state.victory = true;
      events |= EVENT_VICTORY;
      if (sfx) sfx.victory();
    } else {
      state.pendingUpgrades = rollUpgrades(state.rng);
      events |= EVENT_WAVE_CLEAR;
      if (sfx) sfx.waveClear();
    }
  }

  if (state.over) events |= EVENT_OVER;
  return events;
}

/** Apply an upgrade choice and start the next wave. */
export function chooseUpgrade(state, upgrade) {
  if (!state.pendingUpgrades) return false;
  upgrade.apply(state.player);
  state.pendingUpgrades = null;
  state.waveState = 'fighting';
  startWave(state, state.wave + 1);
  return true;
}
