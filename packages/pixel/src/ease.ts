// Easing curves and timing helpers. `t` is normalised progress, 0..1.

export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Progress of `t` through the window [start, end], clamped to 0..1. */
export const span = (t: number, start: number, end: number) => clamp01((t - start) / (end - start));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const linear = (t: number) => t;
export const inQuad = (t: number) => t * t;
export const outQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const inOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const inCubic = (t: number) => t * t * t;
export const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const outExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const inExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));

/** Overshoots, then settles: snappy arrivals. */
export const outBack = (t: number, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);

/** Pulls back, then accelerates away: snappy departures. */
export const inBack = (t: number, s = 1.70158) => (s + 1) * t * t * t - s * t * t;

/** Springy settle with a few decaying wobbles. */
export const outElastic = (t: number) =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

export const outBounce = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
};

/** Deterministic pseudo-random numbers, so renders are reproducible. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
