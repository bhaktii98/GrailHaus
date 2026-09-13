// The Reserve's two procedural surface textures — ported from the design handoff's own
// `grainTexture()` and `emblemTexture()` (heritage-case-watch-reveal/project/heritage-case.js,
// lines 10-77).
//
// These are what make the Reserve's case read as a real object rather than a brown box, and they
// are the single largest thing the previous tier-1 implementation left out: `WatchMesh` painted the
// case with a flat hex colour plus an emissive floor, so a walnut presentation case had no grain,
// no figure, and no maker's mark. Wood without grain reads as plastic at any lighting quality.
//
// Both are drawn on Skia's offscreen surface and handed to three.js as a DataTexture — the
// substitute for the prototype's DOM canvas that the card pack reveal established. See
// ../../../cards/reveal/art/canvasHelpers.ts.
//
// Unlike the environment map (../art/reserveEnv.ts), these are ordinary colour maps sampled
// through mesh UVs, so they keep `makeDataTexture`'s default `flipY = true` — that default exists
// precisely to match DOM CanvasTexture behaviour, which is what the source assumed.
import * as THREE from "three";
import { Skia, TileMode, PaintStyle } from "@shopify/react-native-skia";
import {
  makeSurface,
  fillPaint,
  strokePaint,
  drawTrackedText,
} from "../../../cards/reveal/art/canvasHelpers";
import { makeDataTexture } from "../../../cards/reveal/engine/textures";

/**
 * Deterministic pseudo-random source.
 *
 * The source calls `Math.random()` ~2,700 times while drawing the grain, which would give every
 * mount a different case. That is fine for a design prototype refreshed by hand, and wrong here:
 * a user who backgrounds the app mid-reveal and returns should see the same case, and a texture
 * that changes per mount also makes visual regressions impossible to spot. Seeded so the grain is
 * fixed art — chosen for how it looks, not re-rolled per session.
 *
 * mulberry32: small, fast, and good enough for texture noise.
 */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRAIN_SIZE = 1024;
// The source draws 900 grain strokes and 14 knots at 1024px. Kept at full count: these run once at
// mount on the CPU, not per frame, and thinning them is what turns convincing figure into visible
// stripes. The cost is a single ~40ms texture bake during the reveal's own intro, which is already
// dead time.
const GRAIN_STROKES = 900;
const GRAIN_KNOTS = 14;

/**
 * Walnut grain: long wavy strokes in two tones over a warm brown ground, plus a handful of
 * elliptical knots. Repeated 2x2 across the case (the source's own `repeat.set(2, 2)`), so the
 * figure reads at the right physical scale on a 176mm case rather than as one giant swirl.
 */
export function grainTexture(): THREE.DataTexture {
  const S = GRAIN_SIZE;
  const surf = makeSurface(S, S);
  const { canvas } = surf;
  const rnd = seededRandom(0x9a11e7);

  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), fillPaint("#3a2118"));

  for (let i = 0; i < GRAIN_STROKES; i++) {
    const y = rnd() * S;
    const w = 0.4 + rnd() * 1.6;
    const a = 0.02 + rnd() * 0.07;
    // Two tones alternating: a dark line and a lighter one, which is what gives walnut its
    // characteristic banded figure rather than uniform streaking.
    const darker = rnd() > 0.45;
    const colour = darker ? `rgba(20,10,6,${a})` : `rgba(140,96,58,${a * 0.8})`;
    const paint = strokePaint(colour, w);
    const path = Skia.Path.Make();
    path.moveTo(0, y);
    const amp = 6 + rnd() * 22;
    const phase = rnd();
    // Sampled every 32px exactly as the source does — a coarse enough step that the strokes read
    // as gently wavering grain rather than smooth sine waves.
    for (let px = 0; px <= S; px += 32) {
      path.lineTo(px, y + Math.sin((px / S) * Math.PI * (1 + phase) + i) * amp * 0.25);
    }
    canvas.drawPath(path, paint);
  }

  for (let i = 0; i < GRAIN_KNOTS; i++) {
    const cx = rnd() * S;
    const cy = rnd() * S;
    const r = 40 + rnd() * 90;
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(cx, cy),
        r,
        [Skia.Color("rgba(24,12,7,0.35)"), Skia.Color("rgba(24,12,7,0)")],
        [0, 1],
        TileMode.Clamp,
      ),
    );
    // The source draws a rotated ellipse (60x22). Skia has no one-call rotated-ellipse fill, so
    // this saves the canvas, rotates about the knot's own centre, draws an axis-aligned oval, and
    // restores — geometrically identical.
    const rot = rnd();
    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate((rot * 180) / Math.PI, 0, 0);
    canvas.drawOval(Skia.XYWHRect(-60, -22, 120, 44), paint);
    canvas.restore();
  }

  const tex = makeDataTexture({ data: surf.toRGBA(), width: S, height: S });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.name = "walnut-grain";
  tex.needsUpdate = true;
  return tex;
}

const EMBLEM_SIZE = 512;

/**
 * The maker's medallion on the lid: a brass plate with two engraved rings, "GH" and a "GRAILHAUS"
 * wordmark under a rule.
 *
 * This is the one place the Reserve gets real lettering, and it is worth noting why that is now
 * possible. `WatchMesh` deliberately avoided 3D text — its comments cite `@react-three/drei`'s
 * `Text` needing troika-three-text and a browser canvas — and substituted an abstract
 * diamond-and-bar mark. That reasoning was sound for *geometry*, but the constraint never applied
 * to a baked texture: Skia draws text natively, and `drawTrackedText` (built for the card pack's
 * own baked art) already handles the letter-spacing this design specifies. So the wordmark the
 * design actually asks for is drawable after all, as pixels rather than glyph meshes.
 */
export function emblemTexture(): THREE.DataTexture {
  const S = EMBLEM_SIZE;
  const surf = makeSurface(S, S);
  const { canvas } = surf;

  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), fillPaint("#a87f3e"));

  // Two concentric engraved rings.
  const outer = strokePaint("rgba(48,32,12,0.85)", 5);
  canvas.drawCircle(256, 256, 196, outer);
  const inner = strokePaint("rgba(48,32,12,0.85)", 2);
  canvas.drawCircle(256, 256, 178, inner);

  const ink = "rgba(30,18,6,0.95)";
  // "GH" — the source uses 118px bold mono with 18px tracking, baseline-middle at y=214.
  // drawTrackedText centres horizontally on the x it is given and treats y as the baseline, so the
  // y is offset by roughly a third of the cap height to match a middle-aligned original.
  drawTrackedText(canvas, "GH", 256, 214 + 40, {
    size: 118,
    mono: true,
    bold: true,
    letterSpacing: 18,
    align: "center",
    fill: ink,
  });

  // The rule between mark and wordmark (the source's own fillRect).
  canvas.drawRect(Skia.XYWHRect(140, 288, 232, 4), fillPaint(ink));

  // "GRAILHAUS" — 42px with 12px tracking, under the rule.
  drawTrackedText(canvas, "GRAILHAUS", 256, 336 + 14, {
    size: 42,
    mono: true,
    letterSpacing: 12,
    align: "center",
    fill: ink,
  });

  const tex = makeDataTexture({ data: surf.toRGBA(), width: S, height: S });
  tex.name = "emblem-engraving";
  tex.needsUpdate = true;
  return tex;
}

/**
 * Dial face art for one watch — ported from `watch-builder.js`'s own `dialTexture()` (lines
 * 38-141).
 *
 * The dial is where a watch either looks real or looks like a coloured disc, and it is the other
 * major omission of the previous tier-1 build: a 60-tick minute track, applied-index geometry and
 * a sunburst sheen are what the eye reads as "a watch face". `WatchMesh` had a flat cylinder with
 * two hands.
 *
 * `variant` selects the ground treatment, exactly as the source's `spec.dialTexture` does:
 *   sunburst — 240 alternating light/dark rays from the centre, the classic soleil finish
 *   birch    — vertical wavering fibres (Grand Seiko's "White Birch" dial)
 *   matte    — a plain radial vignette, for chronographs
 */
export type DialVariant = "sunburst" | "birch" | "matte";

export interface DialTextureSpec {
  variant: DialVariant;
  /** Dial colour as a hex string, e.g. "#14161a". */
  colorHex: string;
  /** True when the dial is light enough that furniture must be drawn dark rather than light. */
  lightDial: boolean;
  /** Three chronograph registers. */
  subdials: boolean;
  /** Roman numerals at 12/3/6/9 instead of applied indices. */
  romanIndices: boolean;
  /** A date aperture at 3 o'clock. */
  dateWindow: boolean;
}

const DIAL_SIZE = 1024;

export function dialTexture(spec: DialTextureSpec): THREE.DataTexture {
  const S = DIAL_SIZE;
  const surf = makeSurface(S, S);
  const { canvas } = surf;
  const rnd = seededRandom(0x51a17e);

  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), fillPaint(spec.colorHex));

  if (spec.variant === "sunburst") {
    // 240 rays alternating light/dark. Drawn from an inner radius outward so the very centre stays
    // clean under the hands' pinion.
    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * Math.PI * 2;
      const paint = strokePaint(i % 2 ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.10)", 1.4);
      const path = Skia.Path.Make();
      path.moveTo(S / 2 + Math.cos(a) * S * 0.16, S / 2 + Math.sin(a) * S * 0.16);
      path.lineTo(S / 2 + Math.cos(a) * S, S / 2 + Math.sin(a) * S);
      canvas.drawPath(path, paint);
    }
    const vig = Skia.Paint();
    vig.setAntiAlias(true);
    vig.setStyle(PaintStyle.Fill);
    vig.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(S / 2, S / 2),
        S / 2,
        [
          Skia.Color("rgba(255,255,255,0.02)"),
          Skia.Color("rgba(0,0,0,0)"),
          Skia.Color("rgba(0,0,0,0.3)"),
        ],
        [0.2, 0.72, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(Skia.XYWHRect(0, 0, S, S), vig);
  } else if (spec.variant === "birch") {
    for (let i = 0; i < 150; i++) {
      const px = (i / 150) * S;
      const paint = strokePaint(`rgba(120,132,140,${0.05 + rnd() * 0.13})`, 1 + rnd() * 4);
      const path = Skia.Path.Make();
      path.moveTo(px, 0);
      for (let py = 0; py <= S; py += 48) path.lineTo(px + Math.sin(py / 90 + i) * 9, py);
      canvas.drawPath(path, paint);
    }
  } else {
    const g = Skia.Paint();
    g.setAntiAlias(true);
    g.setStyle(PaintStyle.Fill);
    g.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(S / 2, S / 2),
        S / 2,
        [Skia.Color("rgba(255,255,255,0.05)"), Skia.Color("rgba(0,0,0,0.22)")],
        [0.08, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(Skia.XYWHRect(0, 0, S, S), g);
  }

  // Furniture colour flips with dial lightness, exactly as the source's own `light` check does —
  // this is what keeps a silver dial's markings legible without a second texture path.
  const inkBase = spec.lightDial ? "26,28,32" : "236,238,240";
  const cx = S / 2;
  const cy = S / 2;
  const R = S / 2;

  // Chronograph registers, drawn before the minute track so the track overlays them cleanly.
  if (spec.subdials) {
    const offsets: [number, number][] = [
      [0, 0.52],
      [-0.52, 0],
      [0.52, 0],
    ];
    for (const [ox, oy] of offsets) {
      const sx = cx + ox * R * 0.62;
      const sy = cy + oy * R * 0.62;
      const sr = R * 0.215;
      canvas.drawCircle(
        sx,
        sy,
        sr,
        fillPaint(spec.lightDial ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.06)"),
      );
      canvas.drawCircle(sx, sy, sr, strokePaint(`rgba(${inkBase},0.4)`, 2));
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const paint = strokePaint(`rgba(${inkBase},${k % 3 ? 0.35 : 0.75})`, k % 3 ? 2 : 3.5);
        const path = Skia.Path.Make();
        path.moveTo(sx + Math.cos(a) * sr * 0.78, sy + Math.sin(a) * sr * 0.78);
        path.lineTo(sx + Math.cos(a) * sr * 0.94, sy + Math.sin(a) * sr * 0.94);
        canvas.drawPath(path, paint);
      }
    }
  }

  // The 60-tick minute track — every fifth tick longer and brighter.
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const long = i % 5 === 0;
    const paint = strokePaint(`rgba(${inkBase},${long ? 0.85 : 0.42})`, long ? 5 : 2.4);
    const r0 = R * 0.855;
    const r1 = R * (long ? 0.91 : 0.895);
    const path = Skia.Path.Make();
    path.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    path.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    canvas.drawPath(path, paint);
  }

  if (spec.romanIndices) {
    const numerals = ["XII", "III", "VI", "IX"];
    numerals.forEach((n, i) => {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      drawTrackedText(canvas, n, cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7 + 26, {
        size: 78,
        align: "center",
        fill: `rgba(${inkBase},0.92)`,
      });
    });
  }

  if (spec.dateWindow) {
    const wx = cx + R * 0.66;
    const wy = cy;
    canvas.drawRect(
      Skia.XYWHRect(wx - R * 0.085, wy - R * 0.062, R * 0.17, R * 0.124),
      fillPaint(spec.lightDial ? "#1c1e22" : "#eceef0"),
    );
    // A real numeral, for the same reason the emblem gets real lettering: Skia can draw text even
    // though 3D glyph geometry was off the table.
    drawTrackedText(canvas, "28", wx, wy + 20, {
      size: 52,
      mono: true,
      align: "center",
      fill: spec.lightDial ? "#eceef0" : "#1c1e22",
    });
  }

  const tex = makeDataTexture({ data: surf.toRGBA(), width: S, height: S });
  tex.center.set(0.5, 0.5);
  tex.name = "reserve-dial";
  tex.needsUpdate = true;
  return tex;
}

/**
 * The rotating-bezel insert for a diver — ported from `watch-builder.js`'s
 * `bezelInsertTexture()` (lines 143-165). A coloured ring carrying a 60-minute scale.
 */
export function bezelInsertTexture(colorHex: string): THREE.DataTexture {
  const S = 512;
  const surf = makeSurface(S, S);
  const { canvas } = surf;

  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), fillPaint(colorHex));

  canvas.save();
  canvas.translate(S / 2, S / 2);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const long = i % 5 === 0;
    const paint = strokePaint(`rgba(238,238,232,${long ? 0.9 : 0.45})`, long ? 7 : 3);
    const path = Skia.Path.Make();
    path.moveTo(Math.cos(a) * S * 0.36, Math.sin(a) * S * 0.36);
    path.lineTo(Math.cos(a) * S * (long ? 0.46 : 0.44), Math.sin(a) * S * (long ? 0.46 : 0.44));
    canvas.drawPath(path, paint);
  }
  canvas.restore();

  const tex = makeDataTexture({ data: surf.toRGBA(), width: S, height: S });
  tex.name = "reserve-bezel-insert";
  tex.needsUpdate = true;
  return tex;
}
