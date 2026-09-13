// Ported from card-pack-reveal-prototype/src/vault/art/cardArt.ts onto Skia's offscreen canvas
// — GrailHaus collector card faces: rarity ribbon, valuation block with a live sparkline,
// authentication seal, serial, collector line.
//
// Kept generic to real per-item data rather than the prototype's own hardcoded fictional demo
// deck: the ribbon draws `card.rarityLabel` (the real, admin-configurable rarity tier name)
// instead of a fixed CORE/PRIME/GRAIL string; `rarity` (CORE/PRIME/GRAIL) still selects the
// ribbon's styling by ordinal tier.
//
// Extended for Black Label's fire-themed cards (per the actual Claude Design handoff, which
// generalized this same file rather than forking it — see its own "Theme hooks" comment on
// drawCardFace): `card.stock`/`ribbon`/`accent`/`accentRGB` let a tier restyle the card frame
// without a second layout, `card.windowArt` picks which abstract art fills the art window
// (`'pyro'` for Black Label's molten rift, default `'vault'` for everyone else — a string
// discriminant rather than a function reference on the data object, since VaultCardData is
// otherwise plain data), and `drawCardVerso`/`drawCardVersoImage` now take an optional `theme` for
// the same reason. Vault Break's own cards pass none of this and get the original look
// unchanged.
//
// `windowArt: 'vault'` was, for a while, the only path actually exercised — the app's
// integration briefly ran buildVaultPackObject with an empty deck while the staged card-fan
// reveal moved to its own flat-2D screen (see vaultReveal/VaultTearStage.tsx's header) — but
// both tiers' flat-2D fan screens (VaultCardFanReveal.tsx / blackLabelReveal's
// BlackLabelFanReveal.tsx) call drawCardFaceImage directly with real pulled-item data now, so
// this is live code again, not a kept-for-reuse fallback.
import {
  Skia,
  ClipOp,
  PaintStyle,
  TileMode,
  StrokeCap,
  BlurStyle,
  type SkCanvas,
  type SkImage,
} from "@shopify/react-native-skia";
import {
  makeSurface,
  fillPaint,
  strokePaint,
  linearGradientPaint,
  roundRectPath,
  drawTrackedText,
} from "../../reveal/art/canvasHelpers";
import { metalShader, hairlines, guilloche, microBlock } from "./artUtil";
import { typeVisualOf } from "../../reveal/art/typeVisual";
import type { CardRarity, VaultCardData } from "../config/types";

export interface PixelImage {
  data: Uint8Array;
  width: number;
  height: number;
}

export const CARD_ASPECT = 310 / 434; // width/height, for sizing the flat 2D fan layout
const CW = 310, CH = 434; // half the prototype's 620x868 — a phone shows these at a fraction of
// a browser-preview's width; every pixel constant below is native to this resolution.
const IVORY = "#f4ece0";
const CH_C = "#e8cf9a";

export const RARITY: Record<CardRarity, { ink: string; ribbon: [string, string, string]; glow: number; metal: number }> = {
  CORE: { ink: "#c9c3d6", ribbon: ["#2a2733", "#6d6879", "#2a2733"], glow: 0.0, metal: 0.22 },
  PRIME: { ink: "#f4ece0", ribbon: ["#33280f", "#b99b57", "#33280f"], glow: 0.35, metal: 0.42 },
  GRAIL: { ink: "#fff6e0", ribbon: ["#4a2f0c", "#f0d79c", "#4a2f0c"], glow: 1.0, metal: 0.62 },
};

// Deterministic pseudo-random so a card looks the same every time it is drawn (and the same on
// every device — no Math.random() in the art path). `card.seed` is meant to be derived from a
// real item's id (a stable per-catalog-item value, not per-render) whenever this art is driven
// by real content again.
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
    [0, "#0d0620"], [0.5, card.tint], [1, "#050310"],
  ]));

  const cx = x + w / 2, cy = y + h * 0.5;
  const haze = Skia.Paint();
  haze.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(cx, cy - h * 0.1), w * 0.75,
    [Skia.Color("rgba(180,140,255,0.24)"), Skia.Color("rgba(0,0,0,0)")],
    null, TileMode.Clamp
  ));
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), haze);

  for (let i = 6; i >= 1; i--) {
    canvas.drawArc(
      Skia.XYWHRect(cx - i * w * 0.1, cy + h * 0.22 - i * w * 0.1, i * w * 0.2, i * w * 0.2),
      180, 180, false,
      strokePaint(`rgba(232,207,162,${0.05 + i * 0.035})`, 1.4 + i * 0.5)
    );
  }

  guilloche(canvas, cx, cy, { r: w * 0.42, lobes: 9, lines: 14, turns: 4, stroke: "rgba(232,207,162,0.06)" });

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
    [0, "rgba(255,255,255,0.08)"], [0.4, "rgba(255,246,224,0.42)"],
    [0.52, "rgba(150,140,170,0.22)"], [1, "rgba(255,255,255,0.06)"],
  ]));
  canvas.drawPath(monolith, strokePaint("rgba(232,207,162,0.8)", 2));

  const dot = fillPaint("#ffffff");
  for (let i = 0; i < 46; i++) {
    const px = x + r() * w, py = y + r() * h;
    dot.setColor(Skia.Color(i % 5 ? "#ffffff" : CH_C));
    dot.setAlphaf(0.1 + r() * 0.4);
    const sz = 1 + (i % 4 === 0 ? 1 : 0);
    canvas.drawRect(Skia.XYWHRect(px, py, sz, sz), dot);
  }

  const glow = Skia.Paint();
  glow.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(cx, cy + h * 0.3), w * 0.46,
    [Skia.Color(`rgba(${card.glowRGB},0.4)`), Skia.Color("rgba(0,0,0,0)")],
    null, TileMode.Clamp
  ));
  canvas.drawRect(Skia.XYWHRect(x, cy, w, h - (cy - y)), glow);

  hairlines(canvas, x, y, w, h, { step: 4, angle: -0.5, alpha: 0.03 });
  canvas.restore();
}

// Black Label's art window: a molten rift opening in obsidian — heat gathers at the base, a
// fracture climbs the frame, embers leave it. Abstract on purpose, same as cardWindowArt above —
// the reveal engine never depends on a particular subject.
function pyroWindowArt(canvas: SkCanvas, x: number, y: number, w: number, h: number, card: VaultCardData) {
  const r = rng(card.seed);
  canvas.save();
  canvas.clipPath(roundRectPath(x, y, w, h, 8), ClipOp.Intersect, true);

  canvas.drawRect(Skia.XYWHRect(x, y, w, h), linearGradientPaint(x, y, x + w * 0.3, y + h, [
    [0, "#08070c"], [0.55, card.tint], [1, "#040305"],
  ]));

  const cx = x + w / 2, base = y + h * 0.92;

  const pool = Skia.Paint();
  pool.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(cx, base), w * 0.95,
    [Skia.Color(`rgba(${card.glowRGB},0.34)`), Skia.Color("rgba(255,110,30,0.12)"), Skia.Color("rgba(0,0,0,0)")],
    [0, 0.35, 1], TileMode.Clamp
  ));
  canvas.drawRect(Skia.XYWHRect(x, y, w, h), pool);

  const facetPaint = fillPaint("#ffffff");
  const facetStroke = strokePaint("rgba(216,184,119,0.08)", 1);
  for (let i = 0; i < 26; i++) {
    const px = x + r() * w, py = y + r() * h;
    const sz = 16 + r() * 54;
    const facet = Skia.Path.Make();
    facet.moveTo(px, py); facet.lineTo(px + sz * (0.4 + r()), py + sz * 0.5);
    facet.lineTo(px + sz * 0.2, py + sz); facet.close();
    const heat = Math.max(0, 1 - (py - y) / h);
    facetPaint.setColor(Skia.Color(`rgba(255,${130 + Math.floor(r() * 90)},${50 + Math.floor(r() * 40)},1)`));
    facetPaint.setAlphaf(0.03 + heat * 0.07);
    canvas.drawPath(facet, facetPaint);
    facetStroke.setAlphaf(0.05 + r() * 0.09);
    canvas.drawPath(facet, facetStroke);
  }

  // the fracture: a molten line climbing the frame with hot branches
  const branch = (x0: number, y0: number, x1: number, y1: number, wid: number, alpha: number) => {
    const path = Skia.Path.Make();
    path.moveTo(x0, y0);
    const steps = 14;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const nx = x0 + (x1 - x0) * t + Math.sin(t * 9 + card.seed) * w * 0.035 * (1 - t);
      const ny = y0 + (y1 - y0) * t;
      path.lineTo(nx, ny);
    }
    const paint = strokePaint(`rgba(255,236,200,${alpha})`, wid);
    paint.setStrokeCap(StrokeCap.Round);
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, wid * 2, true));
    canvas.drawPath(path, paint);
  };
  branch(cx + w * 0.02, base, cx - w * 0.04, y + h * 0.12, 2.6, 0.85);
  branch(cx + w * 0.02, y + h * 0.62, cx + w * 0.26, y + h * 0.3, 1.4, 0.45);
  branch(cx - w * 0.03, y + h * 0.5, cx - w * 0.28, y + h * 0.26, 1.2, 0.4);

  for (let i = 5; i >= 1; i--) {
    canvas.drawArc(
      Skia.XYWHRect(cx - i * w * 0.13, base - i * w * 0.13, i * w * 0.26, i * w * 0.26),
      180, 180, false,
      strokePaint(`rgba(216,184,119,${0.04 + i * 0.026})`, 1.2 + i * 0.4)
    );
  }

  guilloche(canvas, cx, y + h * 0.44, { r: w * 0.4, lobes: 9, lines: 12, turns: 4, stroke: "rgba(216,184,119,0.05)" });

  const emberPaint = fillPaint("#ffb765");
  for (let i = 0; i < 60; i++) {
    const px = cx + (r() - 0.5) * w * 0.9, py = y + r() * h;
    const heat = Math.max(0, 1 - (py - y) / h);
    emberPaint.setColor(Skia.Color(i % 6 ? (i % 3 ? "#ffb765" : "#ff6a18") : "#fff3dd"));
    emberPaint.setAlphaf(0.1 + r() * 0.36 * (0.3 + heat));
    const sz = 1 + (i % 5 === 0 ? 1.4 : 0);
    canvas.drawRect(Skia.XYWHRect(px, py, sz, sz), emberPaint);
  }

  const smokePaint = Skia.Paint();
  smokePaint.setShader(Skia.Shader.MakeLinearGradient(
    Skia.Point(0, y), Skia.Point(0, y + h * 0.4),
    [Skia.Color("rgba(16,12,10,0.72)"), Skia.Color("rgba(16,12,10,0)")],
    null, TileMode.Clamp
  ));
  canvas.drawRect(Skia.XYWHRect(x, y, w, h * 0.4), smokePaint);

  ([[x, y], [x + w, y], [x, y + h], [x + w, y + h]] as const).forEach(([px, py]) => {
    const paint = Skia.Paint();
    paint.setShader(Skia.Shader.MakeRadialGradient(
      Skia.Point(px, py), w * 0.6,
      [Skia.Color("rgba(0,0,0,0.66)"), Skia.Color("rgba(0,0,0,0)")],
      null, TileMode.Clamp
    ));
    canvas.drawRect(Skia.XYWHRect(x, y, w, h), paint);
  });

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
    [0, up ? "rgba(126,214,164,0.32)" : "rgba(214,126,140,0.3)"], [1, "rgba(0,0,0,0)"],
  ]));

  const curve = Skia.Path.Make();
  series.forEach((v, i) => (i ? curve.lineTo(sx(i), sy(v)) : curve.moveTo(sx(i), sy(v))));
  canvas.drawPath(curve, strokePaint(up ? "#7ed6a4" : "#d67e8c", 2));

  canvas.drawCircle(sx(series.length - 1), sy(series[series.length - 1]), 3.2, fillPaint(up ? "#a8ecc6" : "#eca8b4"));
}

function paintCardFace(canvas: SkCanvas, card: VaultCardData) {
  const rar = RARITY[card.rarity];
  // Theme hooks: a card may carry its own stock, ribbon and accent so a tier can restyle the
  // object without forking the layout — see this file's header.
  const stock = card.stock ?? ["#150a28", "#241041", "#0b0518"];
  const ribbon = card.ribbon ?? rar.ribbon;
  const acc = card.accent ?? CH_C;
  const accRGB = card.accentRGB ?? "232,207,162";
  const windowArt = card.windowArt === "pyro" ? pyroWindowArt : cardWindowArt;

  canvas.drawRect(Skia.XYWHRect(0, 0, CW, CH), linearGradientPaint(0, 0, CW, CH, [
    [0, stock[0]], [0.5, stock[1]], [1, stock[2]],
  ]));
  // A subtle type-tinted wash, bottom-anchored, fading out by the card's midpoint — only for
  // cards whose category actually carries a real Pokémon type (card.type; see
  // adaptBlackLabelDeck.ts). Only ever visible on this Skia-rendered fallback face — a real
  // pulled item with a catalog photo (textureUrl) skips this whole raster in favor of the real
  // image (see HoldToOpenFanReveal.tsx), so this alone is a small assist, not the main effect.
  if (card.type) {
    const visual = typeVisualOf(card.type);
    canvas.drawRect(Skia.XYWHRect(0, 0, CW, CH), linearGradientPaint(0, CH, 0, CH * 0.55, [
      [0, `rgba(${visual.rgb},0.22)`], [1, `rgba(${visual.rgb},0)`],
    ]));
  }
  hairlines(canvas, 0, 0, CW, CH, { step: 6, angle: -0.4, alpha: 0.035 });

  canvas.drawRect(Skia.XYWHRect(3, 3, CW - 6, CH - 6), strokePaint(ribbon[1], 5 + rar.glow * 2));
  canvas.drawRect(Skia.XYWHRect(11, 11, CW - 22, CH - 22), strokePaint(`rgba(${accRGB},0.26)`, 0.7));

  const rx = 20, ry = 21, rw = CW - 40, rh = 19;
  canvas.drawRect(Skia.XYWHRect(rx, ry, rw, rh), linearGradientPaint(rx, 0, rx + rw, 0, [
    [0, ribbon[0]], [0.5, ribbon[1]], [1, ribbon[2]],
  ]));
  canvas.drawRect(Skia.XYWHRect(rx, ry, rw, rh), strokePaint("rgba(0,0,0,0.5)", 0.5));
  drawTrackedText(canvas, `${card.rarityLabel} · ${card.edition}`, rx + rw / 2, ry + 13, {
    size: 8.5, bold: true, mono: true, letterSpacing: 3.5, fill: rar.glow > 0.5 ? "#1a0f2e" : "#f0ece4",
  });

  drawTrackedText(canvas, card.name, CW / 2, ry + 48, {
    size: 22, letterSpacing: 0.5, fill: IVORY, shadow: "rgba(0,0,0,0.6)", shadowBlur: 6,
  });
  drawTrackedText(canvas, `GRAILHAUS · SERIES I · ${card.finish}`, CW / 2, ry + 62, {
    size: 7, bold: true, mono: true, letterSpacing: 2.5, fill: "rgba(244,236,224,0.48)",
  });

  // Every pulled item that has a real catalog photo shows that instead of this raster entirely
  // (see VaultCardFanReveal / BlackLabelFanReveal) — this whole face, abstract art window
  // included, is only the fallback for an item with no texture.
  const ax = 24, ay = 106, aw = CW - 48, ah = 186;
  windowArt(canvas, ax, ay, aw, ah, card);
  canvas.drawPath(roundRectPath(ax, ay, aw, ah, 8), strokePaint(`rgba(${accRGB},0.5)`, 1));

  const vy = ay + ah + 15;
  const vh = 74;
  canvas.drawRect(Skia.XYWHRect(24, vy, CW - 48, vh), fillPaint("rgba(5,3,12,0.72)"));
  canvas.drawRect(Skia.XYWHRect(24, vy, CW - 48, vh), strokePaint("rgba(232,207,162,0.18)", 0.7));

  drawTrackedText(canvas, "EST. VALUE", 35, vy + 15, {
    size: 6.5, bold: true, mono: true, letterSpacing: 2, fill: "rgba(244,236,224,0.44)", align: "left",
  });
  drawTrackedText(canvas, card.value, 35, vy + 37, { size: 20, fill: IVORY, align: "left" });
  const up = card.delta >= 0;
  drawTrackedText(canvas, `${up ? "▲" : "▼"} ${Math.abs(card.delta).toFixed(1)}%`, CW - 35, vy + 18, {
    size: 11, bold: true, letterSpacing: 0.5, fill: up ? "#7ed6a4" : "#d67e8c", align: "right",
  });
  drawTrackedText(canvas, "7D", CW - 35, vy + 30, {
    size: 6, bold: true, mono: true, letterSpacing: 2, fill: "rgba(244,236,224,0.38)", align: "right",
  });
  sparkline(canvas, CW - 125, vy + 35, 90, 20, card.spark, up);
  // A tagline (Black Label's Grail card, per the design) replaces the held-since line rather
  // than sharing the row with it — same slot, mutually exclusive content.
  if (card.tagline) {
    drawTrackedText(canvas, `“${card.tagline}”`, CW / 2, vy + 64, {
      size: 10.5, italic: true, fill: `rgba(${accRGB},0.82)`,
    });
  } else {
    drawTrackedText(canvas, card.held, 35, vy + 64, {
      size: 6.5, bold: true, mono: true, letterSpacing: 1.5, fill: "rgba(244,236,224,0.38)", align: "left",
    });
  }

  const fy = CH - 25;
  const rule = Skia.Path.Make();
  rule.moveTo(24, fy - 13); rule.lineTo(CW - 24, fy - 13);
  canvas.drawPath(rule, strokePaint("rgba(232,207,162,0.16)", 0.5));
  drawTrackedText(canvas, "GRAILHAUS", 24, fy, {
    size: 9.5, bold: true, letterSpacing: 2.5, fill: "rgba(244,236,224,0.78)", align: "left",
  });
  drawTrackedText(canvas, card.serial, CW - 24, fy, {
    size: 7, bold: true, mono: true, letterSpacing: 1.5, fill: "rgba(244,236,224,0.44)", align: "right",
  });
  canvas.drawCircle(CW / 2, fy - 3, 7.5, strokePaint(acc, 1));
  canvas.drawCircle(CW / 2, fy - 3, 5.5, strokePaint(`rgba(${accRGB},0.34)`, 0.5));
  drawTrackedText(canvas, "✓", CW / 2, fy, { size: 7.5, bold: true, fill: acc });
}

export function drawCardFace(card: VaultCardData): PixelImage {
  const surf = makeSurface(CW, CH);
  paintCardFace(surf.canvas, card);
  return { data: surf.toRGBA(), width: CW, height: CH };
}

/** Same face art as drawCardFace, snapshotted as a displayable SkImage for flat 2D rendering
 * (VaultCardFanReveal) instead of a three.js texture — the fallback for a pulled item with no
 * real catalog photo; an item that has one shows that instead of this raster entirely. */
export function drawCardFaceImage(card: VaultCardData): SkImage {
  const surf = makeSurface(CW, CH);
  paintCardFace(surf.canvas, card);
  return surf.toImage();
}

export interface CardVersoTheme {
  stock?: [string, string, string];
  band?: string;
  accRGB?: string;
  second?: string;
  line1?: string;
  line2?: string;
}

// Shared card verso — collector artifact, no per-card data. `theme` lets a tier restyle the
// substrate without a second layout (see this file's header).
function paintCardVerso(canvas: SkCanvas, theme: CardVersoTheme = {}) {
  const {
    stock = ["#100722", "#1f0f3a", "#08040f"], band = "#6f5a2c",
    accRGB = "232,207,162", second = "170,132,246",
    line1 = "VAULT BREAK · SERIES I", line2 = "THE COLLECTOR'S VAULT",
  } = theme;
  canvas.drawRect(Skia.XYWHRect(0, 0, CW, CH), linearGradientPaint(0, 0, CW, CH, [
    [0, stock[0]], [0.5, stock[1]], [1, stock[2]],
  ]));
  hairlines(canvas, 0, 0, CW, CH, { step: 5, angle: 0.42, alpha: 0.04 });

  canvas.drawRect(Skia.XYWHRect(3, 3, CW - 6, CH - 6), strokePaint(band, 5));
  canvas.drawRect(Skia.XYWHRect(12, 12, CW - 24, CH - 24), strokePaint(`rgba(${accRGB},0.2)`, 0.6));

  guilloche(canvas, CW / 2, CH * 0.46, { r: 107, lobes: 12, lines: 24, stroke: `rgba(${accRGB},0.11)` });
  guilloche(canvas, CW / 2, CH * 0.46, { r: 56, lobes: 6, lines: 14, turns: 3, stroke: `rgba(${second},0.12)` });

  canvas.save();
  canvas.translate(CW / 2, CH * 0.46);
  const seal = Skia.Path.Make();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 48, y = Math.sin(a) * 48;
    if (i === 0) seal.moveTo(x, y); else seal.lineTo(x, y);
  }
  seal.close();
  canvas.drawPath(seal, fillPaint("rgba(8,4,18,0.72)"));
  const sealStroke = Skia.Paint();
  sealStroke.setAntiAlias(true);
  sealStroke.setStyle(PaintStyle.Stroke);
  sealStroke.setStrokeWidth(1.5);
  sealStroke.setShader(metalShader(-48, 48));
  canvas.drawPath(seal, sealStroke);
  drawTrackedText(canvas, "G", 0, 22, { size: 61, bold: true, shader: metalShader(-35, 25) });
  canvas.restore();

  drawTrackedText(canvas, "GRAILHAUS", CW / 2, 64, { size: 15, bold: true, letterSpacing: 4, shader: metalShader(50, 67) });
  drawTrackedText(canvas, "COLLECTOR CARD GAME", CW / 2, 79, {
    size: 6.5, bold: true, mono: true, letterSpacing: 3, fill: "rgba(244,236,224,0.5)",
  });
  drawTrackedText(canvas, line1, CW / 2, CH - 74, {
    size: 7.5, bold: true, mono: true, letterSpacing: 3.5, fill: `rgba(${accRGB},0.62)`,
  });
  microBlock(canvas, CW / 2 - 60, CH - 61, 120, 4, { rowH: 4, alpha: 0.18 });
  drawTrackedText(canvas, line2, CW / 2, CH - 29, {
    size: 6, bold: true, mono: true, letterSpacing: 2.5, fill: "rgba(244,236,224,0.34)",
  });
}

export function drawCardVerso(theme: CardVersoTheme = {}): PixelImage {
  const surf = makeSurface(CW, CH);
  paintCardVerso(surf.canvas, theme);
  return { data: surf.toRGBA(), width: CW, height: CH };
}

/** Same verso art as drawCardVerso, snapshotted as a displayable SkImage. */
export function drawCardVersoImage(theme: CardVersoTheme = {}): SkImage {
  const surf = makeSurface(CW, CH);
  paintCardVerso(surf.canvas, theme);
  return surf.toImage();
}
