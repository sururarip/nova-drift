// Wave director: what each wave throws at the player. Waves 1-4 teach the
// enemy kinds one at a time, every 5th wave is a boss, and the mix and the
// health scaling keep climbing until the final boss on wave 15.

import { BOSS, WAVES } from './config.js';
import { clamp, int, pick, range } from './random.js';

/** Is this wave a boss wave? */
export function isBossWave(wave) {
  return wave % WAVES.bossEvery === 0;
}

/** Boss number: 1st boss on wave 5, 2nd on wave 10, 3rd (final) on 15. */
export function bossIndex(wave) {
  return Math.floor(wave / WAVES.bossEvery);
}

/** Boss hit points for a given boss index. */
export function bossHp(index) {
  return BOSS.hpBase + BOSS.hpPerBoss * (index - 1);
}

/** Boss display name. */
export function bossName(index) {
  return index >= 3 ? 'THE HOLLOW STAR' : index === 2 ? 'THE HOLLOW STAR, RISEN' : 'THE HOLLOW STAR';
}

/**
 * The spawn plan for a wave: a list of { type, count } in the order they
 * trickle in. Composition opens up as waves go on; bosses get a small escort.
 */
export function wavePlan(wave, rng) {
  const plan = [];
  const add = (type, count) => {
    if (count > 0) plan.push({ type, count });
  };
  if (isBossWave(wave)) {
    add('mote', 4 + wave);
    add('darter', Math.floor(wave / 2));
    return plan;
  }
  const budget = 6 + wave * 3;
  add('mote', Math.round(budget * 0.55));
  if (wave >= 2) add('darter', Math.round(budget * 0.25));
  if (wave >= 3) add('spitter', Math.round(budget * 0.14));
  if (wave >= 4) add('brute', Math.max(1, Math.round(budget * 0.08)));
  // Shuffle the trickle order so waves never feel like the same parade.
  for (let i = plan.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = plan[i];
    plan[i] = plan[j];
    plan[j] = tmp;
  }
  return plan;
}

/** How many enemies may be alive at once on this wave. */
export function aliveCap(wave) {
  return Math.floor(WAVES.aliveCapBase + wave * WAVES.aliveCapPerWave);
}

/** Seconds between spawns on this wave. */
export function spawnInterval(wave) {
  return Math.max(WAVES.spawnIntervalMin, WAVES.spawnIntervalBase - wave * 0.05);
}

/** Health multiplier for enemies on this wave. */
export function hpScale(wave) {
  return 1 + (wave - 1) * WAVES.hpScalePerWave;
}

/** Speed multiplier for enemies on this wave. */
export function speedScale(wave) {
  return 1 + (wave - 1) * WAVES.speedScalePerWave;
}

/** Pick a spawn point on a field edge, away from the player. */
export function spawnPoint(rng, field, player) {
  for (let tries = 0; tries < 8; tries += 1) {
    const edge = int(rng, 0, 3);
    let x;
    let y;
    if (edge === 0) { x = range(rng, 0, field.width); y = -30; }
    else if (edge === 1) { x = field.width + 30; y = range(rng, 0, field.height); }
    else if (edge === 2) { x = range(rng, 0, field.width); y = field.height + 30; }
    else { x = -30; y = range(rng, 0, field.height); }
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy > 320 * 320) return { x, y };
  }
  return { x: range(rng, 0, field.width), y: -30 };
}

/** A random enemy type weighted toward the early kinds. */
export function randomEnemyType(rng, wave) {
  const pool = ['mote', 'mote', 'mote'];
  if (wave >= 2) pool.push('darter', 'darter');
  if (wave >= 3) pool.push('spitter');
  if (wave >= 4) pool.push('brute');
  return pick(rng, pool);
}
