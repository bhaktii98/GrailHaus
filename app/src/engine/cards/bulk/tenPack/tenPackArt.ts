// Ported from the Claude Design handoff's tenpack-art.js — the canvas texture layer for the
// zip-pouch bundle and the ten packs stowed inside it. Same drawing vocabulary `reveal/art/
// packArt.ts` already established for the single-pack tear (Skia offscreen surface standing in
// for a DOM <canvas>, `makeDataTexture` feeding the pixels into three.js) — this is a second,
// smaller art module rather than an extension of that one because the source it's ported from is
// its own self-contained file with its own visual language (obsidian + a crowned "G" monogram,
// not the trading-card foil-pack look). Every color that isn't structural (blacks, shadow alphas)
// comes from the caller's `PackPalette`, so this reads as this tier's own bundle — Vault Break's
// champagne, Black Label's bronze — not always the reference's fixed gold.
import {
  Skia,
  ClipOp,
  BlendMode,
  BlurStyle,
  ColorType,
  AlphaType,
  TileMode,
  type SkCanvas,
  type SkShader,
  type SkImage,
} from '@shopify/react-native-skia';
import type { CategoryPersonality, PackPalette } from '../../reveal/config/types';
import {
  makeSurface,
  fillPaint,
  strokePaint,
  linearGradientPaint,
  linearGradientShader,
  drawTrackedText,
} from '../../reveal/art/canvasHelpers';
import { drawFront, drawBack, type PixelImage } from '../../reveal/art/packArt';

function hexRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

// Multi-octave 1D noise, ported unchanged from art-util.js — shared by the tear edge and the
// gold-vein wander.
function noise1(x: number): number {
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

// A smooth, low-frequency torn edge — long soft curves rather than a hard zigzag, exactly the
// reference's own `tearAt`.
function tearAt(x: number, w: number, seed: number): number {
  const u = x / w;
  return (
    0.5 +
    Math.sin(u * 5.2 + seed) * 0.3 +
    Math.sin(u * 11.7 + seed * 2.3) * 0.14 +
    Math.sin(u * 2.1 + seed * 0.7) * 0.1
  );
}

function tearLipPath(w: number, seed: number, depth: number, lipOffset: number) {
  const at = (x: number) => depth * tearAt(x, w, seed) + lipOffset;
  const path = Skia.Path.Make();
  const STEPS = 96;
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * w;
    const y = at(x);
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path;
}

/**
 * The source's `tearTop`, adapted for Skia's immediate-mode canvas: the original erases pixels
 * already drawn via `destination-out` compositing, which Skia supports the same way via
 * `BlendMode.DstOut` on a fill covering the region above the tear curve — so this still runs
 * *after* the rest of a panel's art, not as a pre-drawing clip (a clip can only confine what's
 * drawn after it's established, and the tear needs to cut into content already painted).
 */
function applyTearTop(canvas: SkCanvas, w: number, h: number, seed: number, depth: number, lip = 3) {
  const at = (x: number) => depth * tearAt(x, w, seed);
  const erase = Skia.Path.Make();
  erase.moveTo(0, 0);
  const STEPS = 96;
  for (let i = 0; i <= STEPS; i++) {
    const x = (i / STEPS) * w;
    erase.lineTo(x, at(x));
  }
  erase.lineTo(w, 0);
  erase.close();
  const erasePaint = fillPaint('#000000');
  erasePaint.setBlendMode(BlendMode.DstOut);
  canvas.drawPath(erase, erasePaint);

  // A quiet lit lip right under the new edge.
  const lipPaint = strokePaint('#ffeec8', lip);
  lipPaint.setAlphaf(0.45);
  canvas.drawPath(tearLipPath(w, seed, depth, lip * 0.8), lipPaint);
}

// Quiet obsidian body — a soft violet gradient with a few faint gold veins, no glints.
function obsidian(canvas: SkCanvas, w: number, h: number, palette: PackPalette, veins = 7, alpha = 0.17) {
  const mid = mixHex(palette.violetDeep, palette.violet, 0.55);
  canvas.drawRect(
    Skia.XYWHRect(0, 0, w, h),
    linearGradientPaint(0, 0, w * 0.4, h, [
      [0, palette.violet],
      [0.45, mid],
      [1, palette.violetDeep],
    ])
  );
  for (let i = 0; i < veins; i++) {
    const y0 = ((i + 0.5) / veins) * h;
    const path = Skia.Path.Make();
    path.moveTo(-20, y0);
    for (let x = 0; x <= w + 20; x += 40) {
      path.lineTo(x, y0 + noise1((x / w) * 2 + i * 5.1) * h * 0.05);
    }
    const veinPaint = strokePaint(palette.gold, 1.2);
    veinPaint.setAlphaf(alpha);
    canvas.drawPath(path, veinPaint);
  }
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function metalShader(y0: number, y1: number, palette: PackPalette): SkShader {
  return linearGradientShader(0, y0, 0, y1, [
    [0, palette.goldDark],
    [0.14, palette.goldHi],
    [0.32, palette.bone],
    [0.5, palette.gold],
    [0.66, palette.goldHi],
    [0.86, palette.goldDark],
    [1, palette.ink],
  ]);
}

// The crowned "G" monogram on the pouch's back panel.
function crownG(canvas: SkCanvas, cx: number, cy: number, s: number, palette: PackPalette) {
  canvas.save();
  canvas.translate(cx, cy);
  canvas.scale(s, s);

  const crown = Skia.Path.Make();
  crown.moveTo(-80, -100);
  crown.lineTo(-54, -144);
  crown.lineTo(-26, -108);
  crown.lineTo(0, -158);
  crown.lineTo(26, -108);
  crown.lineTo(54, -144);
  crown.lineTo(80, -100);
  crown.close();
  const crownPaint = fillPaint(palette.gold);
  crownPaint.setShader(metalShader(-158, -96, palette));
  canvas.drawPath(crown, crownPaint);

  const ringPaint = strokePaint(palette.gold, 9);
  ringPaint.setShader(metalShader(-86, 86, palette));
  canvas.drawCircle(0, 0, 86, ringPaint);

  drawTrackedText(canvas, 'G', 0, 44, { size: 140, bold: true, shader: metalShader(-56, 48, palette) });
  canvas.restore();
}

/** kind: back | front | side | bottom — one face of the outer pouch. `torn` bakes the ripped-open
 * edge into the panel that shows once the seam has passed it. */
export function buildPouchPanelTexture(
  kind: 'front' | 'back' | 'side' | 'bottom',
  torn: boolean,
  palette: PackPalette
): PixelImage {
  const w = 1024;
  const h = kind === 'side' ? 512 : kind === 'bottom' ? 460 : 620;
  const surf = makeSurface(w, h);
  const { canvas } = surf;
  obsidian(canvas, w, h, palette);

  canvas.drawRect(
    Skia.XYWHRect(0, h - 22, w, 22),
    linearGradientPaint(0, h - 22, 0, h, [
      [0, `rgba(${hexRgb(palette.gold)},0)`],
      [1, `rgba(${hexRgb(palette.gold)},0.55)`],
    ])
  );

  if (kind === 'back') {
    crownG(canvas, w / 2, h * 0.44, 0.86, palette);
    drawTrackedText(canvas, 'GRAILHAUS', w / 2, h * 0.76, {
      size: 84,
      bold: true,
      letterSpacing: 9,
      shader: metalShader(h * 0.69, h * 0.78, palette),
    });
    drawTrackedText(canvas, 'MORE THAN COLLECTIBLES', w / 2, h * 0.86, {
      size: 21,
      bold: true,
      letterSpacing: 12,
      mono: true,
      fill: `rgba(${hexRgb(palette.gold)},0.6)`,
    });
  } else if (kind === 'front') {
    drawTrackedText(canvas, 'GRAILHAUS', w / 2, h * 0.56, {
      size: 70,
      bold: true,
      letterSpacing: 8,
      shader: metalShader(h * 0.49, h * 0.58, palette),
    });
    drawTrackedText(canvas, 'TEN PACK · SERIES I', w / 2, h * 0.68, {
      size: 22,
      bold: true,
      letterSpacing: 11,
      mono: true,
      fill: `rgba(${hexRgb(palette.gold)},0.5)`,
    });
  }

  if (torn) applyTearTop(canvas, w, h, kind === 'front' ? 4.2 : 1.7, 92, 4);
  return { data: surf.toRGBA(), width: w, height: h };
}

/** Wraps a `packArt.ts`-style `PixelImage` (raw RGBA bytes) back into a drawable `SkImage`, so it
 * can be composited as a base layer under further drawing — `drawFront`/`drawBack` only ever
 * return the finished pixels, not the surface they were drawn on. */
function imageFromPixels(img: PixelImage): SkImage {
  const data = Skia.Data.fromBytes(img.data);
  const skImage = Skia.Image.MakeImage(
    { width: img.width, height: img.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    data,
    img.width * 4
  );
  if (!skImage) throw new Error('tenPackArt: Skia.Image.MakeImage failed');
  return skImage;
}

/**
 * One of the ten packs' own face. Explicitly the *same* art as the standalone single-pack rip —
 * `reveal/art/packArt.ts`'s own `drawFront`/`drawBack`, the exact texture `PackTearMesh` bakes
 * onto a single pack — not a bundle-flavored lookalike. The bundle's own pouch panels
 * (`buildPouchPanelTexture`, above) keep their own obsidian/crowned-monogram identity — they're
 * the wrapper, not a card — but every pack that comes out of it has to read as unmistakably the
 * same product a standalone rip produces. The torn-open top is still this file's own erosion
 * (`applyTearTop`, made much bolder below than the pouch's own panels get): the single-pack
 * texture itself is always drawn sealed, since on a real rip that look comes from
 * `PackTearMesh`'s live 3D deformation, not a baked "already torn" variant — there's nothing to
 * reuse for that part, and at pack scale (ten of these, small, seen from a real 3D distance) a
 * subtle tear reads as nothing at all — this has to be unmistakable at a glance.
 */
export function buildTornPackFaceTexture(
  kind: 'front' | 'back',
  seed: number,
  personality: CategoryPersonality
): PixelImage {
  const w = 420;
  const h = 620;
  const faceInput = {
    width: w,
    height: h,
    seamFrac: personality.seamFrac,
    flapFrac: personality.flapFrac,
    palette: personality.palette,
    copy: personality.copy,
  };
  const base = kind === 'front' ? drawFront({ ...faceInput, logo: null }) : drawBack(faceInput);
  const baseImage = imageFromPixels(base);

  const surf = makeSurface(w, h);
  const { canvas } = surf;
  canvas.drawImage(baseImage, 0, 0);

  const depth = h * 0.26;
  applyTearTop(canvas, w, h, seed, depth, 11);

  // A soft blurred glow riding along the tear line on top of the sharp lip stroke — the same
  // "catches the light" cue the pouch's own seam glow uses, sized for legibility at distance
  // rather than fidelity up close.
  const glowPaint = strokePaint('#ffdf9e', 16);
  glowPaint.setAlphaf(0.45);
  glowPaint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 10, true));
  canvas.drawPath(tearLipPath(w, seed, depth, 0), glowPaint);

  // Shadow falling into the open wrapper.
  canvas.save();
  canvas.clipRect(Skia.XYWHRect(0, h * 0.12, w, h * 0.26), ClipOp.Intersect, true);
  canvas.drawRect(
    Skia.XYWHRect(0, h * 0.12, w, h * 0.26),
    linearGradientPaint(0, h * 0.12, 0, h * 0.38, [
      [0, 'rgba(4,2,10,0.86)'],
      [1, 'rgba(4,2,10,0)'],
    ])
  );
  canvas.restore();

  return { data: surf.toRGBA(), width: w, height: h };
}

/** The floor: near-black, with one soft pool of light where the pouch sits. */
export function buildGroundTexture(palette: PackPalette): PixelImage {
  const w = 1024;
  const h = 1024;
  const surf = makeSurface(w, h);
  const { canvas } = surf;
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), fillPaint(palette.ink));

  const poolPaint = Skia.Paint();
  poolPaint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(w / 2, h * 0.46),
      w * 0.46,
      [
        Skia.Color(`rgba(${hexRgb(palette.violet)},0.5)`),
        Skia.Color(`rgba(${hexRgb(palette.violet)},0.26)`),
        Skia.Color(`rgba(${hexRgb(palette.ink)},0)`),
      ],
      [0, 0.45, 1],
      TileMode.Clamp
    )
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), poolPaint);

  const warmPaint = Skia.Paint();
  warmPaint.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(w * 0.62, h * 0.6),
      w * 0.3,
      [Skia.Color(`rgba(${hexRgb(palette.gold)},0.18)`), Skia.Color(`rgba(${hexRgb(palette.ink)},0)`)],
      [0, 1],
      TileMode.Clamp
    )
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, w, h), warmPaint);

  return { data: surf.toRGBA(), width: w, height: h };
}
