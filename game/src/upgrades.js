// Between-wave upgrades: the player picks one of three, and the choice
// shapes the rest of the run. Each upgrade is one object with a name, a
// plain-language description and an apply() that changes the player.

export const UPGRADE_POOL = [
  {
    id: 'rapid',
    name: 'Rapid Cycler',
    desc: 'Fire 25% faster.',
    apply(p) { p.fireInterval *= 0.8; },
  },
  {
    id: 'twin',
    name: 'Twin Lance',
    desc: '+1 projectile per shot, in a spread.',
    apply(p) { p.projectiles += 1; },
  },
  {
    id: 'aegis',
    name: 'Aegis Plating',
    desc: '+25 max hull and restore 25 hull.',
    apply(p) { p.maxHull += 25; p.hull = Math.min(p.maxHull, p.hull + 25); },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    desc: 'Pickups fly to you from 2.2x farther.',
    apply(p) { p.pickupRadius *= 2.2; },
  },
  {
    id: 'capacitor',
    name: 'Nova Capacitor',
    desc: 'Nova charges 50% faster.',
    apply(p) { p.novaRate *= 1.5; },
  },
  {
    id: 'swift',
    name: 'Swift Dash',
    desc: 'Dash recharges 35% faster.',
    apply(p) { p.dashCooldownMax *= 0.65; },
  },
  {
    id: 'pierce',
    name: 'Piercing Rounds',
    desc: 'Bullets pass through +1 enemy.',
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'overdrive',
    name: 'Overdrive',
    desc: '+15% bullet speed and damage.',
    apply(p) { p.bulletSpeed *= 1.15; p.bulletDamage *= 1.15; },
  },
  {
    id: 'guard',
    name: 'Guardian Shield',
    desc: 'Gain a 35-point shield that blocks damage.',
    apply(p) { p.shield = Math.min(100, p.shield + 35); },
  },
  {
    id: 'velocity',
    name: 'Ion Thrusters',
    desc: 'Move 15% faster.',
    apply(p) { p.speed *= 1.15; },
  },
];

/** Roll three distinct upgrades with rng. */
export function rollUpgrades(rng) {
  const pool = UPGRADE_POOL.slice();
  const out = [];
  while (out.length < 3 && pool.length > 0) {
    const i = Math.floor(rng() * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
