// Tier 3 "Black Label" pack artwork — ported from the actual Claude Design handoff
// (apex-art.js, from the grailhaus-vault-break.html "Black Label" canvas), not the invented
// bronze-on-onyx palette an earlier pass here used before the real design was available. Obsidian
// black foil with a quilted diamond lattice whose seams run molten (gold hairline engraving,
// live heat glowing through the pressed grooves), an eight-point "apex" diamond mark in place of
// Vault Break's octagon medallion, and an ember thread along the tear channel. Same construction
// approach as ../../vaultReveal/art/vaultArt.ts (Skia offscreen canvas, `s = width/DESIGN_W`
// scaling) but NOT a palette substitution of it this time — this is its own design, ported
// function-for-function from the real source.
//
// Two simplifications versus the DOM canvas original, both about two-point (start-circle +
// end-circle) radial gradients Skia's simple MakeRadialGradient can't express directly:
// obsidianBase's sheen and apexMark's well both use a slightly offset/sized start circle in the
// original (`createRadialGradient(x0,y0,r0,x1,y1,r1)` with r0>0 and/or (x0,y0)!=(x1,y1)). The
// true fix is Skia's MakeTwoPointConicalGradient; given how subtle the resulting asymmetry is at
// this element's size (a few percent of the gradient's own radius), this port uses a single-circle
// MakeRadialGradient centered at the more visually significant point instead — noted here rather
// than left silent, and worth revisiting with MakeTwoPointConicalGradient if a reviewer sees a
// visible difference against the original.
import {
  Skia,
  ClipOp,
  BlendMode,
  TileMode,
  PaintStyle,
  StrokeCap,
  BlurStyle,
  type SkCanvas,
  type SkImage,
  type SkPaint,
} from "@shopify/react-native-skia";
import {
  makeSurface,
  fillPaint,
  strokePaint,
  linearGradientPaint,
  roundRectPath,
  drawTrackedText,
} from "../../reveal/art/canvasHelpers";
import {
  metalShader,
  embossText,
  hairlines,
  grooveLine,
  guilloche,
  microBlock,
  barcode,
  noise1,
} from "../../vaultReveal/art/artUtil";
import type { GradientStop } from "../../reveal/art/canvasHelpers";

export interface PixelImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export const SEAM_FRAC = 0.232;
export const FLAP_FRAC = 0.078;
const DESIGN_W = 800;
const TEETH = 18;

const IVORY = "#f2ece2";
const GOLD = "#d8b877";
const INK = "#04040a";

const GOLD_STOPS: GradientStop[] = [
  [0, "#4a381a"], [0.16, "#c9a86a"], [0.34, "#f7e6bd"],
  [0.5, "#a5854a"], [0.68, "#e2caa0"], [0.86, "#7a5f30"], [1, "#332510"],
];
const goldShader = (y0: number, y1: number) => metalShader(y0, y1, GOLD_STOPS);

/** A stroke paint with a soft additive-feeling glow — Skia stand-in for `ctx.shadowBlur` on a
 * stroked path (no direct equivalent; a blurred mask filter on the same paint reads the same at
 * this scale). */
function glowStroke(color: string, width: number, blur: number): SkPaint {
  const p = strokePaint(color, width);
  p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, blur, true));
  return p;
}

function silhouettePath(w: number, h: number, toothDepth: number) {
  const path = Skia.Path.Make();
  const seg = w / TEETH;
  path.moveTo(0, toothDepth);
  for (let i = 0; i < TEETH; i++) {
    path.lineTo(i * seg + seg / 2, 0);
    path.lineTo((i + 1) * seg, toothDepth);
  }
  path.lineTo(w, h - toothDepth);
  for (let i = TEETH; i > 0; i--) {
    path.lineTo(i * seg - seg / 2, h);
    path.lineTo((i - 1) * seg, h - toothDepth);
  }
  path.close();
  return path;
}

// Obsidian substrate with a quilted diamond lattice: the facet seams are where the pack's
// contained heat shows through, so the linework is molten gold rather than printed gold.
function obsidianBase(canvas: SkCanvas, w: number, h: number, s: number) {
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), linearGradientPaint(0, 0, w, 0, [
    [0, "#08080c"], [0.1, "#111118"], [0.26, "#1c1c24"], [0.4, "#28282f"],
    [0.5, "#2e2e38"], [0.6, "#22222a"], [0.78, "#15151c"], [1, "#07070a"],
  ]));
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), linearGradientPaint(0, 0, 0, h, [
    [0, "rgba(255,232,200,0.08)"], [0.2, "rgba(0,0,0,0)"], [0.6, "rgba(0,0,0,0.2)"],
    [1, "rgba(0,0,0,0.66)"],
  ]));

  // warm bounce from the fire the pack sits in
  ([[0, h], [w, h * 0.86], [w * 0.5, h * 1.04]] as const).forEach(([cx, cy], i) => {
    const paint = Skia.Paint();
    paint.setShader(Skia.Shader.MakeRadialGradient(
      Skia.Point(cx, cy), w * (0.62 - i * 0.08),
      [Skia.Color(`rgba(255,${118 + i * 20},40,${0.16 - i * 0.03})`), Skia.Color("rgba(0,0,0,0)")],
      null, TileMode.Clamp
    ));
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
  });

  // quilted lattice
  const step = 104 * s;
  canvas.save();
  for (let d = -h; d < w + h; d += step) {
    ([1, -1] as const).forEach((sy) => {
      const x0 = d, y0 = sy > 0 ? 0 : h, x1 = d + h, y1 = sy > 0 ? h : 0;
      const groove = Skia.Path.Make();
      groove.moveTo(x0, y0); groove.lineTo(x1, y1);
      const groovePaint = strokePaint("rgba(0,0,0,0.55)", 3.4 * s);
      groovePaint.setStrokeCap(StrokeCap.Round);
      canvas.drawPath(groove, groovePaint);
      const thread = Skia.Path.Make();
      thread.moveTo(x0 + 1, y0); thread.lineTo(x1 + 1, y1);
      const threadPaint = strokePaint("rgba(216,184,119,0.34)", 1.2 * s);
      threadPaint.setStrokeCap(StrokeCap.Round);
      canvas.drawPath(thread, threadPaint);

      // molten segments: heat leaking along the seam, denser toward the foot
      const segs = 30;
      for (let seg = 0; seg < segs; seg++) {
        const t0 = seg / segs, t1 = (seg + 0.7) / segs;
        const n = noise1(d * 0.013 + seg * 1.7 + (sy > 0 ? 0 : 9.1));
        const depth = 0.42 + 0.58 * t0;
        const a = Math.max(0, n * 1.35) * depth;
        if (a < 0.05) continue;
        const ax0 = x0 + (x1 - x0) * t0, ay0 = y0 + (y1 - y0) * t0;
        const ax1 = x0 + (x1 - x0) * t1, ay1 = y0 + (y1 - y0) * t1;
        const seam = Skia.Path.Make();
        seam.moveTo(ax0, ay0); seam.lineTo(ax1, ay1);
        const emberPaint = glowStroke(
          `rgba(255,${140 + Math.floor(n * 70)},${52 + Math.floor(n * 50)},${Math.min(1, a)})`,
          (2.4 + a * 3.2) * s, (18 + a * 30) * s * 0.5
        );
        emberPaint.setStrokeCap(StrokeCap.Round);
        canvas.drawPath(seam, emberPaint);
        if (a > 0.5) {
          const hotPaint = strokePaint(`rgba(255,246,222,${Math.min(0.95, (a - 0.5) * 1.8)})`, 1.2 * s);
          hotPaint.setStrokeCap(StrokeCap.Round);
          canvas.drawPath(seam, hotPaint);
        }
      }
    });
  }
  canvas.restore();

  hairlines(canvas, 0, 0, w, h, { step: 4 * s, angle: -0.36, alpha: 0.035 });

  // warm sheen over the whole sheet: the foil is standing in firelight — see this file's header
  // for why this is a single-circle approximation of the original's two-point gradient.
  const sheenPaint = Skia.Paint();
  sheenPaint.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(w * 0.5, h * 0.9), h * 0.85,
    [Skia.Color("rgba(255,132,46,0.22)"), Skia.Color("rgba(255,120,40,0.08)"), Skia.Color("rgba(255,120,40,0)")],
    [0, 0.5, 1], TileMode.Clamp
  ));
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), sheenPaint);

  ([[0, 0], [w, 0], [0, h], [w, h]] as const).forEach(([cx, cy]) => {
    const paint = Skia.Paint();
    paint.setShader(Skia.Shader.MakeRadialGradient(
      Skia.Point(cx, cy), w * 0.46,
      [Skia.Color("rgba(0,0,0,0.5)"), Skia.Color("rgba(0,0,0,0)")],
      null, TileMode.Clamp
    ));
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
  });
}

// Pressed panel with chamfered corners — structure for the lower half.
function pressedPanel(canvas: SkCanvas, x: number, y: number, w: number, h: number, s: number) {
  const k = 44 * s;
  const path = (inset: number) => {
    const a = x + inset, b = y + inset, c = x + w - inset, d = y + h - inset;
    const kk = k * (1 - inset / (w * 0.5));
    const p = Skia.Path.Make();
    p.moveTo(a + kk, b); p.lineTo(c - kk, b); p.lineTo(c, b + kk);
    p.lineTo(c, d - kk); p.lineTo(c - kk, d); p.lineTo(a + kk, d);
    p.lineTo(a, d - kk); p.lineTo(a, b + kk); p.close();
    return p;
  };
  canvas.drawPath(path(0), fillPaint("rgba(0,0,0,0.5)"));
  ([0, 13 * s, 28 * s] as const).forEach((inset, n) => {
    canvas.drawPath(path(inset), strokePaint(n === 0 ? "rgba(0,0,0,0.66)" : `rgba(216,184,119,${0.15 - n * 0.042})`, n === 0 ? 5 * s : 1.3 * s));
    if (n === 0) {
      canvas.save();
      canvas.translate(0, 3 * s);
      canvas.drawPath(path(inset), strokePaint("rgba(255,236,198,0.12)", 2 * s));
      canvas.restore();
    }
  });
}

function crimpBand(canvas: SkCanvas, w: number, y0: number, y1: number, top: boolean, s: number) {
  const h = y1 - y0;
  canvas.drawRect(Skia.XYWHRect(0, y0, w, h), linearGradientPaint(0, y0, 0, y1, top
    ? [[0, "#3c3c46"], [0.26, "#1d1d25"], [0.62, "#0c0c12"], [1, "#030307"]]
    : [[0, "#030307"], [0.4, "#0c0c12"], [0.76, "#1d1d25"], [1, "#3c3c46"]]));
  const lightP = fillPaint("rgba(255,240,214,0.18)");
  const darkP = fillPaint("rgba(0,0,0,0.62)");
  for (let x = 0; x < w; x += 8 * s) {
    canvas.drawRect(Skia.XYWHRect(x, y0, 3 * s, h), lightP);
    canvas.drawRect(Skia.XYWHRect(x + 4 * s, y0, 3 * s, h), darkP);
  }
  const ty = top ? y1 - h * 0.3 : y0 + h * 0.2;
  canvas.drawRect(Skia.XYWHRect(0, ty, w, 2 * s), fillPaint("rgba(216,184,119,0.42)"));
  canvas.drawRect(Skia.XYWHRect(0, top ? y0 : y1 - 3 * s, w, 3 * s), fillPaint("rgba(255,255,255,0.3)"));
  canvas.drawRect(Skia.XYWHRect(0, top ? y1 - 7 * s : y0, w, 7 * s), fillPaint("rgba(0,0,0,0.78)"));
}

// Tear channel with an ember thread: a printed molten line inside the groove, so the seam
// already suggests what is sealed inside.
function tearChannel(canvas: SkCanvas, w: number, seam: number, s: number) {
  const y = seam - 16 * s;
  canvas.drawRect(Skia.XYWHRect(0, y - 30 * s, w, 52 * s), linearGradientPaint(0, y - 30 * s, 0, y + 22 * s, [
    [0, "rgba(0,0,0,0)"], [0.42, "rgba(0,0,0,0.62)"], [1, "rgba(0,0,0,0)"],
  ]));
  grooveLine(canvas, 30 * s, y, w - 30 * s, y, { w: 8 * s, dark: "rgba(0,0,0,0.8)", lit: "rgba(255,232,190,0.16)" });

  const emberPaint = fillPaint("#000000");
  for (let x = 44 * s; x < w - 44 * s; x += 6 * s) {
    const n = noise1(x * 0.06 / s);
    const a = Math.max(0, 0.16 + n * 0.5);
    emberPaint.setColor(Skia.Color(`rgba(255,${120 + Math.floor(n * 60)},40,${Math.min(0.72, a)})`));
    canvas.drawRect(Skia.XYWHRect(x, y - 1 * s + n * 1.4 * s, 4 * s, 2 * s), emberPaint);
  }
  const hairA = Skia.Path.Make();
  hairA.moveTo(30 * s, y - 12 * s); hairA.lineTo(w - 30 * s, y - 12 * s);
  canvas.drawPath(hairA, strokePaint("rgba(216,184,119,0.26)", 1 * s));
  const hairB = Skia.Path.Make();
  hairB.moveTo(30 * s, y + 12 * s); hairB.lineTo(w - 30 * s, y + 12 * s);
  canvas.drawPath(hairB, strokePaint("rgba(216,184,119,0.26)", 1 * s));

  ([[44 * s, false], [w - 44 * s, true]] as const).forEach(([x, right]) => {
    drawTrackedText(canvas, "TEAR", x, y - 24 * s, {
      size: 12 * s, bold: true, mono: true, letterSpacing: 4 * s,
      fill: "rgba(216,184,119,0.6)", align: right ? "right" : "left",
    });
    const arrow = Skia.Path.Make();
    arrow.moveTo(right ? x + 2 * s : x - 2 * s, y - 6 * s);
    arrow.lineTo(right ? x - 12 * s : x + 12 * s, y);
    arrow.lineTo(right ? x + 2 * s : x - 2 * s, y + 6 * s);
    canvas.drawPath(arrow, strokePaint("rgba(216,184,119,0.46)", 2 * s));
  });
}

// Faceted apex mark: an eight-point diamond set in a pressed well, gold-edged.
function apexMark(canvas: SkCanvas, cx: number, cy: number, R: number, logo: SkImage | null) {
  canvas.save();
  canvas.translate(cx, cy);

  // see this file's header re: two-point-gradient simplification
  const well = Skia.Paint();
  well.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(0, 0), R * 1.14,
    [Skia.Color("rgba(38,32,26,0.9)"), Skia.Color("rgba(10,9,12,0.94)"), Skia.Color("rgba(2,2,5,0.96)")],
    [0, 0.6, 1], TileMode.Clamp
  ));
  canvas.drawCircle(0, 0, R * 1.14, well);

  ([1.0, 0.87, 0.73] as const).forEach((k, i) => {
    canvas.drawCircle(0, 0, R * k, strokePaint("rgba(0,0,0,0.66)", 8 - i * 2));
    canvas.drawArc(
      Skia.XYWHRect(-R * k, -R * k, R * k * 2, R * k * 2),
      1.05 * 180, 0.9 * 180, false,
      strokePaint(`rgba(216,184,119,${0.46 - i * 0.1})`, 3 - i * 0.6)
    );
  });

  const dia = (rad: number) => {
    const p = Skia.Path.Make();
    p.moveTo(0, -rad); p.lineTo(rad * 0.62, 0);
    p.lineTo(0, rad); p.lineTo(-rad * 0.62, 0);
    p.close();
    return p;
  };
  canvas.drawPath(dia(R * 0.68), fillPaint("rgba(6,6,11,0.8)"));
  canvas.drawPath(dia(R * 0.68), strokePaint("rgba(0,0,0,0.8)", 7));
  const diaGold = Skia.Paint();
  diaGold.setStyle(PaintStyle.Stroke);
  diaGold.setStrokeWidth(3.2);
  diaGold.setAntiAlias(true);
  diaGold.setShader(goldShader(-R * 0.68, R * 0.68));
  canvas.drawPath(dia(R * 0.68), diaGold);
  canvas.drawPath(dia(R * 0.5), strokePaint("rgba(216,184,119,0.3)", 1.2));

  const facetA = Skia.Path.Make();
  facetA.moveTo(0, -R * 0.68); facetA.lineTo(0, R * 0.68);
  canvas.drawPath(facetA, strokePaint("rgba(216,184,119,0.2)", 1));
  const facetB = Skia.Path.Make();
  facetB.moveTo(-R * 0.42, 0); facetB.lineTo(R * 0.42, 0);
  canvas.drawPath(facetB, strokePaint("rgba(216,184,119,0.2)", 1));

  if (logo) {
    const sSize = R * 0.86;
    canvas.save();
    canvas.clipPath(dia(R * 0.66), ClipOp.Intersect, true);
    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);
    imgPaint.setAlphaf(0.94);
    canvas.drawImageRect(
      logo,
      Skia.XYWHRect(0, 0, logo.width(), logo.height()),
      Skia.XYWHRect(-sSize / 2, -sSize / 2, sSize, sSize),
      imgPaint,
      true
    );
    canvas.restore();
  } else {
    canvas.drawPath(dia(R * 0.3), (() => {
      const p = Skia.Paint();
      p.setShader(goldShader(-R * 0.3, R * 0.3));
      return p;
    })());
  }
  canvas.restore();
}

function editionPlate(canvas: SkCanvas, cx: number, cy: number, w: number, h: number, label: string) {
  const x = cx - w / 2, y = cy - h / 2, k = 20;
  const shape = (inset: number) => {
    const a = x + inset, b = y + inset, c = x + w - inset, d = y + h - inset;
    const p = Skia.Path.Make();
    p.moveTo(a + k, b); p.lineTo(c - k, b); p.lineTo(c, b + k);
    p.lineTo(c, d - k); p.lineTo(c - k, d); p.lineTo(a + k, d);
    p.lineTo(a, d - k); p.lineTo(a, b + k); p.close();
    return p;
  };
  canvas.drawPath(shape(-6), fillPaint("rgba(0,0,0,0.62)"));
  canvas.drawPath(shape(0), linearGradientPaint(0, y, 0, y + h, [
    [0, "#15151c"], [0.5, "#08080d"], [1, "#131319"],
  ]));
  canvas.save();
  canvas.clipPath(shape(0), ClipOp.Intersect, true);
  hairlines(canvas, x, y, w, h, { step: 5, angle: -0.28, alpha: 0.05 });
  canvas.restore();
  const strokeP = Skia.Paint();
  strokeP.setStyle(PaintStyle.Stroke);
  strokeP.setAntiAlias(true);
  strokeP.setStrokeWidth(3);
  strokeP.setShader(goldShader(y, y + h));
  canvas.drawPath(shape(0), strokeP);
  canvas.drawPath(shape(9), strokePaint("rgba(216,184,119,0.2)", 1.1));

  embossText(canvas, label, cx, cy + h * 0.19, {
    size: h * 0.36, bold: true, letterSpacing: 9, shader: goldShader(cy - h * 0.3, cy + h * 0.24),
    depth: 2.4, bed: "rgba(0,0,0,0.88)", rim: "rgba(255,238,206,0.22)",
  });
}

export interface BlackLabelFaceInput {
  width: number;
  height: number;
  seamFrac: number;
  flapFrac: number;
  logo?: SkImage | null;
}

export function drawFront(input: BlackLabelFaceInput): PixelImage {
  const { width: W, height: H, seamFrac, flapFrac, logo } = input;
  const s = W / DESIGN_W;
  const surf = makeSurface(W, H);
  const { canvas } = surf;

  canvas.save();
  canvas.clipPath(silhouettePath(W, H, 32 * s), ClipOp.Intersect, true);
  obsidianBase(canvas, W, H, s);

  const flap = H * flapFrac, seam = H * seamFrac;
  pressedPanel(canvas, 38 * s, seam + 26 * s, W - 76 * s, H - seam - flap - 62 * s, s);

  embossText(canvas, "GRAILHAUS", W / 2, 132 * s, {
    size: 52 * s, bold: true, letterSpacing: 9 * s, shader: goldShader(92 * s, 138 * s),
    depth: 2.4 * s, bed: "rgba(0,0,0,0.85)", rim: "rgba(255,238,206,0.22)",
  });
  drawTrackedText(canvas, "TRADING CARDS", W / 2, 162 * s, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 8 * s, fill: "rgba(242,236,226,0.6)",
  });
  const ruleA = Skia.Path.Make();
  ruleA.moveTo(W / 2 - 156 * s, 188 * s); ruleA.lineTo(W / 2 - 58 * s, 188 * s);
  canvas.drawPath(ruleA, strokePaint("rgba(216,184,119,0.32)", 1 * s));
  const ruleB = Skia.Path.Make();
  ruleB.moveTo(W / 2 + 58 * s, 188 * s); ruleB.lineTo(W / 2 + 156 * s, 188 * s);
  canvas.drawPath(ruleB, strokePaint("rgba(216,184,119,0.32)", 1 * s));
  drawTrackedText(canvas, "SERIES I", W / 2, 194 * s, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 6 * s, fill: GOLD,
  });

  const bw = 92 * s, bh = 38 * s, bx = W - 34 * s - bw, by = 86 * s;
  const badge = roundRectPath(bx, by, bw, bh, 5 * s);
  canvas.drawPath(badge, fillPaint("rgba(4,4,9,0.92)"));
  const badgeStroke = Skia.Paint();
  badgeStroke.setStyle(PaintStyle.Stroke); badgeStroke.setAntiAlias(true); badgeStroke.setStrokeWidth(2 * s);
  badgeStroke.setShader(goldShader(by, by + bh));
  canvas.drawPath(badge, badgeStroke);
  canvas.drawPath(roundRectPath(bx + 5 * s, by + 5 * s, bw - 10 * s, bh - 10 * s, 3 * s), strokePaint("rgba(216,184,119,0.2)", 1 * s));
  drawTrackedText(canvas, "A·1", bx + bw / 2, by + 27 * s, {
    size: 21 * s, bold: true, letterSpacing: 1 * s, shader: goldShader(by + 6 * s, by + 34 * s),
  });

  ["THE", "RAREST", "STORIES"].forEach((l, i) => drawTrackedText(canvas, l, 30 * s, (238 + i * 20) * s, {
    size: 11 * s, bold: true, mono: true, letterSpacing: 3 * s, fill: "rgba(216,184,119,0.42)", align: "left",
  }));
  ["LIVE", "HERE", "—"].forEach((l, i) => drawTrackedText(canvas, l, W - 30 * s, (238 + i * 20) * s, {
    size: 11 * s, bold: true, mono: true, letterSpacing: 3 * s, fill: "rgba(216,184,119,0.42)", align: "right",
  }));

  apexMark(canvas, W / 2, seam + 292 * s, 224 * s, logo ?? null);
  editionPlate(canvas, W / 2, seam + 588 * s, 520 * s, 96 * s, "BLACK LABEL");
  drawTrackedText(canvas, "COLLECTIBLE CARDS", W / 2, seam + 664 * s, {
    size: 14 * s, bold: true, mono: true, letterSpacing: 8 * s, fill: "rgba(242,236,226,0.5)",
  });

  const ly = seam + 712 * s;
  ([["CORE", 0.42, -150], ["PRIME", 0.58, 0], ["GRAIL", 0.95, 150]] as const).forEach(([l, a, dx]) => {
    drawTrackedText(canvas, l, W / 2 + dx * s, ly, {
      size: 13 * s, bold: true, mono: true, letterSpacing: 4 * s, fill: `rgba(216,184,119,${a})`,
    });
  });
  const tickPaint = fillPaint("rgba(216,184,119,0.24)");
  ([-75, 75] as const).forEach((d) => canvas.drawRect(Skia.XYWHRect(W / 2 + d * s, ly - 10 * s, 1 * s, 12 * s), tickPaint));

  drawTrackedText(canvas, "LEGENDS ARE NOT FOUND", W / 2, H - 146 * s, {
    size: 14 * s, bold: true, mono: true, letterSpacing: 6 * s, fill: "rgba(242,236,226,0.42)",
  });
  drawTrackedText(canvas, "THEY ARE REVEALED", W / 2, H - 120 * s, {
    size: 14 * s, bold: true, mono: true, letterSpacing: 6 * s, shader: goldShader(H - 138 * s, H - 112 * s),
  });

  crimpBand(canvas, W, 0, flap, true, s);
  crimpBand(canvas, W, H - flap, H, false, s);
  tearChannel(canvas, W, seam, s);
  canvas.restore();
  return { data: surf.toRGBA(), width: W, height: H };
}

export function drawBack(input: BlackLabelFaceInput): PixelImage {
  const { width: W, height: H, seamFrac, flapFrac } = input;
  const s = W / DESIGN_W;
  const surf = makeSurface(W, H);
  const { canvas } = surf;

  canvas.save();
  canvas.clipPath(silhouettePath(W, H, 32 * s), ClipOp.Intersect, true);
  obsidianBase(canvas, W, H, s);
  const flap = H * flapFrac, seam = H * seamFrac;

  guilloche(canvas, W / 2, H * 0.44, { r: 248 * s, lobes: 13, lines: 24, ripple: 0.14, stroke: "rgba(216,184,119,0.07)" });
  guilloche(canvas, W / 2, H * 0.44, { r: 128 * s, lobes: 7, lines: 15, turns: 3, ripple: 0.2, stroke: "rgba(255,120,40,0.06)" });

  drawTrackedText(canvas, "GRAILHAUS · BLACK LABEL", W / 2, 136 * s, {
    size: 21 * s, bold: true, mono: true, letterSpacing: 10 * s, shader: goldShader(116 * s, 142 * s),
  });
  drawTrackedText(canvas, "CERTIFIED COLLECTOR PACKAGING", W / 2, 168 * s, {
    size: 12 * s, bold: true, mono: true, letterSpacing: 5 * s, fill: "rgba(242,236,226,0.4)",
  });

  const ax = 56 * s, ay = seam + 40 * s, aw = W - 112 * s, ah = H - seam - flap - 96 * s;
  canvas.drawPath(roundRectPath(ax, ay, aw, ah, 8 * s), strokePaint("rgba(0,0,0,0.66)", 5 * s));
  canvas.drawPath(roundRectPath(ax, ay, aw, ah, 8 * s), strokePaint("rgba(216,184,119,0.26)", 1.3 * s));
  canvas.drawPath(roundRectPath(ax + 10 * s, ay + 10 * s, aw - 20 * s, ah - 20 * s, 5 * s), strokePaint("rgba(216,184,119,0.12)", 1 * s));

  editionPlate(canvas, W / 2, ay + 108 * s, 430 * s, 76 * s, "BLACK LABEL");
  drawTrackedText(canvas, "TIER III · THE HIGHEST TIER", W / 2, ay + 172 * s, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 6 * s, fill: "rgba(216,184,119,0.48)",
  });

  const cy0 = ay + 228 * s;
  const rows: [string, string][] = [
    ["CONTENTS", "6 COLLECTOR CARDS"],
    ["GUARANTEE", "1 PRIME OR ABOVE"],
    ["GRAIL ODDS", "1 IN 25 PACKS"],
    ["SEALED", "AT SOURCE · GH ATELIER"],
    ["AUTH", "BL-S1A-00317"],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy0 + i * 40 * s;
    drawTrackedText(canvas, k, ax + 40 * s, y, {
      size: 12 * s, bold: true, mono: true, letterSpacing: 4 * s, fill: "rgba(216,184,119,0.46)", align: "left",
    });
    drawTrackedText(canvas, v, ax + aw - 40 * s, y, {
      size: 13 * s, bold: true, mono: true, letterSpacing: 2 * s, fill: "rgba(242,236,226,0.68)", align: "right",
    });
    const sep = Skia.Path.Make();
    sep.moveTo(ax + 40 * s, y + 12 * s); sep.lineTo(ax + aw - 40 * s, y + 12 * s);
    canvas.drawPath(sep, strokePaint("rgba(216,184,119,0.09)", 1 * s));
  });

  microBlock(canvas, ax + 40 * s, cy0 + 216 * s, aw - 80 * s, 7, { alpha: 0.16, fill: GOLD, rowH: 7 * s });
  drawTrackedText(canvas, "COLLECTION · THE ELEMENTAL SERIES", W / 2, cy0 + 296 * s, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 5 * s, fill: "rgba(216,184,119,0.5)",
  });

  barcode(canvas, W / 2 - 96 * s, H - 178 * s, 192 * s, 52 * s, { bg: "rgba(242,236,226,0.84)", ink: INK, seed: 53 });
  drawTrackedText(canvas, "BL · S1A · 006", W / 2, H - 106 * s, {
    size: 12 * s, bold: true, mono: true, letterSpacing: 5 * s, fill: "rgba(242,236,226,0.36)",
  });

  crimpBand(canvas, W, 0, flap, true, s);
  crimpBand(canvas, W, H - flap, H, false, s);
  tearChannel(canvas, W, seam, s);
  canvas.restore();
  return { data: surf.toRGBA(), width: W, height: H };
}

// Inner liner: dark graphite web with a molten copper sheen, so the interior catches the fire
// rather than gold-plating it.
export function drawLiner(width = 256, height = 256): PixelImage {
  const surf = makeSurface(width, height);
  const { canvas } = surf;
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), linearGradientPaint(0, 0, width, 0, [
    [0, "#0a0808"], [0.14, "#2a1810"], [0.3, "#6e3618"], [0.42, "#b96a2c"],
    [0.5, "#e8a45c"], [0.58, "#a45a26"], [0.72, "#572b14"], [0.88, "#1d1310"],
    [1, "#08070a"],
  ]));
  hairlines(canvas, 0, 0, width, height, { step: 3, angle: Math.PI / 2, alpha: 0.1 });
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), linearGradientPaint(0, 0, 0, height, [
    [0, "rgba(255,214,160,0.16)"], [0.4, "rgba(0,0,0,0.12)"], [1, "rgba(0,0,0,0.76)"],
  ]));
  return { data: surf.toRGBA(), width, height };
}

// Seam sweep: molten, not rainbow.
export function drawShine(width = 512, height = 32): PixelImage {
  const surf = makeSurface(width, height);
  const { canvas } = surf;
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), linearGradientPaint(0, 0, width, 0, [
    [0, "rgba(0,0,0,0)"], [0.34, "rgba(120,40,8,0.24)"], [0.45, "#e08a34"],
    [0.5, "#fff2d6"], [0.55, "#d1701f"], [0.66, "rgba(120,40,8,0.22)"], [1, "rgba(0,0,0,0)"],
  ]));
  const vignette = linearGradientPaint(0, 0, 0, height, [
    [0, "rgba(0,0,0,1)"], [0.34, "rgba(0,0,0,0.3)"], [0.5, "rgba(0,0,0,0)"],
    [0.66, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,1)"],
  ]);
  vignette.setBlendMode(BlendMode.Multiply);
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), vignette);
  return { data: surf.toRGBA(), width, height };
}
