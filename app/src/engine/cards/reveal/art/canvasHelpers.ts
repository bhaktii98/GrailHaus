// Thin helpers over @shopify/react-native-skia's offscreen-canvas API,
// shaped to match the small drawing vocabulary project/pack-art.js used
// against a DOM <canvas> — gradients, stroked/filled text with
// letter-spacing, rounded rects — so the art functions that follow read as
// a direct port rather than a rewrite.
//
// React Native has no DOM canvas; Skia's CPU-backed offscreen surface
// (Skia.Surface.Make) is the substitute, and its readPixels() output feeds
// three.js DataTexture directly (see engine/textures.ts) — no PNG
// encode/decode round trip.
import {
  Skia,
  PaintStyle,
  BlurStyle,
  ColorType,
  AlphaType,
  TileMode,
  StrokeJoin,
  type SkCanvas,
  type SkImage,
  type SkPaint,
  type SkPath,
  type SkShader,
} from '@shopify/react-native-skia';

export interface Surface2D {
  canvas: SkCanvas;
  width: number;
  height: number;
  /** Reads the drawn pixels back as straight (unpremultiplied) RGBA8. */
  toRGBA(): Uint8Array;
  /** Snapshots the surface as a displayable SkImage, for a flat on-screen
   * <Canvas><Image image={...}/></Canvas> — the same drawing this surface
   * otherwise feeds into a three.js DataTexture via toRGBA(). */
  toImage(): SkImage;
}

export function makeSurface(width: number, height: number): Surface2D {
  const w = Math.round(width);
  const h = Math.round(height);
  const surface = Skia.Surface.Make(w, h);
  if (!surface) throw new Error(`Skia.Surface.Make(${w}, ${h}) failed`);
  const canvas = surface.getCanvas();
  return {
    canvas,
    width: w,
    height: h,
    toRGBA: () => {
      surface.flush();
      const px = canvas.readPixels(0, 0, {
        width: w,
        height: h,
        colorType: ColorType.RGBA_8888,
        alphaType: AlphaType.Unpremul,
      });
      if (!px) throw new Error('Skia readPixels failed');
      return px instanceof Uint8Array ? px : new Uint8Array(px.buffer);
    },
    toImage: () => {
      surface.flush();
      const img = surface.makeImageSnapshot();
      if (!img) throw new Error('Skia makeImageSnapshot failed');
      return img;
    },
  };
}

export function fillPaint(color: string): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Fill);
  p.setColor(Skia.Color(color));
  return p;
}

export function strokePaint(color: string, width: number): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  p.setColor(Skia.Color(color));
  return p;
}

export type GradientStop = [number, string];

/** Linear gradient shader, stops as [0..1, cssColor] pairs — a direct stand
 * in for ctx.createLinearGradient(...).addColorStop(pos, color). */
export function linearGradientShader(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: GradientStop[],
): SkShader {
  const colors = stops.map(([, c]) => Skia.Color(c));
  const positions = stops.map(([p]) => p);
  return Skia.Shader.MakeLinearGradient(
    Skia.Point(x0, y0),
    Skia.Point(x1, y1),
    colors,
    positions,
    TileMode.Clamp,
  );
}

export function linearGradientPaint(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  stops: GradientStop[],
): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setStyle(PaintStyle.Fill);
  p.setShader(linearGradientShader(x0, y0, x1, y1, stops));
  return p;
}

export function roundRectPath(x: number, y: number, w: number, h: number, r: number): SkPath {
  const path = Skia.Path.Make();
  path.addRRect(Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r));
  return path;
}

export function dashPaint(base: SkPaint, on: number, off: number, phase = 0): SkPaint {
  const p = base.copy();
  p.setPathEffect(Skia.PathEffect.MakeDash([on, off], phase));
  return p;
}

// --- text ------------------------------------------------------------
// Skia's font matching has no direct "Cormorant Garamond" without bundling
// a font file; the prototype's own CSS fallback chain was
// `"Cormorant Garamond", Georgia, serif`, so the baked-texture type uses
// that fallback directly — Georgia is a real system font on iOS, and
// FontMgr.matchFamilyStyle degrades to the platform default serif on
// Android. Documented as a scope decision in the README rather than
// bundling a TTF for this pass.
const fontMgr = Skia.FontMgr.System();
const fontCache = new Map<string, ReturnType<typeof Skia.Font>>();
const monoCache = new Map<string, ReturnType<typeof Skia.Font>>();

function serifFont(size: number, bold: boolean, italic: boolean) {
  const key = `${size}:${bold}:${italic}`;
  let f = fontCache.get(key);
  if (f) return f;
  const typeface = fontMgr.matchFamilyStyle('Georgia', {
    weight: bold ? 700 : 500,
    width: 5,
    slant: italic ? 1 : 0,
  });
  f = Skia.Font(typeface, size);
  fontCache.set(key, f);
  return f;
}

function monoFont(size: number, bold: boolean) {
  const key = `${size}:${bold}`;
  let f = monoCache.get(key);
  if (f) return f;
  const typeface = fontMgr.matchFamilyStyle('Courier New', {
    weight: bold ? 700 : 500,
    width: 5,
    slant: 0,
  });
  f = Skia.Font(typeface, size);
  monoCache.set(key, f);
  return f;
}

export interface TextOptions {
  size: number;
  mono?: boolean;
  bold?: boolean;
  italic?: boolean;
  letterSpacing?: number;
  align?: 'left' | 'center' | 'right';
  fill?: string;
  shader?: SkShader;
  stroke?: string;
  strokeWidth?: number;
  shadow?: string;
  shadowBlur?: number;
}

/** Draws text char-by-char with tracking, mirroring pack-art.js's T()
 * helper. Returns the total advance width (used to size badges/plates
 * around the text, same as the original). */
export function drawTrackedText(
  canvas: SkCanvas,
  text: string,
  x: number,
  y: number,
  opts: TextOptions,
): number {
  const font = opts.mono
    ? monoFont(opts.size, !!opts.bold)
    : serifFont(opts.size, !!opts.bold, !!opts.italic);
  const ls = opts.letterSpacing ?? 0;
  const chars = Array.from(text);
  const widths = chars.map((c) => font.getTextWidth(c));
  const total = widths.reduce((a, b) => a + b, 0) + ls * Math.max(0, chars.length - 1);
  const align = opts.align ?? 'center';
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;

  if (opts.shadow) {
    const shadowPaint = fillPaint(opts.shadow);
    shadowPaint.setMaskFilter(
      Skia.MaskFilter.MakeBlur(BlurStyle.Normal, opts.shadowBlur ?? opts.size * 0.25, true),
    );
    let sx = cx;
    chars.forEach((ch, i) => {
      canvas.drawText(ch, sx, y, shadowPaint, font);
      sx += widths[i] + ls;
    });
  }

  const fillP = fillPaint(opts.fill ?? '#ffffff');
  if (opts.shader) fillP.setShader(opts.shader);
  const strokeP = opts.stroke ? strokePaint(opts.stroke, opts.strokeWidth ?? opts.size * 0.12) : null;
  if (strokeP) strokeP.setStrokeJoin(StrokeJoin.Round);

  chars.forEach((ch, i) => {
    if (strokeP) canvas.drawText(ch, cx, y, strokeP, font);
    canvas.drawText(ch, cx, y, fillP, font);
    cx += widths[i] + ls;
  });
  return total;
}
