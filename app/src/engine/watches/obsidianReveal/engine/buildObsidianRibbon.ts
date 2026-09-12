// The silk ribbon — ported from the design's own ribbon construction and morph targets
// (the-obsidian-vault/project/apex-vault.html, lines 353-416, plus the per-frame rebuilds at
// 952-980).
//
// WHY THE RIBBON IS THE MOST INTERESTING PIECE OF GEOMETRY IN ANY OF THE THREE TIERS
//
// The other two tiers open with one gesture against rigid geometry: a lid rotates. This one opens
// with two, and the first acts on *fabric*. A ribbon cannot be animated by transforming a rigid
// mesh — drawing it through a fastener changes its shape, not its position — so the band's
// geometry is regenerated every frame from three morph targets:
//
//   wrapPts    — taut around the closed case, hugging every face
//   slackPts   — the same path, loosened outward and upward as the pull takes up slack
//   fallenPts  — a loose coil lying on the floor beside the vault
//
// The draw gesture blends wrap -> slack; the release blends the result -> fallen. Meanwhile the
// `fall` parameter of `ribbonGeometry` rotates the strip's cross-axis from a fixed facing (correct
// while taut against flat surfaces) to following the curve (correct once it is a loose coil). That
// last detail is what makes it read as silk rather than as a bent metal strap.
//
// COST, AND THE ONE THING THIS FILE MUST GET RIGHT
//
// Regenerating the band means allocating a new BufferGeometry every frame of the gesture. At 60fps
// over a ~2s draw that is ~120 geometries; without disposing the previous one each time, that is a
// leaked GPU buffer per frame. `ObsidianBin.swap` exists for exactly this and is used for all three
// regenerated meshes below. The design gets this right too (`bandMesh.geometry.dispose()` before
// reassigning) — worth preserving carefully rather than simplifying away.
import * as THREE from "three";
import {
  ObsidianBin,
  ribbonGeometry,
  lerpPts,
  put,
  type Pt3,
} from "./obsidianGeometry";
import { obsidianMaterialFor, type ObsidianPalette } from "./obsidianMaterials";
import { BAND_X, VAULT_D, VAULT_H, VAULT_TOP } from "./buildObsidianVault";

/** Sample counts, from the design. The band needs 150 to wrap four corners without creasing. */
const BAND_SEGMENTS = 150;
const TAIL_SEGMENTS = 64;
const BAND_WIDTH = 0.031;

/**
 * The taut wrap: a closed loop over the top, down the front, under the base, up the back.
 *
 * Authored as a single path in the design, with `BAND_X` added to every point afterwards so the
 * whole wrap sits off-centre (keeping the pull tail clear of the lid emblem). Reproduced the same
 * way rather than baking the offset into the literals, so these numbers stay diffable against the
 * source.
 */
function wrapPoints(): Pt3[] {
  const pts: Pt3[] = [
    [0, 0.0015, -0.06],
    [0, 0.0012, 0.02],
    [0, 0.004, VAULT_D / 2 - 0.012],
    [0, 0.03, VAULT_D / 2 + 0.0075],
    [0, 0.072, VAULT_D / 2 + 0.0075],
    [0, VAULT_H + 0.004, VAULT_D / 2 + 0.006],
    [0, VAULT_TOP + 0.0035, VAULT_D / 2 - 0.02],
    [0, VAULT_TOP + 0.004, 0.02],
    [0, VAULT_TOP + 0.004, -0.05],
    [0, VAULT_TOP + 0.0035, -VAULT_D / 2 + 0.02],
    [0, VAULT_H + 0.004, -VAULT_D / 2 - 0.006],
    [0, 0.06, -VAULT_D / 2 - 0.0072],
    [0, 0.016, -VAULT_D / 2 - 0.0072],
    [0, 0.0018, -VAULT_D / 2 + 0.016],
    [0, 0.0014, -0.14],
  ];
  for (const p of pts) p[0] += BAND_X;
  return pts;
}

/** The slack shape: every point pushed outward from the case and lifted, more so over the top. */
function slackPoints(wrap: Pt3[]): Pt3[] {
  return wrap.map((p) => {
    const out = Math.sign(p[2] || 1) * 0.012;
    const up = p[1] > VAULT_TOP - 0.01 ? 0.014 : 0.004;
    return [p[0], p[1] + up, p[2] + out] as Pt3;
  });
}

/** The fallen coil, verbatim from the design — hand-authored rather than derived, because a
 * plausible loose coil is not something a formula produces. */
const FALLEN_POINTS: Pt3[] = [
  [-0.113, 0.0018, 0.16],
  [-0.087, 0.0064, 0.19],
  [-0.053, 0.0072, 0.208],
  [-0.019, 0.003, 0.2],
  [0.002, 0.002, 0.178],
  [-0.015, 0.0058, 0.156],
  [-0.049, 0.008, 0.146],
  [-0.081, 0.0044, 0.158],
  [-0.099, 0.0022, 0.183],
  [-0.083, 0.0052, 0.209],
  [-0.049, 0.0062, 0.222],
  [-0.013, 0.0032, 0.217],
  [0.011, 0.002, 0.199],
  [0.026, 0.0016, 0.177],
  [0.035, 0.0014, 0.154],
];

/** Where the pull tail is anchored — just below the fastener on the front face. */
const TAIL_BASE: Pt3 = [BAND_X, 0.049, VAULT_D / 2 + 0.012];

/**
 * One hanging tail, as a function of its length and direction.
 *
 * The quadratic `t*t` on the horizontal term plus the sine wobble is what gives a hanging ribbon
 * its characteristic curve — falling nearly straight at first, swinging out as it lengthens.
 */
function tailPoints(len: number, dir: number, spread: number): Pt3[] {
  const p: Pt3[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    p.push([
      TAIL_BASE[0] + dir * (0.012 + len * 0.62) * t * t + Math.sin(t * 3.1) * 0.004 * dir,
      TAIL_BASE[1] - len * t * (0.9 + 0.25 * t) - 0.002 * t,
      TAIL_BASE[2] + spread * Math.sin(t * 2.2) * 0.5 + 0.004 * t,
    ]);
  }
  return p;
}

export interface ObsidianRibbon {
  group: THREE.Group;
  /** The pull tails and their gold tip, hidden once the band has fallen. */
  pull: THREE.Group;
  /**
   * Sets the ribbon's shape for a given draw/fall state. Pure in the sense that it depends only on
   * its arguments — so scrubbing the draw gesture backwards retraces exactly.
   *
   * @param draw   0..1 — how far the ribbon has been pulled through the fastener
   * @param fall   0..1 — how far the loosened band has slipped off and settled
   * @param stretch 0..1 — narrows the band slightly under tension
   */
  setState(draw: number, fall: number, stretch: number): void;
  dispose(): void;
}

export function buildObsidianRibbon(palette: ObsidianPalette): ObsidianRibbon {
  const bin = new ObsidianBin();
  const silk = obsidianMaterialFor(palette, "silk");
  const goldBrush = obsidianMaterialFor(palette, "goldBrush");
  const goldPolish = obsidianMaterialFor(palette, "goldPolish");

  const wrap = wrapPoints();
  const slack = slackPoints(wrap);

  const group = new THREE.Group();
  group.name = "Ribbon";

  // ---- the band ------------------------------------------------------------
  // Its initial geometry is NOT tracked by the bin: it will be replaced by `swap` on the first
  // state change, and `swap` disposes whatever it replaces. Tracking it too would double-dispose.
  const band = new THREE.Mesh(ribbonGeometry(wrap, BAND_WIDTH, BAND_SEGMENTS, 0), silk);
  band.name = "RibbonBand";
  band.castShadow = true;
  group.add(band);

  // ---- fastener ------------------------------------------------------------
  // The brushed-gold slider the ribbon draws through. Rotates and shifts slightly as the band is
  // pulled, then tumbles away with it on release.
  const fastener = new THREE.Group();
  fastener.name = "RibbonFastener";
  fastener.position.set(BAND_X, 0.051, VAULT_D / 2 + 0.01);
  group.add(fastener);

  put(fastener, bin.torus(0.0125, 0.0022, 12, 48), goldBrush, "FastenerRing", undefined, [0, Math.PI / 2, 0]);
  put(fastener, bin.cyl(0.0035, 0.0035, 0.031, 24), goldPolish, "FastenerBar", undefined, [0, 0, Math.PI / 2]);
  put(fastener, bin.sphere(0.0042, 24, 16), goldPolish, "FastenerCapL", [-0.0158, 0, 0]);
  put(fastener, bin.sphere(0.0042, 24, 16), goldPolish, "FastenerCapR", [0.0158, 0, 0]);

  // ---- pull tails ----------------------------------------------------------
  const pull = new THREE.Group();
  pull.name = "RibbonPull";
  group.add(pull);

  // Same non-tracking rationale as the band: both tails are regenerated per frame.
  const tailA = new THREE.Mesh(ribbonGeometry(tailPoints(0.042, 1, 0.006), 0.028, TAIL_SEGMENTS), silk);
  tailA.name = "RibbonPullTail";
  pull.add(tailA);
  const tailB = new THREE.Mesh(ribbonGeometry(tailPoints(0.042 * 0.72, -0.55, 0.01), 0.025, TAIL_SEGMENTS), silk);
  tailB.name = "RibbonPullTailB";
  pull.add(tailB);

  const aiglet = put(pull, bin.cyl(0.0038, 0.0034, 0.008, 20), goldBrush, "PullAiglet");

  function setState(draw: number, fall: number, stretch: number): void {
    const d = Math.max(0, Math.min(1, draw));
    const f = Math.max(0, Math.min(1, fall));

    // ---- band shape ------------------------------------------------------
    // `smooth(.42, 1, d)` in the design: the band stays taut for the first 42% of the draw and
    // only then starts taking up slack, which is what makes the beginning of the pull feel like
    // tension rather than immediate looseness.
    const slackT = smoothstep(0.42, 1, d);
    let pts = lerpPts(wrap, slack, slackT);
    if (f > 0) pts = lerpPts(pts, FALLEN_POINTS, f);
    bin.swap(band, ribbonGeometry(pts, BAND_WIDTH * (1 - 0.06 * stretch), BAND_SEGMENTS, f));

    // ---- tails -----------------------------------------------------------
    if (f > 0) {
      // On release the tails shorten as the band slips free, then vanish.
      const len = 0.34 * (1 - f * 0.55);
      const dir = 1.5;
      bin.swap(tailA, ribbonGeometry(tailPoints(len, dir, 0.006), 0.028, TAIL_SEGMENTS));
      bin.swap(tailB, ribbonGeometry(tailPoints(len * 0.72, -dir * 0.55, 0.01), 0.025, TAIL_SEGMENTS));
      const tp = tailPoints(len, dir, 0.006);
      aiglet.position.set(
        lerp(tp[6][0], 0.027, f),
        lerp(tp[6][1], 0.004, f),
        lerp(tp[6][2], 0.16, f)
      );
      // The fastener tumbles off and comes to rest beside the fallen coil.
      fastener.position.set(
        lerp(BAND_X + 0.004, -0.043, easeIn(f)),
        lerp(0.051, 0.006, f * f),
        lerp(VAULT_D / 2 + 0.01, 0.181, easeOut(f))
      );
      fastener.rotation.set(f * 1.4, f * 0.8, -0.22 - f * 0.6);
      pull.visible = f < 0.98;
    } else {
      // During the draw the tails lengthen and swing out as the ribbon feeds through.
      const len = 0.042 + d * 0.3;
      const dir = 1 + d * 0.5;
      bin.swap(tailA, ribbonGeometry(tailPoints(len, dir, 0.006), 0.028, TAIL_SEGMENTS));
      bin.swap(tailB, ribbonGeometry(tailPoints(len * 0.72, -dir * 0.55, 0.01), 0.025, TAIL_SEGMENTS));
      const tp = tailPoints(len, dir, 0.006);
      aiglet.position.set(tp[6][0], tp[6][1] - 0.004, tp[6][2]);
      aiglet.rotation.z = -0.5 - d * 0.5;
      fastener.rotation.set(0, 0, -d * 0.22);
      fastener.position.set(BAND_X + d * 0.004, 0.051, VAULT_D / 2 + 0.01);
      pull.visible = true;
    }

    // Once fully fallen the band itself is hidden — the design does this at the point the sequence
    // takes over, since a coil on the floor adds nothing during the cinematic and costs a
    // 150-segment draw call.
    band.visible = f < 0.999;
  }

  setState(0, 0, 0);

  return {
    group,
    pull,
    setState,
    dispose: () => {
      bin.dispose();
      // The three regenerated geometries are owned by their meshes, not the bin.
      band.geometry.dispose();
      tailA.geometry.dispose();
      tailB.geometry.dispose();
    },
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}
