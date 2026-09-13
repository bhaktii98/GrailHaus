// Ported from project/art-util.js — shared drawing helpers between the
// pack art (vaultArt.ts) and the card art (cardArt.ts), same split as the
// original (art-util.js was imported by both vault-art.js and
// card-art.js). Built on top of ../../reveal/art/canvasHelpers.ts's
// Paint/Path/Shader vocabulary rather than duplicating it — metalFill,
// hairlines, grooveLine, guilloche, microBlock, barcode and embossText are
// the primitives that module didn't need for the (flatter, chrome-not-
// satin) Tier 1 art, ported verbatim in spirit here.
import {
  Skia,
  ClipOp,
  type SkCanvas,
  type SkShader,
} from '@shopify/react-native-skia';
import {
  fillPaint,
  strokePaint,
  linearGradientShader,
  drawTrackedText,
  type GradientStop,
  type TextOptions,
} from '../../reveal/art/canvasHelpers';

/** Vertical brushed-metal gradient shader. `stops` overrides the default
 * champagne ramp so the one helper serves gold, plum, or graphite. */
export function metalShader(y0: number, y1: number, stops?: GradientStop[]): SkShader {
  const ramp: GradientStop[] = stops || [
    [0, '#7d6635'], [0.14, '#e8d3a2'], [0.32, '#fbf0d4'],
    [0.5, '#b99b57'], [0.66, '#e9d5a6'], [0.86, '#8d7440'], [1, '#4a3a1a'],
  ];
  return linearGradientShader(0, y0, 0, y1, ramp);
}

export const GRAPHITE_STOPS: GradientStop[] = [
  [0, '#2c2a33'], [0.3, '#6c6874'], [0.52, '#3a3742'], [0.75, '#5e5a68'], [1, '#1d1b22'],
];

/** Embossed type: a dark bed below, a lit rim above, then the metal face —
 * reads as pressed into the substrate rather than printed on it. */
export function embossText(
  canvas: SkCanvas,
  text: string,
  x: number,
  y: number,
  opts: TextOptions & { depth?: number; bed?: string; rim?: string },
): number {
  const d = opts.depth ?? Math.max(2, opts.size * 0.045);
  drawTrackedText(canvas, text, x + d, y + d * 1.15, { ...opts, fill: opts.bed || 'rgba(0,0,0,0.72)', shader: undefined, stroke: undefined, shadow: undefined });
  drawTrackedText(canvas, text, x - d * 0.6, y - d * 0.7, { ...opts, fill: opts.rim || 'rgba(255,244,214,0.30)', shader: undefined, stroke: undefined, shadow: undefined });
  return drawTrackedText(canvas, text, x, y, opts);
}

/** Micro-engraved hairlines. Very low contrast on purpose: at pack scale
 * this reads as a satin machine finish, not as stripes. `angle` in
 * radians, matching the DOM-canvas original. */
export function hairlines(
  canvas: SkCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { step?: number; angle?: number; alpha?: number; light?: string; dark?: string } = {},
) {
  const { step = 6, angle = -0.42, alpha = 0.05, light = '#ffffff', dark = '#000000' } = opts;
  canvas.save();
  canvas.clipRect(Skia.XYWHRect(x, y, w, h), ClipOp.Intersect, true);
  canvas.translate(x + w / 2, y + h / 2);
  canvas.rotate((angle * 180) / Math.PI, 0, 0);
  const R = Math.hypot(w, h);
  const lightPaint = fillPaint(light);
  lightPaint.setAlphaf(alpha);
  const darkPaint = fillPaint(dark);
  darkPaint.setAlphaf(alpha);
  for (let i = -R; i < R; i += step) {
    canvas.drawRect(Skia.XYWHRect(i, -R, 1, R * 2), lightPaint);
    canvas.drawRect(Skia.XYWHRect(i + step / 2, -R, 1, R * 2), darkPaint);
  }
  canvas.restore();
}

/** Debossed line: a pressed groove (dark) with a lit lower lip. */
export function grooveLine(
  canvas: SkCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  opts: { w?: number; dark?: string; lit?: string } = {},
) {
  const { w = 3, dark = 'rgba(0,0,0,0.6)', lit = 'rgba(255,238,200,0.22)' } = opts;
  const p1 = Skia.Path.Make();
  p1.moveTo(x0, y0);
  p1.lineTo(x1, y1);
  canvas.drawPath(p1, strokePaint(dark, w));
  const p2 = Skia.Path.Make();
  p2.moveTo(x0, y0 + w * 0.7);
  p2.lineTo(x1, y1 + w * 0.7);
  canvas.drawPath(p2, strokePaint(lit, Math.max(1, w * 0.4)));
}

/** Guilloche rosette — the interference-pattern linework used on banknotes
 * and certificates. Pure strokes, so it stays quiet at small sizes. */
export function guilloche(
  canvas: SkCanvas,
  cx: number,
  cy: number,
  opts: {
    r?: number; lobes?: number; ripple?: number; turns?: number; lines?: number;
    stroke?: string; width?: number;
  } = {},
) {
  const {
    r = 200, lobes = 11, ripple = 0.16, turns = 5, lines = 34,
    stroke = 'rgba(232,207,162,0.34)', width = 1,
  } = opts;
  canvas.save();
  canvas.translate(cx, cy);
  const paint = strokePaint(stroke, width);
  for (let l = 0; l < lines; l++) {
    const ph = (l / lines) * Math.PI * 2;
    const path = Skia.Path.Make();
    for (let i = 0; i <= 220; i++) {
      const a = (i / 220) * Math.PI * 2 * turns;
      const rad = r * (1 - ripple + ripple * Math.cos((a * lobes) / turns + ph))
        * (0.55 + 0.45 * Math.cos(a / turns / 2 + ph) ** 2);
      const x = Math.cos(a / turns + ph) * rad;
      const y = Math.sin(a / turns + ph) * rad;
      if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
    }
    canvas.drawPath(path, paint);
  }
  canvas.restore();
}

/** Column of tiny legal/authentication type — texture, not reading matter. */
export function microBlock(
  canvas: SkCanvas,
  x: number,
  y: number,
  w: number,
  rows: number,
  opts: { rowH?: number; alpha?: number; fill?: string } = {},
) {
  const { rowH = 7, alpha = 0.3, fill = '#e8cf9a' } = opts;
  const paint = fillPaint(fill);
  paint.setAlphaf(alpha);
  for (let r = 0; r < rows; r++) {
    let cx = x;
    while (cx < x + w) {
      const wd = 6 + ((r * 13 + cx) % 5) * 4;
      if (cx + wd > x + w) break;
      canvas.drawRect(Skia.XYWHRect(cx, y + r * rowH, wd, 2), paint);
      cx += wd + 4;
    }
  }
}

export function barcode(
  canvas: SkCanvas,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { bg?: string; ink?: string; seed?: number } = {},
) {
  const { bg = '#f4ece0', ink = '#0a0413', seed = 7 } = opts;
  canvas.drawRect(Skia.XYWHRect(x - 4, y - 4, w + 8, h + 8), fillPaint(bg));
  let cx = x;
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const inkPaint = fillPaint(ink);
  while (cx < x + w) {
    const bw = 2 + Math.floor(rnd() * 4);
    canvas.drawRect(Skia.XYWHRect(cx, y, Math.min(bw, x + w - cx), h), inkPaint);
    cx += bw + 2 + Math.floor(rnd() * 3);
  }
}

// Multi-octave 1D noise, shared by the tear edge and the crumple maps —
// re-exported here too (matching art-util.js's own noise1) so art code
// never needs to reach into the engine layer for it.
export function noise1(x: number): number {
  let v = 0, amp = 1, f = 1;
  for (let o = 0; o < 5; o++) {
    v += amp * Math.sin(x * f * 137.13 + o * 2.7) * Math.cos(x * f * 61.7 + o * 1.3);
    amp *= 0.52; f *= 2.13;
  }
  return v * 0.5;
}
