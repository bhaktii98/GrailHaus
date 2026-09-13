// Ported from project/card-art.js onto Skia's offscreen canvas — GrailHaus
// collector card faces: rarity ribbon, valuation block with a live
// sparkline, authentication seal, serial, collector line. Function-for-
// function port (see vaultArt.ts's header for the general approach).
import {
  Skia,
  ClipOp,
  PaintStyle,
  TileMode,
  type SkCanvas,
} from '@shopify/react-native-skia';
import {
  makeSurface,
  fillPaint,
  strokePaint,
  linearGradientPaint,
  roundRectPath,
  drawTrackedText,
} from '../../reveal/art/canvasHelpers';
import { metalShader, hairlines, guilloche, microBlock } from './artUtil';
import type { CardRarity, VaultCardData } from '../config/types';

export interface PixelImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const CW = 310, CH = 434; // half the prototype's 620x868 — a phone shows
// these at a fraction of a browser-preview's width; every pixel constant
// below is native to this resolution (not scaled), matching how the
// original card-art.js was itself authored at one fixed size.
const IVORY = '#f4ece0';
const CH_C = '#e8cf9a';

export const RARITY: Record<CardRarity, { label: string; ink: string; ribbon: [string, string, string]; glow: number; metal: number }> = {
  CORE: { label: 'CORE', ink: '#c9c3d6', ribbon: ['#2a2733', '#6d6879', '#2a2733'], glow: 0.0, metal: 0.22 },
  PRIME: { label: 'PRIME', ink: '#f4ece0', ribbon: ['#33280f', '#b99b57', '#33280f'], glow: 0.35, metal: 0.42 },
  GRAIL: { label: 'GRAIL', ink: '#fff6e0', ribbon: ['#4a2f0c', '#f0d79c', '#4a2f0c'], glow: 1.0, metal: 0.62 },
};

// Deterministic pseudo-random so a card looks the same every time it is
// drawn (and the same on every device — no Math.random() in the art path).
function rng(seed: number) {
  let s = (seed * 2654435761) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 48271) % 2147483647) / 2147483647;
}

// Abstract vault-geometry artwork filling the card's art window.
function cardWindowArt(canvas: SkCanvas, x: number, y: number, w: number, h: number, card: VaultCardData) {
  const r = rng(card.seed);
  canvas.save();
  canvas.clipPath(roundRectPath(x, y, w, h, 8), ClipOp.Intersect, true);

  canvas.drawRect(Skia.XYWHRect(x, y, w, h), linearGradientPaint(x, y, x + w * 0.4, y + h, [
    [0, '#0d0620'], [0.5, card.tint], [1, '#050310'],
  ]));

  const cx = x + w / 2, cy = y + h * 0.5;
  const haze = Skia.Paint();
  haze.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(cx, cy - h * 0.1), w * 0.75,
    [Skia.Color('rgba(180,140,255,0.24)'), Skia.Color('rgba(0,0,0,0)')],
    null, TileMode.Clamp,
  ));
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), haze);

  for (let i = 6; i >= 1; i--) {
    canvas.drawArc(
      Skia.XYWHRect(cx - i * w * 0.1, cy + h * 0.22 - i * w * 0.1, i * w * 0.2, i * w * 0.2),
      180, 180, false,
      strokePaint(`rgba(232,207,162,${0.05 + i * 0.035})`, 1.4 + i * 0.5),
    );
  }

  guilloche(canvas, cx, cy, { r: w * 0.42, lobes: 9, lines: 14, turns: 4, stroke: 'rgba(232,207,162,0.06)' });

  const mw = w * 0.3, mh = h * 0.5;
  const monolith = Skia.Path.Make();
  monolith.moveTo(cx, cy - mh * 0.62);
  monolith.lineTo(cx + mw * 0.5, cy - mh * 0.3);
  monolith.lineTo(cx + mw * 0.5, cy + mh * 0.42);
  monolith.lineTo(cx, cy + mh * 0.6);
  monolith.lineTo(cx - mw * 0.5, cy + mh * 0.42);
  monolith.lineTo(cx - mw * 0.5, cy - mh * 0.3);
  monolith.close();
  canvas.drawPath(monolith, linearGradientPaint(cx - mw * 0.5, cy, cx + mw * 0.5, cy, [
    [0, 'rgba(255,255,255,0.08)'], [0.4, 'rgba(255,246,224,0.42)'],
    [0.52, 'rgba(150,140,170,0.22)'], [1, 'rgba(255,255,255,0.06)'],
  ]));
  canvas.drawPath(monolith, strokePaint('rgba(232,207,162,0.8)', 2));

  const dot = fillPaint('#ffffff');
  for (let i = 0; i < 46; i++) {
    const px = x + r() * w, py = y + r() * h;
    dot.setColor(Skia.Color(i % 5 ? '#ffffff' : CH_C));
    dot.setAlphaf(0.1 + r() * 0.4);
    const sz = 1 + (i % 4 === 0 ? 1 : 0);
    canvas.drawRect(Skia.XYWHRect(px, py, sz, sz), dot);
  }

  const glow = Skia.Paint();
  glow.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(cx, cy + h * 0.3), w * 0.46,
    [Skia.Color(`rgba(${card.glowRGB},0.4)`), Skia.Color('rgba(0,0,0,0)')],
    null, TileMode.Clamp,
  ));
  canvas.drawRect(Skia.XYWHRect(x, cy, w, h - (cy - y)), glow);

  hairlines(canvas, x, y, w, h, { step: 4, angle: -0.5, alpha: 0.03 });
  canvas.restore();
}

function sparkline(canvas: SkCanvas, x: number, y: number, w: number, h: number, series: number[], up: boolean) {
  const min = Math.min(...series), max = Math.max(...series);
  const sx = (i: number) => x + (i / (series.length - 1)) * w;
  const sy = (v: number) => y + h - ((v - min) / Math.max(1e-6, max - min)) * h;

  const fillArea = Skia.Path.Make();
  fillArea.moveTo(sx(0), sy(series[0]));
  series.forEach((v, i) => fillArea.lineTo(sx(i), sy(v)));
  fillArea.lineTo(sx(series.length - 1), y + h);
  fillArea.lineTo(sx(0), y + h);
  fillArea.close();
  canvas.drawPath(fillArea, linearGradientPaint(0, y, 0, y + h, [
    [0, up ? 'rgba(126,214,164,0.32)' : 'rgba(214,126,140,0.3)'], [1, 'rgba(0,0,0,0)'],
  ]));

  const curve = Skia.Path.Make();
  series.forEach((v, i) => (i ? curve.lineTo(sx(i), sy(v)) : curve.moveTo(sx(i), sy(v))));
  canvas.drawPath(curve, strokePaint(up ? '#7ed6a4' : '#d67e8c', 2));

  canvas.drawCircle(sx(series.length - 1), sy(series[series.length - 1]), 3.2, fillPaint(up ? '#a8ecc6' : '#eca8b4'));
}

export function drawCardFace(card: VaultCardData): PixelImage {
  const surf = makeSurface(CW, CH);
  const { canvas } = surf;
  const rar = RARITY[card.rarity];

  canvas.drawRect(Skia.XYWHRect(0, 0, CW, CH), linearGradientPaint(0, 0, CW, CH, [
    [0, '#150a28'], [0.5, '#241041'], [1, '#0b0518'],
  ]));
  hairlines(canvas, 0, 0, CW, CH, { step: 6, angle: -0.4, alpha: 0.035 });

  canvas.drawRect(Skia.XYWHRect(3, 3, CW - 6, CH - 6), strokePaint(rar.ribbon[1], 5 + rar.glow * 2));
  canvas.drawRect(Skia.XYWHRect(11, 11, CW - 22, CH - 22), strokePaint('rgba(244,236,224,0.26)', 0.7));

  const rx = 20, ry = 21, rw = CW - 40, rh = 19;
  canvas.drawRect(Skia.XYWHRect(rx, ry, rw, rh), linearGradientPaint(rx, 0, rx + rw, 0, [
    [0, rar.ribbon[0]], [0.5, rar.ribbon[1]], [1, rar.ribbon[2]],
  ]));
  canvas.drawRect(Skia.XYWHRect(rx, ry, rw, rh), strokePaint('rgba(0,0,0,0.5)', 0.5));
  drawTrackedText(canvas, `${rar.label} · ${card.edition}`, rx + rw / 2, ry + 13, {
    size: 8.5, bold: true, mono: true, letterSpacing: 3.5, fill: rar.glow > 0.5 ? '#1a0f2e' : '#f0ece4',
  });

  drawTrackedText(canvas, card.name, CW / 2, ry + 48, {
    size: 22, letterSpacing: 0.5, fill: IVORY, shadow: 'rgba(0,0,0,0.6)', shadowBlur: 6,
  });
  drawTrackedText(canvas, `GRAILHAUS · SERIES I · ${card.finish}`, CW / 2, ry + 62, {
    size: 7, bold: true, mono: true, letterSpacing: 2.5, fill: 'rgba(244,236,224,0.48)',
  });

  const ax = 24, ay = 106, aw = CW - 48, ah = 186;
  cardWindowArt(canvas, ax, ay, aw, ah, card);
  canvas.drawPath(roundRectPath(ax, ay, aw, ah, 8), strokePaint('rgba(232,207,162,0.5)', 1));

  const vy = ay + ah + 15;
  const vh = 74;
  canvas.drawRect(Skia.XYWHRect(24, vy, CW - 48, vh), fillPaint('rgba(5,3,12,0.72)'));
  canvas.drawRect(Skia.XYWHRect(24, vy, CW - 48, vh), strokePaint('rgba(232,207,162,0.18)', 0.7));

  drawTrackedText(canvas, 'EST. VALUE', 35, vy + 15, {
    size: 6.5, bold: true, mono: true, letterSpacing: 2, fill: 'rgba(244,236,224,0.44)', align: 'left',
  });
  drawTrackedText(canvas, card.value, 35, vy + 37, { size: 20, fill: IVORY, align: 'left' });
  const up = card.delta >= 0;
  drawTrackedText(canvas, `${up ? '▲' : '▼'} ${Math.abs(card.delta).toFixed(1)}%`, CW - 35, vy + 18, {
    size: 11, bold: true, letterSpacing: 0.5, fill: up ? '#7ed6a4' : '#d67e8c', align: 'right',
  });
  drawTrackedText(canvas, '30D', CW - 35, vy + 30, {
    size: 6, bold: true, mono: true, letterSpacing: 2, fill: 'rgba(244,236,224,0.38)', align: 'right',
  });
  sparkline(canvas, CW - 125, vy + 35, 90, 20, card.spark, up);
  drawTrackedText(canvas, card.held, 35, vy + 64, {
    size: 6.5, bold: true, mono: true, letterSpacing: 1.5, fill: 'rgba(244,236,224,0.38)', align: 'left',
  });

  const fy = CH - 25;
  const rule = Skia.Path.Make();
  rule.moveTo(24, fy - 13); rule.lineTo(CW - 24, fy - 13);
  canvas.drawPath(rule, strokePaint('rgba(232,207,162,0.16)', 0.5));
  drawTrackedText(canvas, 'GRAILHAUS', 24, fy, {
    size: 9.5, bold: true, letterSpacing: 2.5, fill: 'rgba(244,236,224,0.78)', align: 'left',
  });
  drawTrackedText(canvas, card.serial, CW - 24, fy, {
    size: 7, bold: true, mono: true, letterSpacing: 1.5, fill: 'rgba(244,236,224,0.44)', align: 'right',
  });
  canvas.drawCircle(CW / 2, fy - 3, 7.5, strokePaint(CH_C, 1));
  canvas.drawCircle(CW / 2, fy - 3, 5.5, strokePaint('rgba(232,207,162,0.34)', 0.5));
  drawTrackedText(canvas, '✓', CW / 2, fy, { size: 7.5, bold: true, fill: CH_C });

  return { data: surf.toRGBA(), width: CW, height: CH };
}

// Shared card verso — collector artifact, no per-card data.
export function drawCardVerso(): PixelImage {
  const surf = makeSurface(CW, CH);
  const { canvas } = surf;
  canvas.drawRect(Skia.XYWHRect(0, 0, CW, CH), linearGradientPaint(0, 0, CW, CH, [
    [0, '#100722'], [0.5, '#1f0f3a'], [1, '#08040f'],
  ]));
  hairlines(canvas, 0, 0, CW, CH, { step: 5, angle: 0.42, alpha: 0.04 });

  canvas.drawRect(Skia.XYWHRect(3, 3, CW - 6, CH - 6), strokePaint('#6f5a2c', 5));
  canvas.drawRect(Skia.XYWHRect(12, 12, CW - 24, CH - 24), strokePaint('rgba(232,207,162,0.2)', 0.6));

  guilloche(canvas, CW / 2, CH * 0.46, { r: 107, lobes: 12, lines: 24, stroke: 'rgba(232,207,162,0.11)' });
  guilloche(canvas, CW / 2, CH * 0.46, { r: 56, lobes: 6, lines: 14, turns: 3, stroke: 'rgba(170,132,246,0.12)' });

  canvas.save();
  canvas.translate(CW / 2, CH * 0.46);
  const seal = Skia.Path.Make();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 48, y = Math.sin(a) * 48;
    if (i === 0) seal.moveTo(x, y); else seal.lineTo(x, y);
  }
  seal.close();
  canvas.drawPath(seal, fillPaint('rgba(8,4,18,0.72)'));
  const sealStroke = Skia.Paint();
  sealStroke.setAntiAlias(true);
  sealStroke.setStyle(PaintStyle.Stroke);
  sealStroke.setStrokeWidth(1.5);
  sealStroke.setShader(metalShader(-48, 48));
  canvas.drawPath(seal, sealStroke);
  drawTrackedText(canvas, 'G', 0, 22, { size: 61, bold: true, shader: metalShader(-35, 25) });
  canvas.restore();

  drawTrackedText(canvas, 'GRAILHAUS', CW / 2, 64, { size: 15, bold: true, letterSpacing: 4, shader: metalShader(50, 67) });
  drawTrackedText(canvas, 'COLLECTOR CARD GAME', CW / 2, 79, {
    size: 6.5, bold: true, mono: true, letterSpacing: 3, fill: 'rgba(244,236,224,0.5)',
  });
  drawTrackedText(canvas, 'VAULT BREAK · SERIES I', CW / 2, CH - 74, {
    size: 7.5, bold: true, mono: true, letterSpacing: 3.5, fill: 'rgba(232,207,162,0.62)',
  });
  microBlock(canvas, CW / 2 - 60, CH - 61, 120, 4, { rowH: 4, alpha: 0.18 });
  drawTrackedText(canvas, "THE COLLECTOR'S VAULT", CW / 2, CH - 29, {
    size: 6, bold: true, mono: true, letterSpacing: 2.5, fill: 'rgba(244,236,224,0.34)',
  });

  return { data: surf.toRGBA(), width: CW, height: CH };
}
