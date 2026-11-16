// Screenshot scenes behind ?shot=menu|play|boss|end. Each one plays the real
// rules forward from a fresh seeded world, steered by an autopilot, so the
// frame is what a short game really looks like — and the same seed always
// gives the same frame. The title demo in main.js reuses the same pilot.

import { EVENT_OVER, FIELD, STEP } from './config.js';
import { angleTo, clamp, dist } from './random.js';
import { chooseUpgrade, createWorld, resetWorld, startWave, stepWorld } from './world.js';
import { UPGRADE_POOL } from './upgrades.js';

const MENU_SECONDS = 5;
const PLAY_SECONDS = 26;
const BOSS_SECONDS = 8;
const END_LIMIT_SECONDS = 600;

/** The demo pilot: flee what is close, chase embers, aim at the nearest foe. */
export function autopilotInput(state, reckless) {
  const p = state.player;
  if (!p.alive) return { moveX: 0, moveY: 0, aimX: p.x, aimY: p.y - 100, firing: false, dash: false, nova: false };
  let nearest = null;
  let nearestD = Infinity;
  for (const e of state.enemies) {
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = e;
    }
  }
  if (reckless) {
    // A hurried player: rams the nearest foe, never fires, never dashes.
    const a = nearest ? angleTo(p.x, p.y, nearest.x, nearest.y) : -Math.PI / 2;
    return {
      moveX: Math.cos(a), moveY: Math.sin(a),
      aimX: nearest ? nearest.x : p.x, aimY: nearest ? nearest.y : p.y - 100,
      firing: false, dash: false, nova: false,
    };
  }
  // Flee vector from close threats.
  let fx = 0;
  let fy = 0;
  for (const e of state.enemies) {
    const d = dist(p.x, p.y, e.x, e.y);
    if (d < 180) {
      const w = (180 - d) / 180;
      fx += ((p.x - e.x) / Math.max(1, d)) * w;
      fy += ((p.y - e.y) / Math.max(1, d)) * w;
    }
  }
  for (const b of state.enemyBullets) {
    const d = dist(p.x, p.y, b.x, b.y);
    if (d < 130) {
      const w = (130 - d) / 130;
      fx += ((p.x - b.x) / Math.max(1, d)) * w;
      fy += ((p.y - b.y) / Math.max(1, d)) * w;
    }
  }
  // Drift toward the nearest ember when it is safe to.
  let ember = null;
  let emberD = Infinity;
  for (const pk of state.pickups) {
    if (pk.kind !== 'ember') continue;
    const d = dist(p.x, p.y, pk.x, pk.y);
    if (d < emberD) {
      emberD = d;
      ember = pk;
    }
  }
  if (ember && emberD < 240 && fx * fx + fy * fy < 0.5) {
    fx += ((ember.x - p.x) / Math.max(1, emberD)) * 0.6;
    fy += ((ember.y - p.y) / Math.max(1, emberD)) * 0.6;
  }
  // Keep off the walls.
  if (p.x < 90) fx += 0.8;
  if (p.x > FIELD.width - 90) fx -= 0.8;
  if (p.y < 90) fy += 0.8;
  if (p.y > FIELD.height - 90) fy -= 0.8;
  const len = Math.hypot(fx, fy);
  if (len > 0.05) {
    fx /= len;
    fy /= len;
  } else if (nearest) {
    // No threat: close in to keep the fight on screen.
    const a = angleTo(p.x, p.y, nearest.x, nearest.y);
    fx = Math.cos(a) * 0.5;
    fy = Math.sin(a) * 0.5;
  }
  const aimA = nearest ? angleTo(p.x, p.y, nearest.x, nearest.y) : p.angle;
  const aimDiff = Math.abs(((aimA - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  let dash = false;
  if (p.dashCd <= 0) {
    for (const b of state.enemyBullets) {
      if (dist(p.x, p.y, b.x, b.y) < 74) {
        dash = true;
        break;
      }
    }
    if (!dash && nearest && nearestD < 52) dash = true;
  }
  let nearCount = 0;
  for (const e of state.enemies) {
    if (dist(p.x, p.y, e.x, e.y) < 330) nearCount += 1;
  }
  return {
    moveX: clamp(fx, -1, 1),
    moveY: clamp(fy, -1, 1),
    aimX: p.x + Math.cos(aimA) * 100,
    aimY: p.y + Math.sin(aimA) * 100,
    firing: nearest !== null && nearestD < 560 && aimDiff < 0.35,
    dash,
    nova: p.nova >= 100 && nearCount >= 4,
  };
}

function runSteps(state, seconds, reckless, sfx) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = stepWorld(state, autopilotInput(state, reckless), STEP, sfx);
    if (state.pendingUpgrades) {
      // The pilot takes the first upgrade and keeps flying.
      chooseUpgrade(state, state.pendingUpgrades[0]);
    }
    if (events & EVENT_OVER) break;
    if (state.victory) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Scenes: menu (title over a live demo), play (mid-fight), boss (the wave-5
 * boss fight), end (game over). Any other name is menu.
 */
export function stageShot(name, world, sfx) {
  resetWorld(world);
  if (name === 'boss') {
    // A mid-run state, the way a real player reaches it: four waves of
    // upgrades, then the first boss. Defensive picks, so the boss is still
    // standing mid-fight when the frame is taken.
    const picks = ['aegis', 'magnet', 'guard', 'swift'];
    for (const id of picks) {
      const up = UPGRADE_POOL.find((u) => u.id === id);
      if (up) up.apply(world.player);
    }
    startWave(world, 5);
    runSteps(world, BOSS_SECONDS, false, sfx);
    return { screen: 'play', best: world.score };
  }
  if (name === 'play') {
    runSteps(world, PLAY_SECONDS, false, sfx);
    return { screen: world.over ? 'over' : 'play', best: world.score };
  }
  if (name === 'end') {
    runSteps(world, END_LIMIT_SECONDS, true, sfx);
    return { screen: 'over', best: world.score };
  }
  runSteps(world, MENU_SECONDS, false, sfx);
  return { screen: 'title', best: 0 };
}
