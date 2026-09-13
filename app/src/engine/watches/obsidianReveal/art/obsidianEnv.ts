// The Obsidian Vault's environment map — ported from the design's own `studioEnv()`
// (the-obsidian-vault/project/apex-vault.html, lines 177-197).
//
// THE THIRD ENVIRONMENT, AND WHY EACH TIER HAS ITS OWN
//
//   The Reserve  — a warm lamplit room (#3a2f26 -> #8d7355 horizon -> #0a0807), cream softbox.
//                  Walnut, brass, burgundy velvet.
//   The Archive  — a cool machined studio (#232830 -> #040507), white softbox, blue rim.
//                  Titanium, black lacquer, alcantara.
//   The Obsidian — a near-black gallery (#22211f -> #121213 -> #0a0a0b -> #050506) with one hard
//                  white overhead strip and one warm amber counter-light.
//
// This one is the darkest of the three and the most *contrasted*, which is exactly what obsidian
// lacquer under a clearcoat needs: a piano-black surface has almost no diffuse colour of its own,
// so everything you see on it is a reflection. A bright, small, hard source on a very dark ground
// gives the tight specular streak that reads as lacquer; a broad soft environment would turn the
// same material into flat charcoal.
//
// Note the design's own exposure: `toneMappingExposure = .62`, lower than a neutral 1.0, with
// `environmentIntensity` at .5. That pairing is deliberate — a dark room plus a hot highlight,
// then the whole frame pulled down. The choreography drives exposure further down still during the
// sequence (to .50 at peak darkness) before opening back up for the reveal.
import * as THREE from "three";
import { Skia, TileMode, PaintStyle } from "@shopify/react-native-skia";
import { makeSurface, linearGradientPaint } from "../../../cards/reveal/art/canvasHelpers";
import { makeDataTexture } from "../../../cards/reveal/engine/textures";

const ENV_W = 512;
const ENV_H = 256;

/**
 * The two sources, verbatim from the design.
 *
 * The first is the overhead strip: white at its core, falling through a mid grey, over a 150px
 * radius — a large soft-but-bright panel. The second is a warm amber accent on the opposite side,
 * much tighter, which is what puts a gold-coloured counter-highlight on the champagne inlay so it
 * does not read as the same white as the steel.
 *
 * Each is drawn clipped to the design's own sub-rectangle rather than the full canvas (the source
 * fills `0,0,512,190` and `200,0,312,220`), which keeps both lights in the upper hemisphere — a
 * reflection of a light source *below* a display object is the thing that makes a render look
 * like it is floating in a void.
 */
const LIGHTS: {
  cx: number;
  cy: number;
  r: number;
  stops: [number, string][];
  clip: [number, number, number, number];
}[] = [
  {
    cx: 150,
    cy: 54,
    r: 150,
    stops: [
      [0, "#ffffff"],
      [0.35, "#8d8a84"],
      [1, "rgba(0,0,0,0)"],
    ],
    clip: [0, 0, 512, 190],
  },
  {
    cx: 392,
    cy: 88,
    r: 120,
    stops: [
      [0, "#e8c89a"],
      [0.4, "#4d4034"],
      [1, "rgba(0,0,0,0)"],
    ],
    clip: [200, 0, 312, 220],
  },
];

function drawObsidianEquirect(): THREE.DataTexture {
  const surf = makeSurface(ENV_W, ENV_H);
  const { canvas } = surf;

  // Four stops: a dim grey zenith, then two closely-spaced dark steps at 0.42/0.55 forming the
  // horizon, then near-black below. The tight pair is what gives a polished case a discernible
  // horizon line to reflect rather than an even gradient.
  canvas.drawRect(
    Skia.XYWHRect(0, 0, ENV_W, ENV_H),
    linearGradientPaint(0, 0, 0, ENV_H, [
      [0, "#22211f"],
      [0.42, "#121213"],
      [0.55, "#0a0a0b"],
      [1, "#050506"],
    ]),
  );

  for (const light of LIGHTS) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setStyle(PaintStyle.Fill);
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(light.cx, light.cy),
        light.r,
        light.stops.map(([, c]) => Skia.Color(c)),
        light.stops.map(([p]) => p),
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(Skia.XYWHRect(light.clip[0], light.clip[1], light.clip[2], light.clip[3]), paint);
  }

  const tex = makeDataTexture({ data: surf.toRGBA(), width: ENV_W, height: ENV_H });
  // False for an equirect: PMREM samples by world direction, not mesh UVs. Getting this wrong
  // flips the overhead strip below the object and lights everything from underneath.
  tex.flipY = false;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export interface ObsidianEnvironment {
  texture: THREE.Texture;
  dispose(): void;
}

export function buildObsidianEnvironment(renderer: THREE.WebGLRenderer): ObsidianEnvironment {
  const equirect = drawObsidianEquirect();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(equirect);
  pmrem.dispose();
  equirect.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}

/**
 * The design's own `scene.environmentIntensity = .5`, raised for a phone screen.
 *
 * The same small-screen adjustment made for both other tiers, and for the same reason: these
 * designs were composed on a large display in a dark room. But the raise here is the most
 * conservative of the three (0.5 -> 0.72 rather than the Reserve's 0.68 -> 0.95), because this
 * tier's identity genuinely *is* darkness — it is the ceremonial one, and washing it out would
 * cost more than it gains. The choreography then modulates around this value.
 */
export const OBSIDIAN_ENV_INTENSITY = 0.72;

/**
 * The design's `toneMappingExposure`, and the floor it drops to during the sequence.
 *
 * Exposed as constants because tone mapping is scene-level state the choreography animates, and
 * the two numbers have to agree with the `dark` term in the sequence's own stages. The design runs
 * .62 at rest and lerps to .50 at peak darkness (apex-vault.html:1032).
 *
 * Both raised slightly for the same small-screen reason above — an 0.62 exposure on a phone in
 * daylight is close to unreadable.
 */
export const OBSIDIAN_EXPOSURE_REST = 0.86;
export const OBSIDIAN_EXPOSURE_DARK = 0.7;
