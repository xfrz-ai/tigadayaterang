/**
 * Scroll timeline of the services journey, shared by the 3D scene and the
 * text around it (kept free of three.js so the page bundle stays small).
 *
 * Scroll progress `p` (0 to 1 through the pinned stretch) maps to a place on
 * the journey `x`: stop i sits at x = i + 1. Between stops the vehicle drives
 * on, eased; at a stop it barely creeps while the service is explained.
 */
export const STOP_COUNT = 3;

const KEYS: readonly (readonly [number, number])[] = [
  // Parked at the warehouse at first, then off down the road.
  [0, 0],
  [0.03, 0.01],
  [0.11, 0.97],
  [0.24, 1.03],
  [0.4, 1.97],
  [0.54, 2.03],
  [0.7, 2.97],
  [0.84, 3.03],
  [1, 3.08],
];

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Place on the journey for scroll progress `p`. */
export function journeyAt(p: number, reduced = false) {
  p = Math.min(1, Math.max(0, p));
  // Reduced motion: no travel, one stop after another.
  if (reduced) return Math.min(STOP_COUNT, Math.floor(p * STOP_COUNT) + 1);
  for (let i = 0; i < KEYS.length - 1; i++) {
    const [p0, x0] = KEYS[i],
      [p1, x1] = KEYS[i + 1];
    if (p > p1) continue;
    const t = (p - p0) / (p1 - p0);
    // Drives ease in and out; the short holds at the stops run straight.
    const eased = x1 - x0 > 0.2 ? smoothstep(0, 1, t) : t;
    return x0 + (x1 - x0) * eased;
  }
  return KEYS[KEYS.length - 1][1];
}

/** How close the journey is to stop `i`: 1 there, 0 well on the way. */
export function nearStop(x: number, i: number) {
  return 1 - smoothstep(0.06, 0.38, Math.abs(x - (i + 1)));
}

/** Scroll progress at the middle of stop `i`, for jumping to it. */
export function stopProgress(i: number) {
  const hold = KEYS.findIndex(([, x]) => x > i + 1);
  return (KEYS[hold - 1][0] + KEYS[hold][0]) / 2;
}
