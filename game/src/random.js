// Seeded random numbers (mulberry32) plus the small helpers the game uses,
// so a seeded run is exactly repeatable — the screenshot scenes depend on it.

/** A small, fast seeded PRNG. Returns a function yielding [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max] from rng. */
export function int(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Float in [min, max) from rng. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element of an array with rng. */
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

/** Clamp a value into [min, max]. */
export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Distance between two points. */
export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Angle from (ax, ay) to (bx, by). */
export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
