// Ported from card-pack-reveal-prototype/src/vault/art/vaultArt.ts onto Skia's offscreen
// canvas — the Tier 2 "Vault Break" pack artwork: deep royal violet over plum, satin metallic
// finish, brushed champagne-gold detailing, an embossed GrailHaus medallion, debossed
// architectural geometry. Every pixel constant is scaled by `s = width / DESIGN_WIDTH` — see
// engine/buildVaultPackObject.ts for the phone-appropriate resolution this buys back.
import {
  Skia,
  ClipOp,
  BlendMode,
  TileMode,
  PaintStyle,
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
import {
  metalShader,
  embossText,
  hairlines,
  grooveLine,
  guilloche,
  microBlock,
  barcode,
} from "./artUtil";

export interface PixelImage {
  data: Uint8Array;
  width: number;
  height: number;
}

const DESIGN_W = 800;
const TEETH = 16;

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

// Satin violet substrate: plum in the shadows, royal violet in the sheen band, near-black at
// both edges. Cross-lit so the pack has a lit side.
function satinBase(canvas: SkCanvas, w: number, h: number, s: number) {
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), linearGradientPaint(0, 0, w, 0, [
    [0, "#07030e"], [0.08, "#160828"], [0.22, "#2b1152"], [0.38, "#3a1a6e"],
    [0.5, "#31165e"], [0.62, "#3f1d78"], [0.78, "#221040"], [0.92, "#120722"],
    [1, "#05020a"],
  ]));
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), linearGradientPaint(0, 0, 0, h, [
    [0, "rgba(190,150,255,0.10)"], [0.18, "rgba(0,0,0,0)"], [0.62, "rgba(0,0,0,0.18)"],
    [1, "rgba(0,0,0,0.62)"],
  ]));
  hairlines(canvas, 0, 0, w, h, { step: 5 * s, angle: -0.38, alpha: 0.045 });
  hairlines(canvas, 0, 0, w, h, { step: 23 * s, angle: 1.32, alpha: 0.022 });

  ([[0, 0], [w, 0], [0, h], [w, h]] as const).forEach(([cx, cy]) => {
    const paint = Skia.Paint();
    paint.setShader(Skia.Shader.MakeRadialGradient(
      Skia.Point(cx, cy), w * 0.52,
      [Skia.Color("rgba(0,0,0,0.55)"), Skia.Color("rgba(0,0,0,0)")],
      null, TileMode.Clamp
    ));
    canvas.drawRect(Skia.XYWHRect(0, 0, w, h), paint);
  });
}

// Debossed architectural geometry: a tall pressed panel with chamfered corners and stepped
// inner returns. Structure, not ornament.
function debossedArchitecture(canvas: SkCanvas, x: number, y: number, w: number, h: number, s: number) {
  const chamfer = 46 * s;
  const path = (inset: number) => {
    const a = x + inset, b = y + inset, c = x + w - inset, d = y + h - inset;
    const k = chamfer * (1 - inset / (w * 0.5));
    const p = Skia.Path.Make();
    p.moveTo(a + k, b); p.lineTo(c - k, b); p.lineTo(c, b + k);
    p.lineTo(c, d - k); p.lineTo(c - k, d); p.lineTo(a + k, d);
    p.lineTo(a, d - k); p.lineTo(a, b + k); p.close();
    return p;
  };
  canvas.drawPath(path(0), fillPaint("rgba(8,3,18,0.42)"));
  ([0, 14 * s, 30 * s] as const).forEach((inset, n) => {
    canvas.drawPath(path(inset), strokePaint(n === 0 ? "rgba(0,0,0,0.6)" : `rgba(232,207,162,${0.16 - n * 0.045})`, n === 0 ? 5 * s : 1.4 * s));
    if (n === 0) {
      canvas.save();
      canvas.translate(0, 3 * s);
      canvas.drawPath(path(inset), strokePaint("rgba(255,240,205,0.14)", 2 * s));
      canvas.restore();
    }
  });
}

// Heavier crimp: taller band, finer knurl, deeper shadow where jaw meets body.
function crimpBand(canvas: SkCanvas, w: number, y0: number, y1: number, top: boolean, s: number) {
  const h = y1 - y0;
  canvas.drawRect(Skia.XYWHRect(0, y0, w, h), linearGradientPaint(0, y0, 0, y1, top
    ? [[0, "#a98fd8"], [0.24, "#6b4aa8"], [0.6, "#341a60"], [1, "#0d0420"]]
    : [[0, "#0d0420"], [0.4, "#341a60"], [0.76, "#6b4aa8"], [1, "#a98fd8"]]));
  const lightP = fillPaint("rgba(255,246,224,0.26)");
  const darkP = fillPaint("rgba(0,0,0,0.58)");
  for (let x = 0; x < w; x += 9 * s) {
    canvas.drawRect(Skia.XYWHRect(x, y0, 3 * s, h), lightP);
    canvas.drawRect(Skia.XYWHRect(x + 4 * s, y0, 4 * s, h), darkP);
  }
  const ty = top ? y1 - h * 0.32 : y0 + h * 0.22;
  canvas.drawRect(Skia.XYWHRect(0, ty, w, 2 * s), fillPaint("rgba(232,207,162,0.5)"));
  canvas.drawRect(Skia.XYWHRect(0, top ? y0 : y1 - 3 * s, w, 3 * s), fillPaint("rgba(255,255,255,0.44)"));
  canvas.drawRect(Skia.XYWHRect(0, top ? y1 - 7 * s : y0, w, 7 * s), fillPaint("rgba(0,0,0,0.72)"));
}

// The tear channel. No printed rainbow strip — a debossed groove between two champagne threads,
// with corner ticks. The rip itself supplies the drama.
function tearChannel(canvas: SkCanvas, w: number, seam: number, s: number) {
  const y = seam - 16 * s;
  canvas.drawRect(Skia.XYWHRect(0, y - 26 * s, w, 44 * s), linearGradientPaint(0, y - 26 * s, 0, y + 18 * s, [
    [0, "rgba(6,2,14,0)"], [0.4, "rgba(6,2,14,0.55)"], [1, "rgba(6,2,14,0)"],
  ]));
  grooveLine(canvas, 30 * s, y, w - 30 * s, y, { w: 7 * s, dark: "rgba(0,0,0,0.72)", lit: "rgba(255,240,205,0.20)" });

  const dash = strokePaint("rgba(232,207,162,0.42)", 2 * s);
  dash.setPathEffect(Skia.PathEffect.MakeDash([5 * s, 9 * s], 0));
  const dashPath = Skia.Path.Make();
  dashPath.moveTo(38 * s, y); dashPath.lineTo(w - 38 * s, y);
  canvas.drawPath(dashPath, dash);

  const hairA = Skia.Path.Make();
  hairA.moveTo(30 * s, y - 11 * s); hairA.lineTo(w - 30 * s, y - 11 * s);
  canvas.drawPath(hairA, strokePaint("rgba(232,207,162,0.28)", 1 * s));
  const hairB = Skia.Path.Make();
  hairB.moveTo(30 * s, y + 11 * s); hairB.lineTo(w - 30 * s, y + 11 * s);
  canvas.drawPath(hairB, strokePaint("rgba(232,207,162,0.28)", 1 * s));

  ([[44 * s, false], [w - 44 * s, true]] as const).forEach(([x, right]) => {
    drawTrackedText(canvas, "TEAR", x, y - 22 * s, {
      size: 12 * s, bold: true, mono: true, letterSpacing: 4 * s,
      fill: "rgba(232,207,162,0.66)", align: right ? "right" : "left",
    });
    const arrow = Skia.Path.Make();
    arrow.moveTo(right ? x + 2 * s : x - 2 * s, y - 6 * s);
    arrow.lineTo(right ? x - 12 * s : x + 12 * s, y);
    arrow.lineTo(right ? x + 2 * s : x - 2 * s, y + 6 * s);
    canvas.drawPath(arrow, strokePaint("rgba(232,207,162,0.5)", 2 * s));
  });
}

// Embossed GrailHaus medallion: vault-door rings, chamfered octagon frame, bevelled G. Built
// from bed/rim/face passes so it reads as struck metal.
function medallion(canvas: SkCanvas, cx: number, cy: number, R: number, logo: SkImage | null) {
  canvas.save();
  canvas.translate(cx, cy);

  const well = Skia.Paint();
  well.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(0, -R * 0.2), R * 1.12,
    [Skia.Color("rgba(58,26,110,0.85)"), Skia.Color("rgba(16,6,32,0.9)"), Skia.Color("rgba(4,1,10,0.95)")],
    [0, 0.62, 1], TileMode.Clamp
  ));
  canvas.drawCircle(0, 0, R * 1.12, well);

  ([1.0, 0.86, 0.71] as const).forEach((k, i) => {
    canvas.drawCircle(0, 0, R * k, strokePaint("rgba(0,0,0,0.6)", 9 - i * 2));
    canvas.drawArc(
      Skia.XYWHRect(-R * k, -R * k, R * k * 2, R * k * 2),
      1.06 * 180, 0.88 * 180, false,
      strokePaint(`rgba(232,207,162,${0.5 - i * 0.1})`, 3 - i * 0.6)
    );
  });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * R * 0.93, y = Math.sin(a) * R * 0.93;
    canvas.drawCircle(x, y, R * 0.032, fillPaint("rgba(0,0,0,0.7)"));
    const boltPaint = Skia.Paint();
    boltPaint.setShader(metalShader(y - R * 0.03, y + R * 0.03));
    canvas.drawCircle(x - R * 0.008, y - R * 0.01, R * 0.024, boltPaint);
  }

  const oct = (rad: number) => {
    const p = Skia.Path.Make();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
    }
    p.close();
    return p;
  };
  canvas.drawPath(oct(R * 0.66), fillPaint("rgba(10,4,22,0.72)"));
  canvas.drawPath(oct(R * 0.66), strokePaint("rgba(0,0,0,0.75)", 8));
  const octStroke = Skia.Paint();
  octStroke.setStyle(PaintStyle.Stroke);
  octStroke.setStrokeWidth(3.4);
  octStroke.setAntiAlias(true);
  octStroke.setShader(metalShader(-R * 0.66, R * 0.66));
  canvas.drawPath(oct(R * 0.66), octStroke);
  canvas.drawPath(oct(R * 0.56), strokePaint("rgba(232,207,162,0.24)", 1.2));

  canvas.save();
  canvas.clipPath(oct(R * 0.54), ClipOp.Intersect, true);
  canvas.drawRect(Skia.XYWHRect(-R, -R, R * 2, R * 2), linearGradientPaint(-R * 0.5, -R * 0.5, R * 0.5, R * 0.5, [
    [0, "#25104a"], [0.5, "#5b2ea8"], [1, "#150829"],
  ]));
  hairlines(canvas, -R, -R, R * 2, R * 2, { step: 7, angle: 0.6, alpha: 0.07 });
  canvas.restore();

  if (logo) {
    const sSize = R * 1.0;
    canvas.save();
    canvas.clipPath(oct(R * 0.54), ClipOp.Intersect, true);
    const imgPaint = Skia.Paint();
    imgPaint.setAntiAlias(true);
    imgPaint.setAlphaf(0.96);
    canvas.drawImageRect(
      logo,
      Skia.XYWHRect(0, 0, logo.width(), logo.height()),
      Skia.XYWHRect(-sSize / 2, -sSize / 2, sSize, sSize),
      imgPaint,
      true
    );
    canvas.restore();
  } else {
    const gShader = metalShader(-R * 0.6, R * 0.3);
    embossText(canvas, "G", 0, R * 0.29, {
      size: R * 0.92, bold: true, shader: gShader,
      depth: R * 0.022, bed: "rgba(0,0,0,0.8)", rim: "rgba(255,246,220,0.34)",
    });
  }
  canvas.restore();
}

// Champagne bevelled plate carrying the edition name.
function editionPlate(canvas: SkCanvas, cx: number, cy: number, w: number, h: number, label: string) {
  const x = cx - w / 2, y = cy - h / 2, k = 22;
  const shape = (inset: number) => {
    const a = x + inset, b = y + inset, c = x + w - inset, d = y + h - inset;
    const p = Skia.Path.Make();
    p.moveTo(a + k, b); p.lineTo(c - k, b); p.lineTo(c, b + k);
    p.lineTo(c, d - k); p.lineTo(c - k, d); p.lineTo(a + k, d);
    p.lineTo(a, d - k); p.lineTo(a, b + k); p.close();
    return p;
  };
  canvas.drawPath(shape(-6), fillPaint("rgba(0,0,0,0.55)"));
  canvas.drawPath(shape(0), linearGradientPaint(0, y, 0, y + h, [
    [0, "#170a2b"], [0.5, "#0d0418"], [1, "#1a0d31"],
  ]));
  canvas.save();
  canvas.clipPath(shape(0), ClipOp.Intersect, true);
  hairlines(canvas, x, y, w, h, { step: 5, angle: -0.3, alpha: 0.05 });
  canvas.restore();
  const strokeP = Skia.Paint();
  strokeP.setStyle(PaintStyle.Stroke);
  strokeP.setAntiAlias(true);
  strokeP.setStrokeWidth(3.2);
  strokeP.setShader(metalShader(y, y + h));
  canvas.drawPath(shape(0), strokeP);
  canvas.drawPath(shape(9), strokePaint("rgba(232,207,162,0.22)", 1.2));

  embossText(canvas, label, cx, cy + h * 0.19, {
    size: h * 0.5, bold: true, letterSpacing: 5, shader: metalShader(cy - h * 0.32, cy + h * 0.24),
    depth: 2.4, bed: "rgba(0,0,0,0.85)", rim: "rgba(255,246,220,0.22)",
  });
}

export interface VaultFaceInput {
  width: number;
  height: number;
  seamFrac: number;
  flapFrac: number;
  logo?: SkImage | null;
}

export function drawFront(input: VaultFaceInput): PixelImage {
  const { width: W, height: H, seamFrac, flapFrac, logo } = input;
  const s = W / DESIGN_W;
  const surf = makeSurface(W, H);
  const { canvas } = surf;

  canvas.save();
  canvas.clipPath(silhouettePath(W, H, 34 * s), ClipOp.Intersect, true);
  satinBase(canvas, W, H, s);

  const flap = H * flapFrac, seam = H * seamFrac;
  debossedArchitecture(canvas, 40 * s, seam + 26 * s, W - 80 * s, H - seam - flap - 62 * s, s);

  embossText(canvas, "GRAILHAUS", W / 2, 128 * s, {
    size: 56 * s, bold: true, letterSpacing: 7 * s, shader: metalShader(86 * s, 134 * s),
    depth: 2.6 * s, bed: "rgba(0,0,0,0.8)", rim: "rgba(255,246,220,0.26)",
  });
  drawTrackedText(canvas, "COLLECTOR CARD GAME", W / 2, 158 * s, {
    size: 14 * s, bold: true, mono: true, letterSpacing: 7 * s, fill: "rgba(244,236,224,0.7)",
  });
  const ruleA = Skia.Path.Make();
  ruleA.moveTo(W / 2 - 150 * s, 182 * s); ruleA.lineTo(W / 2 - 56 * s, 182 * s);
  canvas.drawPath(ruleA, strokePaint("rgba(232,207,162,0.38)", 1 * s));
  const ruleB = Skia.Path.Make();
  ruleB.moveTo(W / 2 + 56 * s, 182 * s); ruleB.lineTo(W / 2 + 150 * s, 182 * s);
  canvas.drawPath(ruleB, strokePaint("rgba(232,207,162,0.38)", 1 * s));
  drawTrackedText(canvas, "SERIES I", W / 2, 188 * s, {
    size: 14 * s, bold: true, mono: true, letterSpacing: 6 * s, fill: "#e8cf9a",
  });

  const bw = 96 * s, bh = 38 * s, bx = W - 34 * s - bw, by = 84 * s;
  const badge = roundRectPath(bx, by, bw, bh, 6 * s);
  canvas.drawPath(badge, fillPaint("rgba(8,3,18,0.9)"));
  const badgeStroke = Skia.Paint();
  badgeStroke.setStyle(PaintStyle.Stroke); badgeStroke.setAntiAlias(true); badgeStroke.setStrokeWidth(2 * s);
  badgeStroke.setShader(metalShader(by, by + bh));
  canvas.drawPath(badge, badgeStroke);
  canvas.drawPath(roundRectPath(bx + 5 * s, by + 5 * s, bw - 10 * s, bh - 10 * s, 4 * s), strokePaint("rgba(232,207,162,0.22)", 1 * s));
  drawTrackedText(canvas, "S·1a", bx + bw / 2, by + 27 * s, {
    size: 22 * s, bold: true, letterSpacing: 1 * s, shader: metalShader(by + 6 * s, by + 34 * s),
  });

  ["MORE", "THAN", "CARDS"].forEach((l, i) => drawTrackedText(canvas, l, 30 * s, (232 + i * 20) * s, {
    size: 11 * s, bold: true, mono: true, letterSpacing: 3 * s, fill: "rgba(232,207,162,0.46)", align: "left",
  }));
  ["A HIGHER", "REALM", "AWAITS"].forEach((l, i) => drawTrackedText(canvas, l, W - 30 * s, (232 + i * 20) * s, {
    size: 11 * s, bold: true, mono: true, letterSpacing: 3 * s, fill: "rgba(232,207,162,0.46)", align: "right",
  }));

  medallion(canvas, W / 2, seam + 300 * s, 236 * s, logo ?? null);
  editionPlate(canvas, W / 2, seam + 596 * s, 500 * s, 92 * s, "VAULT BREAK");
  drawTrackedText(canvas, "PREMIUM COLLECTOR PACK", W / 2, seam + 672 * s, {
    size: 15 * s, bold: true, mono: true, letterSpacing: 7 * s, fill: "rgba(244,236,224,0.56)",
  });

  const ly = seam + 716 * s;
  drawTrackedText(canvas, "CORE", W / 2 - 150 * s, ly, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 4 * s, fill: "rgba(232,207,162,0.5)",
  });
  drawTrackedText(canvas, "PRIME", W / 2, ly, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 4 * s, fill: "rgba(232,207,162,0.66)",
  });
  drawTrackedText(canvas, "GRAIL", W / 2 + 150 * s, ly, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 4 * s, fill: "#e8cf9a",
  });
  const tickPaint = fillPaint("rgba(232,207,162,0.3)");
  ([-75, 75] as const).forEach((d) => canvas.drawRect(Skia.XYWHRect(W / 2 + d * s, ly - 10 * s, 1 * s, 12 * s), tickPaint));

  drawTrackedText(canvas, "6 CARDS INSIDE", W / 2, H - 118 * s, {
    size: 17 * s, bold: true, mono: true, letterSpacing: 8 * s, shader: metalShader(H - 138 * s, H - 110 * s),
  });

  crimpBand(canvas, W, 0, flap, true, s);
  crimpBand(canvas, W, H - flap, H, false, s);
  tearChannel(canvas, W, seam, s);
  canvas.restore();
  return { data: surf.toRGBA(), width: W, height: H };
}

export function drawBack(input: VaultFaceInput): PixelImage {
  const { width: W, height: H, seamFrac, flapFrac } = input;
  const s = W / DESIGN_W;
  const surf = makeSurface(W, H);
  const { canvas } = surf;

  canvas.save();
  canvas.clipPath(silhouettePath(W, H, 34 * s), ClipOp.Intersect, true);
  satinBase(canvas, W, H, s);
  const flap = H * flapFrac, seam = H * seamFrac;

  guilloche(canvas, W / 2, H * 0.44, { r: 250 * s, lobes: 13, lines: 26, ripple: 0.14, stroke: "rgba(232,207,162,0.09)" });
  guilloche(canvas, W / 2, H * 0.44, { r: 132 * s, lobes: 7, lines: 16, turns: 3, ripple: 0.2, stroke: "rgba(180,140,255,0.1)" });

  drawTrackedText(canvas, "GRAILHAUS · SERIES I", W / 2, 132 * s, {
    size: 22 * s, bold: true, mono: true, letterSpacing: 9 * s, shader: metalShader(112 * s, 138 * s),
  });
  drawTrackedText(canvas, "CERTIFIED COLLECTOR PACKAGING", W / 2, 164 * s, {
    size: 12 * s, bold: true, mono: true, letterSpacing: 5 * s, fill: "rgba(244,236,224,0.44)",
  });

  const ax = 56 * s, ay = seam + 40 * s, aw = W - 112 * s, ah = H - seam - flap - 96 * s;
  canvas.drawPath(roundRectPath(ax, ay, aw, ah, 10 * s), strokePaint("rgba(0,0,0,0.6)", 5 * s));
  canvas.drawPath(roundRectPath(ax, ay, aw, ah, 10 * s), strokePaint("rgba(232,207,162,0.3)", 1.4 * s));
  canvas.drawPath(roundRectPath(ax + 10 * s, ay + 10 * s, aw - 20 * s, ah - 20 * s, 6 * s), strokePaint("rgba(232,207,162,0.14)", 1 * s));

  const gridPaint = strokePaint("rgba(232,207,162,0.04)", 1 * s);
  for (let i = 1; i < 6; i++) {
    const y = ay + (ah * i) / 6;
    const gp = Skia.Path.Make();
    gp.moveTo(ax + 18 * s, y); gp.lineTo(ax + aw - 18 * s, y);
    canvas.drawPath(gp, gridPaint);
  }

  editionPlate(canvas, W / 2, ay + 108 * s, 420 * s, 74 * s, "VAULT BREAK");
  drawTrackedText(canvas, "TIER II · COLLECTOR LUXURY", W / 2, ay + 170 * s, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 6 * s, fill: "rgba(232,207,162,0.52)",
  });

  const cy0 = ay + 226 * s;
  const rows: [string, string][] = [
    ["CONTENTS", "6 COLLECTOR CARDS"],
    ["GUARANTEE", "1 PRIME OR ABOVE"],
    ["SEALED", "AT SOURCE · GH ATELIER"],
    ["AUTH", "VB-S1A-00486"],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy0 + i * 40 * s;
    drawTrackedText(canvas, k, ax + 40 * s, y, {
      size: 12 * s, bold: true, mono: true, letterSpacing: 4 * s, fill: "rgba(232,207,162,0.5)", align: "left",
    });
    drawTrackedText(canvas, v, ax + aw - 40 * s, y, {
      size: 13 * s, bold: true, mono: true, letterSpacing: 2 * s, fill: "rgba(244,236,224,0.72)", align: "right",
    });
    const sep = Skia.Path.Make();
    sep.moveTo(ax + 40 * s, y + 12 * s); sep.lineTo(ax + aw - 40 * s, y + 12 * s);
    canvas.drawPath(sep, strokePaint("rgba(232,207,162,0.1)", 1 * s));
  });

  microBlock(canvas, ax + 40 * s, cy0 + 176 * s, aw - 80 * s, 7, { alpha: 0.2, rowH: 7 * s });
  drawTrackedText(canvas, "COLLECTION · THE COLLECTOR'S VAULT", W / 2, cy0 + 258 * s, {
    size: 13 * s, bold: true, mono: true, letterSpacing: 5 * s, fill: "rgba(232,207,162,0.55)",
  });

  barcode(canvas, W / 2 - 96 * s, H - 176 * s, 192 * s, 54 * s, { bg: "rgba(244,236,224,0.86)", ink: "#0a0413", seed: 41 });
  drawTrackedText(canvas, "VB · S1A · 006", W / 2, H - 104 * s, {
    size: 12 * s, bold: true, mono: true, letterSpacing: 5 * s, fill: "rgba(244,236,224,0.4)",
  });

  crimpBand(canvas, W, 0, flap, true, s);
  crimpBand(canvas, W, H - flap, H, false, s);
  tearChannel(canvas, W, seam, s);
  canvas.restore();
  return { data: surf.toRGBA(), width: W, height: H };
}

// The inner liner: brushed champagne metal on a dark web. It is the material itself that reads
// premium, so this is a straight anisotropic metal sheet.
export function drawLiner(width = 256, height = 256): PixelImage {
  const surf = makeSurface(width, height);
  const { canvas } = surf;
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), linearGradientPaint(0, 0, width, 0, [
    [0, "#171021"], [0.14, "#4a3d28"], [0.3, "#a08a5c"], [0.42, "#e2cfa4"],
    [0.5, "#f6ead0"], [0.58, "#cbb37e"], [0.72, "#7a683f"], [0.88, "#2e2618"],
    [1, "#100c14"],
  ]));
  hairlines(canvas, 0, 0, width, height, { step: 3, angle: Math.PI / 2, alpha: 0.1 });
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), linearGradientPaint(0, 0, 0, height, [
    [0, "rgba(255,255,255,0.14)"], [0.4, "rgba(0,0,0,0.1)"], [1, "rgba(0,0,0,0.7)"],
  ]));
  return { data: surf.toRGBA(), width, height };
}

// Controlled specular sweep for the seam while the user pulls. Champagne, not rainbow: the
// metal responds, it does not glow.
export function drawShine(width = 512, height = 32): PixelImage {
  const surf = makeSurface(width, height);
  const { canvas } = surf;
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), linearGradientPaint(0, 0, width, 0, [
    [0, "rgba(0,0,0,0)"], [0.36, "rgba(90,64,20,0.22)"], [0.46, "#d9c08a"],
    [0.5, "#fff6e0"], [0.54, "#cfae72"], [0.64, "rgba(90,64,20,0.22)"], [1, "rgba(0,0,0,0)"],
  ]));
  const vignette = linearGradientPaint(0, 0, 0, height, [
    [0, "rgba(0,0,0,1)"], [0.34, "rgba(0,0,0,0.3)"], [0.5, "rgba(0,0,0,0)"],
    [0.66, "rgba(0,0,0,0.3)"], [1, "rgba(0,0,0,1)"],
  ]);
  vignette.setBlendMode(BlendMode.Multiply);
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), vignette);
  return { data: surf.toRGBA(), width, height };
}
