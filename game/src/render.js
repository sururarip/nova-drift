// NOVA DRIFT — everything the player sees, drawn on one canvas.
// The game draws its HUD and its screens on the canvas itself, so the
// screenshots show the whole loop. Layout helpers are exported so main.js
// can put its click targets on exactly what is drawn.

import { BOSS, COLORS, FIELD, PLAYER, SCREENS, WAVES } from './config.js';
import { comboMultiplier } from './world.js';
import { clamp, makeRng, range } from './random.js';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

// A fixed starfield, the same every run: three parallax layers.
const STARS = (() => {
  const rng = makeRng(1337);
  const layers = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const stars = [];
    const count = [90, 60, 36][layer];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng() * FIELD.width,
        y: rng() * FIELD.height,
        r: range(rng, 0.6, 1.4 + layer * 0.7),
        tw: range(rng, 0, Math.PI * 2),
      });
    }
    layers.push(stars);
  }
  return layers;
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align, weight) {
  ctx.font = `${weight || 700} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function bar(ctx, x, y, w, h, frac, fill, bg) {
  ctx.fillStyle = bg || 'rgba(255,255,255,0.14)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2);
    ctx.fill();
  }
}

export function drawBackground(ctx, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  grad.addColorStop(0, COLORS.bg1);
  grad.addColorStop(0.55, COLORS.bg0);
  grad.addColorStop(1, '#0a0618');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Drifting nebula blobs.
  ctx.save();
  ctx.globalAlpha = 0.16;
  const blobs = [
    { x: 220, y: 150, r: 260, c: '#173a6e' },
    { x: 1050, y: 560, r: 300, c: '#4a1445' },
    { x: 900, y: 120, r: 200, c: '#0f3d4d' },
  ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  ctx.restore();
  // Parallax stars.
  for (let layer = 0; layer < STARS.length; layer += 1) {
    const drift = time * (4 + layer * 7);
    for (const s of STARS[layer]) {
      const y = (s.y + drift) % FIELD.height;
      const alpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(time * 2 + s.tw));
      ctx.globalAlpha = alpha * (0.5 + layer * 0.25);
      ctx.fillStyle = layer === 2 ? '#cfefff' : '#9fc6e8';
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawShip(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  // Engine glow.
  if (p.thrust > 0) {
    const flick = 10 + Math.sin(time * 40) * 4;
    ctx.fillStyle = 'rgba(120, 220, 255, 0.8)';
    ctx.beginPath();
    ctx.moveTo(-p.radius, 5);
    ctx.lineTo(-p.radius - flick, 0);
    ctx.lineTo(-p.radius, -5);
    ctx.closePath();
    ctx.fill();
  }
  // Hull: a swept dart.
  const glow = p.invuln > 0 && Math.floor(time * 14) % 2 === 0 ? 0.45 : 1;
  ctx.globalAlpha = glow;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(p.radius + 6, 0);
  ctx.lineTo(-p.radius, p.radius * 0.75);
  ctx.lineTo(-p.radius * 0.45, 0);
  ctx.lineTo(-p.radius, -p.radius * 0.75);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(2, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Shield ring.
  if (p.shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(time * 5);
    ctx.strokeStyle = COLORS.shield;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Dash cooldown arc.
  if (p.dashCd > 0) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#8fb8d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + 16, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (1 - p.dashCd / p.dashCdMax)));
    ctx.stroke();
    ctx.restore();
  }
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const flash = e.flash > 0;
  ctx.fillStyle = flash ? '#ffffff' : e.color;
  ctx.strokeStyle = flash ? '#ffffff' : e.color;
  if (e.kind === 'mote') {
    // Spinning shard.
    ctx.rotate(e.t * 2 + e.wobble);
    ctx.beginPath();
    ctx.moveTo(e.radius, 0);
    ctx.lineTo(0, e.radius * 0.7);
    ctx.lineTo(-e.radius, 0);
    ctx.lineTo(0, -e.radius * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'darter') {
    ctx.rotate(Math.atan2(e.vy, e.vx));
    ctx.beginPath();
    ctx.moveTo(e.radius + 4, 0);
    ctx.lineTo(-e.radius, e.radius * 0.6);
    ctx.lineTo(-e.radius * 0.4, 0);
    ctx.lineTo(-e.radius, -e.radius * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'spitter') {
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a0a3d';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#e9c9ff';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'brute') {
    // Hex shell.
    ctx.rotate(e.t * 0.6);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * e.radius;
      const py = Math.sin(a) * e.radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3d0a12';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#ffb3bd';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (e.kind === 'boss') {
    // The Hollow Star: a ringed void with a burning core.
    const pulse = 1 + Math.sin(e.t * 2.2) * 0.04;
    ctx.scale(pulse, pulse);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + e.t * 0.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (e.radius - 6), Math.sin(a) * (e.radius - 6));
      ctx.lineTo(Math.cos(a) * (e.radius + 12), Math.sin(a) * (e.radius + 12));
      ctx.stroke();
    }
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, e.radius * 0.55);
    core.addColorStop(0, '#fff6c9');
    core.addColorStop(0.5, BOSS.coreColor);
    core.addColorStop(1, 'rgba(255, 45, 85, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Health bar for tough foes.
  if ((e.kind === 'brute' || e.kind === 'spitter') && e.hp < e.maxHp) {
    bar(ctx, e.x - 20, e.y - e.radius - 12, 40, 5, e.hp / e.maxHp, e.color);
  }
}

export function drawWorld(ctx, state) {
  const time = state.time;
  ctx.save();
  if (state.shake > 0.3) {
    // Deterministic shake from the clock, so staged frames are repeatable.
    ctx.translate(Math.sin(time * 91.7) * state.shake * 0.5, Math.cos(time * 83.3) * state.shake * 0.5);
  }
  drawBackground(ctx, time);

  // Pickups.
  for (const pk of state.pickups) {
    const bob = Math.sin(time * 4 + pk.x) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'ember') {
      ctx.fillStyle = COLORS.ember;
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.fillStyle = '#fff3c9';
      ctx.fillRect(-2.5, -2.5, 5, 5);
    } else if (pk.kind === 'heart') {
      ctx.fillStyle = COLORS.heart;
      ctx.beginPath();
      ctx.arc(-3.5, -2, 4.5, 0, Math.PI * 2);
      ctx.arc(3.5, -2, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(8, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.strokeStyle = COLORS.shield;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.shield;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Enemy bullets.
  for (const b of state.enemyBullets) {
    ctx.save();
    ctx.fillStyle = COLORS.enemyBullet;
    ctx.shadowColor = COLORS.enemyBullet;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd7e4';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Enemies.
  for (const e of state.enemies) drawEnemy(ctx, e, time);

  // Player bullets.
  for (const b of state.bullets) {
    ctx.save();
    ctx.fillStyle = COLORS.bullet;
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Player.
  if (state.player.alive) drawShip(ctx, state.player, time);

  // Particles.
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating texts.
  for (const t of state.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    text(ctx, t.text, t.x, t.y, t.size, t.color, 'center', 800);
  }
  ctx.globalAlpha = 1;

  // Nova shockwave.
  if (state.novaFx > 0) {
    const frac = 1 - state.novaFx / 0.6;
    ctx.save();
    ctx.globalAlpha = (1 - frac) * 0.9;
    ctx.strokeStyle = COLORS.nova;
    ctx.lineWidth = 6 * (1 - frac) + 1;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, 40 + frac * 900, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Full-screen flash (nova, boss death).
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(190, 255, 244, ${state.flash * 0.5})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

export function drawHUD(ctx, state) {
  const p = state.player;
  // Top-left: score.
  text(ctx, `SCORE ${state.score.toLocaleString('en-US')}`, 24, 30, 22, COLORS.text, 'left', 800);
  text(ctx, `BEST ${Math.max(state.best, state.score).toLocaleString('en-US')}`, 24, 56, 13, COLORS.dim, 'left', 600);
  // Top-centre: wave.
  text(ctx, state.boss ? 'BOSS' : `WAVE ${state.wave} / ${WAVES.finalWave}`, FIELD.width / 2, 30, 20, state.boss ? COLORS.danger : COLORS.text, 'center', 800);
  // Top-right: combo.
  if (state.combo >= 4) {
    const mult = comboMultiplier(state);
    text(ctx, `COMBO x${mult.toFixed(1)}`, FIELD.width - 24, 30, 20, COLORS.gold, 'right', 800);
    bar(ctx, FIELD.width - 164, 46, 140, 6, state.comboTimer / 3, COLORS.gold);
  }
  // Bottom-left: hull + shield.
  text(ctx, 'HULL', 24, FIELD.height - 52, 13, COLORS.dim, 'left', 700);
  bar(ctx, 24, FIELD.height - 40, 240, 14, p.hull / p.maxHull, p.hull > 30 ? '#37e08b' : COLORS.danger);
  if (p.shield > 0) {
    text(ctx, `SHIELD ${Math.ceil(p.shield)}`, 24, FIELD.height - 18, 13, COLORS.shield, 'left', 700);
  }
  // Bottom-right: nova.
  const novaReady = p.nova >= PLAYER.novaNeed;
  text(ctx, novaReady ? 'NOVA READY — E / RIGHT-CLICK' : 'NOVA', FIELD.width - 24, FIELD.height - 52, 13, novaReady ? COLORS.nova : COLORS.dim, 'right', 700);
  bar(ctx, FIELD.width - 264, FIELD.height - 40, 240, 14, p.nova / PLAYER.novaNeed, novaReady ? COLORS.nova : '#3fa8c9');
  // Boss health bar.
  if (state.boss && state.boss.hp > 0) {
    const b = state.boss;
    text(ctx, 'THE HOLLOW STAR', FIELD.width / 2, 62, 14, COLORS.danger, 'center', 800);
    bar(ctx, FIELD.width / 2 - 220, 74, 440, 10, b.hp / b.maxHp, COLORS.danger);
  }
  // Wave banner.
  if (state.bannerTimer > 0) {
    const a = Math.min(1, state.bannerTimer);
    ctx.globalAlpha = a;
    text(ctx, state.banner, FIELD.width / 2, FIELD.height / 2 - 120, 44, COLORS.text, 'center', 900);
    ctx.globalAlpha = 1;
  }
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(3, 5, 16, 0.66)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.panel;
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 14);
  ctx.stroke();
}

function button(ctx, rect, label, sub, active) {
  ctx.fillStyle = active ? '#1d5f7a' : 'rgba(20, 60, 96, 0.9)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
  ctx.fill();
  ctx.strokeStyle = active ? COLORS.player : COLORS.panelEdge;
  ctx.lineWidth = 1.5;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 10);
  ctx.stroke();
  text(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2 - (sub ? 9 : 0), 20, COLORS.text, 'center', 800);
  if (sub) text(ctx, sub, rect.x + rect.w / 2, rect.y + rect.h / 2 + 15, 12, COLORS.dim, 'center', 600);
}

/** Click targets for each screen, in the same coordinates as drawn. */
export function layoutFor(screen, upgrades) {
  const cx = FIELD.width / 2;
  if (screen === SCREENS.title) {
    return {
      buttons: [
        { id: 'start', x: cx - 130, y: 470, w: 260, h: 58, label: 'LAUNCH', sub: 'Enter / click' },
        { id: 'how', x: cx - 130, y: 540, w: 260, h: 44, label: 'HOW TO PLAY', sub: '' },
      ],
    };
  }
  if (screen === SCREENS.upgrade) {
    const cards = (upgrades || []).map((u, i) => ({
      id: `upgrade:${i}`,
      x: cx - 400 + i * 270,
      y: 300,
      w: 250,
      h: 170,
      label: u.name,
      sub: u.desc,
    }));
    return { buttons: cards };
  }
  if (screen === SCREENS.over || screen === SCREENS.victory) {
    return {
      buttons: [
        { id: 'restart', x: cx - 130, y: 520, w: 260, h: 58, label: 'FLY AGAIN', sub: 'R / click' },
        { id: 'title', x: cx - 130, y: 592, w: 260, h: 44, label: 'TITLE SCREEN', sub: '' },
      ],
    };
  }
  if (screen === SCREENS.pause) {
    return {
      buttons: [
        { id: 'resume', x: cx - 130, y: 380, w: 260, h: 58, label: 'RESUME', sub: 'P / Esc' },
        { id: 'restart', x: cx - 130, y: 452, w: 260, h: 58, label: 'RESTART RUN', sub: '' },
        { id: 'title', x: cx - 130, y: 524, w: 260, h: 44, label: 'TITLE SCREEN', sub: '' },
      ],
    };
  }
  return { buttons: [] };
}

function drawHowTo(ctx) {
  const lines = [
    ['MOVE', 'WASD or arrow keys — your ship follows the keys'],
    ['AIM + FIRE', 'Mouse to aim, hold left-click to fire'],
    ['DASH', 'Space or Shift — a quick burst, briefly invulnerable'],
    ['NOVA', 'E or right-click when the Nova bar is full — clears the field'],
    ['GOAL', 'Survive 15 waves and destroy THE HOLLOW STAR'],
    ['PICKUPS', 'Embers charge your Nova · hearts heal · shields block'],
  ];
  let y = 250;
  for (const [k, v] of lines) {
    text(ctx, k, FIELD.width / 2 - 330, y, 15, COLORS.gold, 'left', 800);
    text(ctx, v, FIELD.width / 2 - 200, y, 15, COLORS.text, 'left', 500);
    y += 30;
  }
}

export function drawTitle(ctx, state, showHow) {
  dim(ctx);
  text(ctx, 'NOVA DRIFT', FIELD.width / 2, 130, 64, COLORS.text, 'center', 900);
  text(ctx, 'the last light-ship against the Hollow Star', FIELD.width / 2, 182, 19, COLORS.dim, 'center', 500);
  if (showHow) {
    drawHowTo(ctx);
  } else {
    text(ctx, 'Survive 15 waves. Destroy the Hollow Star. Do not go dark.', FIELD.width / 2, 250, 18, COLORS.text, 'center', 600);
    if (state.best > 0) {
      text(ctx, `BEST SCORE  ${state.best.toLocaleString('en-US')}`, FIELD.width / 2, 300, 18, COLORS.gold, 'center', 800);
    }
    text(ctx, 'WASD move · mouse aim · click fire · Space dash · E Nova', FIELD.width / 2, 340, 15, COLORS.dim, 'center', 600);
  }
  for (const b of layoutFor(SCREENS.title).buttons) button(ctx, b, b.label, b.sub, false);
  text(ctx, 'M mute · P pause', FIELD.width / 2, 640, 13, COLORS.dim, 'center', 600);
}

export function drawUpgrade(ctx, state, upgrades) {
  dim(ctx);
  text(ctx, `WAVE ${state.wave} CLEAR`, FIELD.width / 2, 150, 40, COLORS.text, 'center', 900);
  text(ctx, 'Choose one upgrade — it shapes the rest of the run', FIELD.width / 2, 200, 17, COLORS.dim, 'center', 600);
  text(ctx, `SCORE ${state.score.toLocaleString('en-US')}   ·   HULL ${Math.ceil(state.player.hull)} / ${state.player.maxHull}`, FIELD.width / 2, 240, 16, COLORS.text, 'center', 700);
  for (const b of layoutFor(SCREENS.upgrade, upgrades).buttons) {
    const card = { x: b.x, y: b.y, w: b.w, h: b.h };
    ctx.fillStyle = 'rgba(20, 60, 96, 0.92)';
    roundRect(ctx, card.x, card.y, card.w, card.h, 12);
    ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 1.5;
    roundRect(ctx, card.x, card.y, card.w, card.h, 12);
    ctx.stroke();
    text(ctx, b.label, card.x + card.w / 2, card.y + 42, 19, COLORS.gold, 'center', 800);
    // Word-wrap the description.
    const words = b.sub.split(' ');
    let line = '';
    let y = card.y + 84;
    for (const word of words) {
      if ((line + ' ' + word).trim().length > 24) {
        text(ctx, line.trim(), card.x + card.w / 2, y, 14, COLORS.text, 'center', 500);
        y += 22;
        line = word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim()) text(ctx, line.trim(), card.x + card.w / 2, y, 14, COLORS.text, 'center', 500);
    text(ctx, `[ ${layoutFor(SCREENS.upgrade, upgrades).buttons.indexOf(b) + 1} ]`, card.x + card.w / 2, card.y + card.h - 24, 13, COLORS.dim, 'center', 700);
  }
}

export function drawPause(ctx, state) {
  dim(ctx);
  text(ctx, 'PAUSED', FIELD.width / 2, 260, 48, COLORS.text, 'center', 900);
  text(ctx, `Wave ${state.wave} · Score ${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 320, 17, COLORS.dim, 'center', 600);
  for (const b of layoutFor(SCREENS.pause).buttons) button(ctx, b, b.label, b.sub, false);
}

export function drawOver(ctx, state) {
  dim(ctx);
  text(ctx, 'THE LIGHT GOES OUT', FIELD.width / 2, 180, 44, COLORS.danger, 'center', 900);
  text(ctx, `The Hollow Star claims another pilot on wave ${state.wave}.`, FIELD.width / 2, 232, 18, COLORS.text, 'center', 600);
  const s = state.stats;
  const acc = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
  const rows = [
    ['FINAL SCORE', state.score.toLocaleString('en-US')],
    ['BEST', Math.max(state.best, state.score).toLocaleString('en-US')],
    ['WAVES CLEARED', String(s.wavesCleared)],
    ['KILLS', String(s.kills)],
    ['ACCURACY', `${acc}%`],
  ];
  let y = 300;
  for (const [k, v] of rows) {
    text(ctx, k, FIELD.width / 2 - 160, y, 17, COLORS.dim, 'left', 700);
    text(ctx, v, FIELD.width / 2 + 160, y, 17, COLORS.text, 'right', 800);
    y += 34;
  }
  for (const b of layoutFor(SCREENS.over).buttons) button(ctx, b, b.label, b.sub, false);
}

export function drawVictory(ctx, state) {
  dim(ctx);
  text(ctx, 'THE HOLLOW STAR FALLS', FIELD.width / 2, 150, 44, COLORS.gold, 'center', 900);
  text(ctx, 'Dawn breaks over the drift. The Kestrel flies home.', FIELD.width / 2, 204, 19, COLORS.text, 'center', 600);
  const s = state.stats;
  const acc = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
  const mins = Math.floor(state.time / 60);
  const secs = Math.floor(state.time % 60);
  const rows = [
    ['FINAL SCORE', state.score.toLocaleString('en-US')],
    ['TIME', `${mins}:${String(secs).padStart(2, '0')}`],
    ['KILLS', String(s.kills)],
    ['ACCURACY', `${acc}%`],
    ['NOVAS FIRED', String(s.novas)],
  ];
  let y = 280;
  for (const [k, v] of rows) {
    text(ctx, k, FIELD.width / 2 - 160, y, 17, COLORS.dim, 'left', 700);
    text(ctx, v, FIELD.width / 2 + 160, y, 17, COLORS.text, 'right', 800);
    y += 34;
  }
  for (const b of layoutFor(SCREENS.victory).buttons) button(ctx, b, b.label, b.sub, false);
}
