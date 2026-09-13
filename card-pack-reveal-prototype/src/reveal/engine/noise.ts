// Cheap multi-octave 1D noise. Ported verbatim from the Claude Design
// prototype (project/rip-pack.js) — the tear edge needs detail at several
// scales or it reads as a machine-cut zigzag, and the same curve is reused
// to key crinkle folds and buckle jitter elsewhere in the pack.
export function noise(x: number): number {
  let v = 0;
  let amp = 1;
  let f = 1;
  for (let o = 0; o < 5; o++) {
    v += amp * Math.sin(x * f * 137.13 + o * 2.7) * Math.cos(x * f * 61.7 + o * 1.3);
    amp *= 0.52;
    f *= 2.13;
  }
  return v * 0.5;
}
