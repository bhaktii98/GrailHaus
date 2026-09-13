// Ported from project/pack-art.js (Claude Design prototype) onto Skia's
// offscreen canvas. The drawing vocabulary (silhouette clip, crimp bands,
// header band, tear zone, gold-gradient text, emblem watermark, chrome
// band, barcode, prism art window) is preserved function-for-function;
// only the canvas backend changed. Every pixel constant is scaled by
// `s = width / DESIGN_WIDTH` so the art stays proportionally correct at
// whatever texture resolution the caller picks — see engine/textures.ts
// for why that resolution is lower on a phone than the 800×1200 the
// prototype used in a browser preview.
import {
  Skia,
  ClipOp,
  BlurStyle,
  BlendMode,
  TileMode,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import type { PackPalette, PackCopy, CardFaceCopy } from '../config/types';
import {
  makeSurface,
  fillPaint,
  strokePaint,
  linearGradientShader,
  linearGradientPaint,
  roundRectPath,
  drawTrackedText,
} from './canvasHelpers';

export interface PixelImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const DESIGN_WIDTH = 800;
const TEETH = 13;
const BONE = '#f6eeda';

function goldStops(palette: PackPalette) {
  return [
    [0, palette.goldHi],
    [0.34, palette.gold],
    [0.52, '#b9832c'],
    [0.68, palette.gold],
    [1, palette.goldHi],
  ] as [number, string][];
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

function blackBase(canvas: SkCanvas, w: number, h: number) {
  canvas.drawRect(
    Skia.XYWHRect(0, 0, w, h),
    linearGradientPaint(0, 0, w, 0, [
      [0, '#0d0618'],
      [0.12, '#1c0e33'],
      [0.3, '#2e1854'],
      [0.5, '#241143'],
      [0.72, '#301a58'],
      [0.9, '#170b2a'],
      [1, '#080310'],
    ]),
  );
  canvas.drawRect(
    Skia.XYWHRect(0, 0, w, h),
    linearGradientPaint(0, 0, 0, h, [
      [0, 'rgba(255,255,255,0.05)'],
      [0.5, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,0.45)'],
    ]),
  );
}

function crimpBand(canvas: SkCanvas, w: number, y0: number, y1: number, top: boolean, s: number) {
  const h = y1 - y0;
  canvas.drawRect(
    Skia.XYWHRect(0, y0, w, h),
    linearGradientPaint(
      0,
      y0,
      0,
      y1,
      top
        ? [[0, '#8a6fc4'], [0.5, '#4a2f80'], [1, '#180a2c']]
        : [[0, '#180a2c'], [0.5, '#4a2f80'], [1, '#8a6fc4']],
    ),
  );
  for (let x = 0; x < w; x += 11 * s) {
    canvas.drawRect(Skia.XYWHRect(x, y0, 4 * s, h), fillPaint('rgba(255,255,255,0.22)'));
    canvas.drawRect(Skia.XYWHRect(x + 5 * s, y0, 4 * s, h), fillPaint('rgba(0,0,0,0.5)'));
  }
  canvas.drawRect(Skia.XYWHRect(0, top ? y0 : y1 - 3 * s, w, 3 * s), fillPaint('rgba(255,255,255,0.42)'));
  canvas.drawRect(Skia.XYWHRect(0, top ? y1 - 5 * s : y0, w, 5 * s), fillPaint('rgba(0,0,0,0.65)'));
}

function headerBand(canvas: SkCanvas, w: number, y0: number, y1: number, s: number) {
  canvas.drawRect(
    Skia.XYWHRect(0, y0, w, y1 - y0),
    linearGradientPaint(0, y0, 0, y1, [[0, '#6b46b0'], [0.5, '#57389a'], [1, '#3d2470']]),
  );
  canvas.drawRect(
    Skia.XYWHRect(0, y0, w, y1 - y0),
    linearGradientPaint(0, y0, w * 0.8, y1, [
      [0, 'rgba(255,255,255,0)'],
      [0.36, 'rgba(255,255,255,0.3)'],
      [0.46, 'rgba(255,255,255,0.05)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  canvas.drawRect(Skia.XYWHRect(0, y1 - 6 * s, w, 6 * s), fillPaint('rgba(16,6,32,0.5)'));
}

function tearZone(canvas: SkCanvas, w: number, seam: number, s: number) {
  drawTrackedText(canvas, 'TEAR', 58 * s, seam - 22 * s, {
    size: 17 * s, bold: true, mono: true, letterSpacing: 3 * s,
    fill: 'rgba(255,233,172,0.9)', align: 'left',
  });
  drawTrackedText(canvas, 'TEAR', w - 58 * s, seam - 22 * s, {
    size: 17 * s, bold: true, mono: true, letterSpacing: 3 * s,
    fill: 'rgba(255,233,172,0.9)', align: 'right',
  });

  const dash = strokePaint('rgba(246,238,218,0.75)', 4 * s);
  dash.setPathEffect(Skia.PathEffect.MakeDash([12 * s, 10 * s], 0));
  const dashPath = Skia.Path.Make();
  dashPath.moveTo(38 * s, seam - 14 * s);
  dashPath.lineTo(w - 38 * s, seam - 14 * s);
  canvas.drawPath(dashPath, dash);

  const glowRect = Skia.XYWHRect(38 * s, seam - 1 * s, w - 76 * s, 4 * s);
  const glowStops: [number, string][] = [[0, '#8a621d'], [0.5, '#ffe9ac'], [1, '#8a621d']];
  const blurred = linearGradientPaint(38 * s, 0, w - 38 * s, 0, glowStops);
  blurred.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 7 * s, true));
  canvas.drawRect(glowRect, blurred);
  canvas.drawRect(glowRect, linearGradientPaint(38 * s, 0, w - 38 * s, 0, glowStops));
}

function drawEmblem(canvas: SkCanvas, cx: number, cy: number, scale: number, palette: PackPalette) {
  canvas.save();
  canvas.translate(cx, cy);
  const ringLayer = Skia.Paint();
  ringLayer.setAlphaf(0.62);
  canvas.saveLayer(ringLayer);
  [1, 0.78, 0.56].forEach((k) => {
    canvas.drawCircle(0, 0, 190 * k * scale, strokePaint(palette.gold, 4 * k * scale));
  });
  const diamond = Skia.Path.Make();
  diamond.moveTo(0, -150 * scale);
  diamond.lineTo(96 * scale, 0);
  diamond.lineTo(0, 150 * scale);
  diamond.lineTo(-96 * scale, 0);
  diamond.close();
  canvas.drawPath(diamond, fillPaint('rgba(12,5,26,0.55)'));
  canvas.drawPath(diamond, strokePaint(palette.goldHi, 6 * scale));
  canvas.restore();

  const textLayer = Skia.Paint();
  textLayer.setAlphaf(0.85);
  canvas.saveLayer(textLayer);
  drawTrackedText(canvas, 'G', 0, 56 * scale, {
    size: 138 * scale, bold: true,
    shader: linearGradientShader(0, -80 * scale, 0, 60 * scale, goldStops(palette)),
  });
  canvas.restore();
  canvas.restore();
}

function chromeBand(canvas: SkCanvas, w: number, y: number, h: number, text: string, s: number) {
  canvas.drawRect(
    Skia.XYWHRect(0, y, w, h),
    linearGradientPaint(0, y, 0, y + h, [
      [0, '#7a5a1c'], [0.18, '#ffe9ac'], [0.36, '#fff6d8'], [0.52, '#c9962f'],
      [0.66, '#ffe093'], [0.86, '#8a621d'], [1, '#3d2a08'],
    ]),
  );
  for (let x = 0; x < w; x += 5 * s) {
    const on = Math.round(x / (5 * s)) % 2 !== 0;
    canvas.drawRect(Skia.XYWHRect(x, y, 2 * s, h), fillPaint(on ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.16)'));
  }
  canvas.drawRect(Skia.XYWHRect(0, y, w, 3 * s), fillPaint('rgba(0,0,0,0.55)'));
  canvas.drawRect(Skia.XYWHRect(0, y + h - 3 * s, w, 3 * s), fillPaint('rgba(0,0,0,0.55)'));
  drawTrackedText(canvas, text, w / 2, y + h * 0.72, {
    size: h * 0.62, bold: true, letterSpacing: 3 * s, fill: '#241043', shadow: 'rgba(255,240,200,0.5)',
  });
}

function barcode(canvas: SkCanvas, x: number, y: number, w: number, h: number, s: number) {
  canvas.drawRect(Skia.XYWHRect(x - 4 * s, y - 4 * s, w + 8 * s, h + 8 * s), fillPaint(BONE));
  let cx = x;
  const black = fillPaint('#000000');
  while (cx < x + w) {
    const bw = (2 + Math.floor(Math.random() * 4)) * s;
    canvas.drawRect(Skia.XYWHRect(cx, y, bw, h), black);
    cx += bw + (2 + Math.floor(Math.random() * 3)) * s;
  }
}

export interface FaceInput {
  width: number;
  height: number;
  seamFrac: number;
  flapFrac: number;
  palette: PackPalette;
  copy: PackCopy;
  logo?: SkImage | null;
}

export function drawFront(input: FaceInput): PixelImage {
  const { width: W, height: H, seamFrac, flapFrac, palette, copy, logo } = input;
  const s = W / DESIGN_WIDTH;
  const surf = makeSurface(W, H);
  const { canvas } = surf;

  canvas.save();
  canvas.clipPath(silhouettePath(W, H, 30 * s), ClipOp.Intersect, true);
  blackBase(canvas, W, H);

  const flap = H * flapFrac, seam = H * seamFrac;
  headerBand(canvas, W, 0, seam - 30 * s, s);
  crimpBand(canvas, W, 0, flap, true, s);
  crimpBand(canvas, W, H - flap, H, false, s);
  tearZone(canvas, W, seam, s);

  drawTrackedText(canvas, copy.wordmark, W / 2, 132 * s, {
    size: 58 * s, bold: true, letterSpacing: 3 * s,
    shader: linearGradientShader(0, 92 * s, 0, 136 * s, goldStops(palette)),
    stroke: '#22103f', strokeWidth: 8 * s,
  });
  drawTrackedText(canvas, copy.subline, W / 2, 162 * s, {
    size: 17 * s, bold: true, letterSpacing: 6 * s, fill: '#f0e4ff', stroke: '#22103f', strokeWidth: 4 * s,
  });
  drawTrackedText(canvas, copy.sealedWord, W / 2, 198 * s, {
    size: 32 * s, italic: true, fill: palette.goldHi, stroke: '#22103f', strokeWidth: 5 * s,
  });

  const bw = 100 * s, bh = 40 * s, bx = W - 30 * s - bw, by = 86 * s;
  const badge = roundRectPath(bx, by, bw, bh, 14 * s);
  canvas.drawPath(badge, fillPaint('rgba(18,7,34,0.85)'));
  canvas.drawPath(badge, strokePaint(palette.gold, 3 * s));
  drawTrackedText(canvas, copy.codeBadge, bx + bw / 2, by + 29 * s, {
    size: 25 * s, bold: true, letterSpacing: 1 * s,
    shader: linearGradientShader(0, by + 6 * s, 0, by + 36 * s, goldStops(palette)),
  });

  const px = 56 * s, py = seam + 46 * s, pw = W - 112 * s, ph = pw * 0.98;
  const frame = roundRectPath(px, py, pw, ph, 56 * s);
  canvas.save();
  canvas.clipPath(frame, ClipOp.Intersect, true);
  canvas.drawRect(Skia.XYWHRect(px, py, pw, ph), linearGradientPaint(0, py, 0, py + ph, [[0, '#160a2c'], [1, '#0a0418']]));
  if (logo) {
    const size = Math.min(pw, ph);
    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);
    canvas.drawImageRect(
      logo,
      Skia.XYWHRect(0, 0, logo.width(), logo.height()),
      Skia.XYWHRect(px + (pw - size) / 2, py + (ph - size) / 2, size, size),
      imgPaint,
      true,
    );
  } else {
    drawEmblem(canvas, px + pw / 2, py + ph / 2, ((Math.min(pw, ph)) / 380) * 0.9, palette);
  }
  canvas.restore();
  canvas.drawPath(frame, strokePaint('rgba(255,233,172,0.18)', 2 * s));

  const fy = H - 104 * s;
  canvas.drawRect(
    Skia.XYWHRect(0, fy - 46 * s, W, 68 * s),
    linearGradientPaint(0, fy - 46 * s, 0, fy + 22 * s, [
      [0, 'rgba(12,4,26,0)'], [0.4, 'rgba(12,4,26,0.72)'], [1, 'rgba(12,4,26,0)'],
    ]),
  );
  drawTrackedText(canvas, copy.footer, W / 2, fy, {
    size: 44 * s, bold: true, letterSpacing: 4 * s,
    shader: linearGradientShader(0, fy - 42 * s, 0, fy + 4 * s, goldStops(palette)),
    stroke: '#170826', strokeWidth: 9 * s, shadow: 'rgba(0,0,0,0.65)', shadowBlur: 6 * s,
  });
  canvas.restore();
  return { data: surf.toRGBA(), width: W, height: H };
}

export function drawBack(input: FaceInput): PixelImage {
  const { width: W, height: H, seamFrac, flapFrac, palette, copy } = input;
  const s = W / DESIGN_WIDTH;
  const surf = makeSurface(W, H);
  const { canvas } = surf;

  canvas.save();
  canvas.clipPath(silhouettePath(W, H, 30 * s), ClipOp.Intersect, true);
  blackBase(canvas, W, H);
  const flap = H * flapFrac, seam = H * seamFrac;
  crimpBand(canvas, W, 0, flap, true, s);
  crimpBand(canvas, W, H - flap, H, false, s);
  tearZone(canvas, W, seam, s);

  headerBand(canvas, W, 0, seam - 30 * s, s);
  drawTrackedText(canvas, copy.backHeaderLine1, W / 2, 140 * s, {
    size: 24 * s, bold: true, letterSpacing: 8 * s, mono: true,
    shader: linearGradientShader(0, 118 * s, 0, 146 * s, goldStops(palette)),
  });
  drawTrackedText(canvas, copy.backHeaderLine2, W / 2, 178 * s, {
    size: 16 * s, bold: true, letterSpacing: 5 * s, mono: true, fill: 'rgba(246,238,218,0.62)',
  });

  drawEmblem(canvas, W / 2, H * 0.42, s, palette);
  chromeBand(canvas, W, H * 0.585, 58 * s, copy.wordmark, s);

  copy.backBullets.forEach((line, i) => {
    drawTrackedText(canvas, line, W / 2, H * 0.71 + i * 38 * s, {
      size: 20 * s, letterSpacing: 4 * s, mono: true, fill: 'rgba(240,228,255,0.62)',
    });
  });

  barcode(canvas, W / 2 - 110 * s, H - 150 * s, 220 * s, 66 * s, s);
  canvas.restore();
  return { data: surf.toRGBA(), width: W, height: H };
}

function prismArt(canvas: SkCanvas, x: number, y: number, w: number, h: number) {
  canvas.save();
  const clip = roundRectPath(x, y, w, h, 12);
  canvas.clipPath(clip, ClipOp.Intersect, true);
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), linearGradientPaint(x, y, x, y + h, [
    [0, '#07070c'], [0.55, '#160b1e'], [1, '#04040a'],
  ]));

  const starPaint = fillPaint('#ffffff');
  for (let i = 0; i < 90; i++) {
    const px = x + ((i * 97) % w), py = y + ((i * 191) % h);
    starPaint.setAlphaf(0.15 + ((i * 37) % 60) / 140);
    const sz = 1 + (i % 3 === 0 ? 1 : 0);
    canvas.drawRect(Skia.XYWHRect(px, py, sz, sz), starPaint);
  }

  const cx = x + w / 2, cy = y + h * 0.52;
  for (let i = 5; i >= 1; i--) {
    const arcPaint = strokePaint(`rgba(216,169,63,${0.06 + i * 0.05})`, 2 + i * 0.6);
    canvas.drawArc(
      Skia.XYWHRect(cx - i * w * 0.09, cy + h * 0.06 - i * w * 0.09, i * w * 0.18, i * w * 0.18),
      180, 180, false, arcPaint,
    );
  }

  const beamPaint = strokePaint('rgba(255,255,255,0.75)', 5);
  beamPaint.setShader(linearGradientShader(x, cy - h * 0.18, cx, cy, [
    [0, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0.75)'],
  ]));
  const beamPath = Skia.Path.Make();
  beamPath.moveTo(x, cy - h * 0.18);
  beamPath.lineTo(cx - 4, cy - h * 0.02);
  canvas.drawPath(beamPath, beamPaint);

  const fan = ['#ff2a3c', '#ff8a1e', '#ffe14d', '#4ce08a', '#4da6ff', '#a45cff'];
  fan.forEach((col, i) => {
    const p = strokePaint(col, 4);
    p.setAlphaf(0.55);
    const path = Skia.Path.Make();
    path.moveTo(cx + 4, cy - h * 0.01);
    path.lineTo(x + w, cy + h * (-0.02 + i * 0.055));
    canvas.drawPath(path, p);
  });

  const monolith = Skia.Path.Make();
  monolith.moveTo(cx, cy - h * 0.3);
  monolith.lineTo(cx + w * 0.15, cy + h * 0.22);
  monolith.lineTo(cx - w * 0.15, cy + h * 0.22);
  monolith.close();
  canvas.drawPath(monolith, linearGradientPaint(cx - w * 0.15, 0, cx + w * 0.15, 0, [
    [0, 'rgba(255,255,255,0.14)'], [0.45, 'rgba(255,255,255,0.5)'],
    [0.55, 'rgba(190,190,210,0.3)'], [1, 'rgba(255,255,255,0.1)'],
  ]));
  canvas.drawPath(monolith, strokePaint('rgba(255,255,255,0.85)', 3));

  const glowPaint = Skia.Paint();
  glowPaint.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(cx, cy + h * 0.24), w * 0.5,
    [Skia.Color('rgba(150,90,255,0.45)'), Skia.Color('rgba(150,90,255,0)')],
    null, TileMode.Clamp,
  ));
  canvas.drawRect(Skia.XYWHRect(x, cy, w, h - (cy - y)), glowPaint);

  const holo = linearGradientPaint(x, y + h, x + w, y, [
    [0.28, 'rgba(255,255,255,0)'], [0.4, 'rgba(180,140,255,0.14)'],
    [0.48, 'rgba(255,240,200,0.1)'], [0.6, 'rgba(255,255,255,0)'],
  ]);
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), holo);
  canvas.restore();
}

// Deterministic bounded random walk — a small, tasteful stand-in for the
// live price-drift sparkline the portfolio screen would compute; seeded so
// the same card always bakes the same line rather than reshuffling every
// texture rebuild.
function seededSparkline(seed: number, n: number) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
  const pts: number[] = [0.5];
  for (let i = 1; i < n; i++) {
    const next = pts[i - 1] + (rand() - 0.46) * 0.16;
    pts.push(Math.min(1, Math.max(0, next)));
  }
  return pts;
}

export interface CardFaceInput {
  width: number;
  height: number;
  palette: PackPalette;
  cardFace: CardFaceCopy;
}

export function drawCardBack(input: CardFaceInput): PixelImage {
  const { width: w, height: h, palette, cardFace } = input;
  const surf = makeSurface(w, h);
  const { canvas } = surf;

  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), linearGradientPaint(0, 0, w, h, [
    [0, '#180c30'], [0.5, '#28154a'], [1, '#0e0620'],
  ]));
  canvas.drawRect(Skia.XYWHRect(6, 6, w - 12, h - 12), strokePaint(palette.goldDark, 12));
  canvas.drawRect(Skia.XYWHRect(22, 22, w - 44, h - 44), strokePaint('rgba(244,239,230,0.3)', 1.5));

  const rx = 40, ry = 42, rw = w - 80, rh = 40;
  canvas.drawRect(Skia.XYWHRect(rx, ry, rw, rh), linearGradientPaint(rx, 0, rx + rw, 0, [
    [0, '#5b3a12'], [0.5, palette.gold], [1, '#5b3a12'],
  ]));
  drawTrackedText(canvas, cardFace.rarityRibbon, rx + rw / 2, ry + 28, {
    size: 19, bold: true, letterSpacing: 7, mono: true, fill: '#1e0f38',
  });

  drawTrackedText(canvas, cardFace.name, w / 2, ry + 96, {
    size: 46, letterSpacing: 1, fill: BONE, shadow: 'rgba(0,0,0,0.6)', shadowBlur: 12,
  });
  drawTrackedText(canvas, cardFace.category, w / 2, ry + 126, {
    size: 16, bold: true, letterSpacing: 5, mono: true, fill: 'rgba(244,239,230,0.5)',
  });

  const ax = 48, ay = 216, aw = w - 96, ah = 384;
  prismArt(canvas, ax, ay, aw, ah);
  canvas.drawPath(roundRectPath(ax, ay, aw, ah, 10), strokePaint('rgba(244,239,230,0.5)', 2));

  const vy = ay + ah + 34;
  canvas.drawRect(Skia.XYWHRect(48, vy, w - 96, 142), fillPaint('rgba(6,6,10,0.7)'));
  canvas.drawRect(Skia.XYWHRect(48, vy, w - 96, 142), strokePaint('rgba(246,238,218,0.18)', 1.5));

  drawTrackedText(canvas, cardFace.estValueLabel, 70, vy + 32, {
    size: 15, bold: true, letterSpacing: 4, mono: true, fill: 'rgba(244,239,230,0.45)', align: 'left',
  });
  drawTrackedText(canvas, cardFace.estValue, 70, vy + 76, {
    size: 44, fill: BONE, align: 'left',
  });
  drawTrackedText(canvas, cardFace.changePct, w - 70, vy + 44, {
    size: 26, bold: true, letterSpacing: 1, fill: '#3ddc84', align: 'right',
  });
  drawTrackedText(canvas, cardFace.changeLabel, w - 70, vy + 72, {
    size: 14, bold: true, letterSpacing: 4, mono: true, fill: 'rgba(244,239,230,0.4)', align: 'right',
  });

  // sparkline, bottom-right of the valuation block
  const spX = w - 70 - 150, spY = vy + 86, spW = 150, spH = 34;
  const pts = seededSparkline(cardFace.name.length * 7919 + 13, 22);
  const spark = Skia.Path.Make();
  pts.forEach((p, i) => {
    const px = spX + (i / (pts.length - 1)) * spW;
    const py = spY + spH - p * spH;
    if (i === 0) spark.moveTo(px, py); else spark.lineTo(px, py);
  });
  canvas.drawPath(spark, strokePaint('rgba(61,220,132,0.75)', 2));

  drawTrackedText(canvas, cardFace.heldSince, 70, vy + 118, {
    size: 15, bold: true, letterSpacing: 3, mono: true, fill: 'rgba(246,238,218,0.42)', align: 'left',
  });

  const fy = h - 52;
  const rule = Skia.Path.Make();
  rule.moveTo(48, fy - 26);
  rule.lineTo(w - 48, fy - 26);
  canvas.drawPath(rule, strokePaint('rgba(244,239,230,0.16)', 1));
  drawTrackedText(canvas, cardFace.footerLeft, 48, fy, {
    size: 20, bold: true, letterSpacing: 4, fill: 'rgba(244,239,230,0.8)', align: 'left',
  });
  drawTrackedText(canvas, cardFace.footerRight, w - 48, fy, {
    size: 15, bold: true, letterSpacing: 3, mono: true, fill: 'rgba(244,239,230,0.45)', align: 'right',
  });
  canvas.drawCircle(w / 2, fy - 6, 15, strokePaint(palette.gold, 2.5));
  drawTrackedText(canvas, '✓', w / 2, fy + 1, { size: 18, bold: true, fill: palette.gold });

  return { data: surf.toRGBA(), width: w, height: h };
}

export function drawShine(width = 512, height = 32): PixelImage {
  const surf = makeSurface(width, height);
  const { canvas } = surf;
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), linearGradientPaint(0, 0, width, 0, [
    [0, 'rgba(0,0,0,0)'], [0.34, 'rgba(120,30,0,0.3)'], [0.46, '#ffd08a'],
    [0.5, '#ffffff'], [0.54, '#ffb060'], [0.66, 'rgba(120,30,0,0.3)'], [1, 'rgba(0,0,0,0)'],
  ]));
  const vignette = linearGradientPaint(0, 0, 0, height, [
    [0, 'rgba(0,0,0,1)'], [0.32, 'rgba(0,0,0,0.25)'], [0.5, 'rgba(0,0,0,0)'],
    [0.68, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,1)'],
  ]);
  vignette.setBlendMode(BlendMode.Multiply);
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), vignette);
  return { data: surf.toRGBA(), width, height };
}
