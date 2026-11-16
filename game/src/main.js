// NOVA DRIFT — boot, the frame loop and the screens. The world does the
// rules, render.js does the drawing; this file only wires them together and
// owns the screen state (title, play, upgrade, pause, over, victory).

import { EVENT_OVER, EVENT_VICTORY, EVENT_WAVE_CLEAR, FIELD, SCREENS, STEP } from './config.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { chooseUpgrade, createWorld, resetWorld, stepWorld } from './world.js';
import {
  drawHUD, drawOver, drawPause, drawTitle, drawUpgrade, drawVictory, drawWorld, layoutFor,
} from './render.js';
import { autopilotInput, stageShot } from './shots.js';

const BEST_KEY = 'novadrift.best';

function loadBest() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(BEST_KEY) : null;
    const n = raw === null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function saveBest(score) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Best score is a nicety; a blocked store must not break the game.
  }
}

function hitButton(buttons, x, y) {
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

export function boot(canvas) {
  const ctx = canvas.getContext('2d');
  const params = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  const seedParam = parseInt(params.get('seed') || '', 10);
  const seed = Number.isFinite(seedParam) ? seedParam : (Date.now() % 2147483647) || 7;
  const world = createWorld(seed);
  world.best = loadBest();
  const sfx = new SoundEngine();
  const input = new Input(canvas);

  // --- Screenshot mode: stage one frame and stop. ---
  const shot = params.get('shot');
  if (shot) {
    const staged = stageShot(shot, world, null);
    world.best = Math.max(world.best, staged.best);
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    drawWorld(ctx, world);
    if (staged.screen === 'play') drawHUD(ctx, world);
    else if (staged.screen === 'title') drawTitle(ctx, world, false);
    else if (staged.screen === 'over') drawOver(ctx, world);
    if (typeof window !== 'undefined') window.__shotReady = true;
    return { world, screen: staged.screen };
  }

  // --- Normal play ---
  let screen = SCREENS.title;
  let showHow = false;
  let demo = createWorld(seed);
  demo.best = world.best;
  resetWorld(demo);

  const startRun = () => {
    resetWorld(world);
    world.best = loadBest();
    screen = SCREENS.play;
    showHow = false;
  };
  const toTitle = () => {
    demo = createWorld(seed);
    demo.best = loadBest();
    resetWorld(demo);
    screen = SCREENS.title;
    showHow = false;
  };

  const activate = (id) => {
    if (!id) return;
    sfx.unlock();
    if (id === 'start') startRun();
    else if (id === 'how') showHow = !showHow;
    else if (id === 'restart') startRun();
    else if (id === 'resume') screen = SCREENS.play;
    else if (id === 'title') toTitle();
    else if (id.startsWith('upgrade:')) {
      const idx = parseInt(id.split(':')[1], 10);
      const up = world.pendingUpgrades && world.pendingUpgrades[idx];
      if (up) {
        sfx.upgrade();
        chooseUpgrade(world, up);
        screen = SCREENS.play;
      }
    }
  };

  input.onKey = (key) => {
    sfx.unlock();
    if (key === 'm') {
      sfx.toggleMute();
      return;
    }
    if (screen === SCREENS.title) {
      if (key === 'enter' || key === ' ') startRun();
      else if (key === 'h') showHow = !showHow;
    } else if (screen === SCREENS.play) {
      if (key === 'p' || key === 'escape') screen = SCREENS.pause;
    } else if (screen === SCREENS.pause) {
      if (key === 'p' || key === 'escape' || key === 'enter') screen = SCREENS.play;
      else if (key === 'r') startRun();
    } else if (screen === SCREENS.upgrade) {
      if (key === '1' || key === '2' || key === '3') {
        activate(`upgrade:${parseInt(key, 10) - 1}`);
      }
    } else if (screen === SCREENS.over || screen === SCREENS.victory) {
      if (key === 'r' || key === 'enter' || key === ' ') startRun();
      else if (key === 't') toTitle();
    }
  };
  input.onClick = (x, y) => {
    sfx.unlock();
    const buttons = layoutFor(screen, world.pendingUpgrades).buttons;
    activate(hitButton(buttons, x, y));
  };

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    sfx.update(dt);
    const frameInput = input.frame();
    if (screen === SCREENS.title) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        stepWorld(demo, autopilotInput(demo, false), STEP, null);
        if (demo.pendingUpgrades) chooseUpgrade(demo, demo.pendingUpgrades[0]);
        if (demo.over || demo.victory) {
          demo = createWorld(seed);
          demo.best = world.best;
          resetWorld(demo);
        }
      }
      drawWorld(ctx, demo);
      drawTitle(ctx, demo, showHow);
    } else if (screen === SCREENS.play) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const events = stepWorld(world, frameInput, STEP, sfx);
        if (events & EVENT_WAVE_CLEAR) {
          screen = SCREENS.upgrade;
          acc = 0;
          break;
        }
        if (events & EVENT_OVER) {
          screen = SCREENS.over;
          if (world.score > world.best) {
            world.best = world.score;
            saveBest(world.best);
          }
          acc = 0;
          break;
        }
        if (events & EVENT_VICTORY) {
          screen = SCREENS.victory;
          if (world.score > world.best) {
            world.best = world.score;
            saveBest(world.best);
          }
          acc = 0;
          break;
        }
      }
      drawWorld(ctx, world);
      drawHUD(ctx, world);
    } else if (screen === SCREENS.upgrade) {
      drawWorld(ctx, world);
      drawHUD(ctx, world);
      drawUpgrade(ctx, world, world.pendingUpgrades);
    } else if (screen === SCREENS.pause) {
      drawWorld(ctx, world);
      drawHUD(ctx, world);
      drawPause(ctx, world);
    } else if (screen === SCREENS.over) {
      drawWorld(ctx, world);
      drawOver(ctx, world);
    } else if (screen === SCREENS.victory) {
      drawWorld(ctx, world);
      drawVictory(ctx, world);
    }
    input.endFrame();
  }
  requestAnimationFrame(frame);
  return { world, get screen() { return screen; } };
}

// Boot when loaded as the page's module script.
if (typeof document !== 'undefined') {
  const canvas = document.getElementById('game');
  if (canvas) boot(canvas);
}
