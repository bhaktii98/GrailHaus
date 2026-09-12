// The Collector's Vault environment map — the single most load-bearing piece of this whole
// port, ported from the design handoff's own stage setup
// (the-collector-s-vault/project/three-d-stage.js, `_boot()`: the procedural equirect canvas at
// lines 248-272).
//
// WHY THIS FILE EXISTS AT ALL, since a previous watch reveal shipped without it:
//
// A `meshStandardMaterial` with high `metalness` derives almost all of its visible color from
// *reflected environment light*, not from its own diffuse albedo — that is what metal physically
// is. With `scene.environment` unset there is nothing to reflect, so a metalness-1.0 surface
// renders very nearly black. The existing procedural watch (engine/components/WatchMesh.tsx) hit
// exactly this and worked around it twice over: first by pulling metalness down into a
// satin/brushed range (see its STEEL comment), then by giving every material a small `emissive`
// floor so it wouldn't disappear entirely (see its WALNUT/BAND_STEEL comments). That second
// workaround is self-defeating — a flat self-lit term washes out the directional light's own
// shading gradient, which is why the result reads as an unlit sticker rather than a lit object.
// The design source's own stage comment names the same trap from the other direction: "NO
// environment map — so high metalness has nothing to reflect and renders near-black. Cap
// metalness around 0.3-0.4 and carry a metal look with a brighter base color."
//
// The Collector's Vault stage does NOT take that advice — it supplies a real environment instead,
// which is precisely why its material table can afford `metalness: 1.0` on polished steel,
// platinum, rose gold, titanium and gunmetal and still read as those metals. Porting the
// environment is therefore a prerequisite for porting the materials honestly; without it every
// archetype below would need the same emissive fakery all over again.
//
// WHAT IT IS: a 512x256 equirectangular image — a vertical gradient from a cool dark grey through
// near-black, blurred, with three bright rectangles standing in for a studio's lighting: one warm
// softbox, one cooler rim panel, and a dim overhead strip. That is deliberately almost nothing.
// A polished watch case is a curved mirror; what the viewer actually reads as "polished metal" is
// the *shape of the highlight sliding across it*, so a couple of soft rectangles over near-black
// produce a convincing brushed/polished response while a photographic HDRI would mostly add cost
// and haze. Every number below is copied from the source rather than re-guessed.
//
// HOW IT DIFFERS FROM THE SOURCE, and why each difference is forced:
//
//  1. No DOM canvas exists in React Native, so the drawing goes through Skia's offscreen surface
//     and lands in three.js as a DataTexture — the same substitution the card pack reveal already
//     established (cards/reveal/art/canvasHelpers.ts + cards/reveal/engine/textures.ts). See
//     `makeDataTexture`'s own note on flipY, and this file's own override of it below.
//  2. `ctx.filter = 'blur(9px)'` has no Skia equivalent as a canvas-wide filter; Skia blurs
//     per-paint via a MaskFilter, so each lit rectangle carries its own blur instead. Same
//     visual result here because the blur in the source only ever applies to those three
//     rectangles (it is set after the gradient fill and never reset).
import * as THREE from "three";
import { Skia, BlurStyle } from "@shopify/react-native-skia";
import { makeSurface, linearGradientPaint, fillPaint } from "../../../cards/reveal/art/canvasHelpers";
import { makeDataTexture } from "../../../cards/reveal/engine/textures";

const ENV_W = 512;
const ENV_H = 256;

// The source's `ctx.filter = 'blur(9px)'`. Applied per-rectangle as a MaskFilter (see header).
const LIGHT_BLUR = 9;

/** The three light panels, verbatim from the source's own fillRect calls. The first is the warm
 * key softbox (what a polished case picks up as its main highlight), the second a cooler rim
 * panel on the opposite side of the equirect (the counter-highlight that gives an edge its
 * two-tone metal look), the third a wide dim overhead strip that keeps upward-facing surfaces
 * from going flat black. Intentionally left as image-space pixel rects rather than being
 * reasoned about in world directions — an equirect's u axis *is* azimuth, so their horizontal
 * placement already encodes where each light sits around the object. */
const LIGHT_PANELS: { color: string; x: number; y: number; w: number; h: number }[] = [
  { color: "rgba(255,251,244,0.95)", x: 58, y: 16, w: 46, h: 148 },
  { color: "rgba(206,222,244,0.6)", x: 330, y: 8, w: 26, h: 116 },
  { color: "rgba(255,255,255,0.35)", x: -20, y: -10, w: 560, h: 14 },
];

/** Draws the equirect and returns it as a three.js texture, ready for PMREM.
 *
 * Not exported: callers want the prefiltered result (`buildVaultEnvironment`), never the raw
 * equirect — handing a raw equirect straight to `scene.environment` would technically render but
 * would give mirror-sharp reflections of three rectangles with no roughness response at all,
 * which is the thing PMREM exists to fix. */
function drawVaultEquirect(): THREE.DataTexture {
  const surf = makeSurface(ENV_W, ENV_H);
  const { canvas } = surf;

  // Vertical gradient: cool grey at the zenith down through near-black at the horizon and below.
  // Stops copied from the source (#232830 / #0a0c10 at 0.44 / #040507).
  canvas.drawRect(
    Skia.XYWHRect(0, 0, ENV_W, ENV_H),
    linearGradientPaint(0, 0, 0, ENV_H, [
      [0, "#232830"],
      [0.44, "#0a0c10"],
      [1, "#040507"],
    ]),
  );

  for (const panel of LIGHT_PANELS) {
    const paint = fillPaint(panel.color);
    // `true` = respect the paint's own alpha while blurring, matching a DOM canvas blur filter
    // over a translucent fill rather than blurring a fully opaque rect and then fading it.
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, LIGHT_BLUR, true));
    canvas.drawRect(Skia.XYWHRect(panel.x, panel.y, panel.w, panel.h), paint);
  }

  const tex = makeDataTexture({ data: surf.toRGBA(), width: ENV_W, height: ENV_H });
  // makeDataTexture defaults flipY=true to mimic DOM CanvasTexture, which is right for the card
  // art it was written for (baked art read directly off a mesh's UVs). It is wrong here:
  // PMREMGenerator samples an equirect through its own direction->uv mapping, not through mesh
  // UVs, so a flip would put the overhead strip underneath the object and light every watch from
  // below. Overridden explicitly rather than parameterised, so the reason travels with the call.
  tex.flipY = false;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export interface VaultEnvironment {
  /** Assign to `scene.environment`. */
  texture: THREE.Texture;
  /** Releases the prefiltered render target. Must be called on scene teardown — a PMREM target is
   * a real GPU allocation, not a plain texture, and this app mounts/unmounts reveal Canvases
   * repeatedly across a session (a 10-pack batch alone remounts per pack). */
  dispose(): void;
}

/**
 * Builds the prefiltered (PMREM) environment for the vault scene.
 *
 * Must be called with the live renderer — `PMREMGenerator` renders the equirect into a cube-UV
 * target on the GPU, so it needs a real `WebGLRenderer`, not just a texture. Inside r3f that is
 * `state.gl` / `useThree().gl`. Call it once per Canvas (in an effect or a memo keyed on the
 * renderer), never per frame: prefiltering is a multi-pass GPU job, cheap once and ruinous at
 * 60fps.
 *
 * Roughness response is the entire point of the prefilter step. PMREM builds a mip chain where
 * each level is the environment convolved for a progressively rougher surface, which is what lets
 * the same environment read as a mirror on a polished bezel and as a soft sheen on brushed
 * titanium — with a raw equirect, every surface would reflect it equally sharply regardless of
 * its roughness.
 */
export function buildVaultEnvironment(renderer: THREE.WebGLRenderer): VaultEnvironment {
  const equirect = drawVaultEquirect();
  const pmrem = new THREE.PMREMGenerator(renderer);
  // `fromEquirectangular` returns the cube-UV WebGLRenderTarget (verified against the installed
  // three@0.185 source, PMREMGenerator._fromTexture) — `.texture` is the prefiltered result.
  const target = pmrem.fromEquirectangular(equirect);
  // Both are safe to release the moment prefiltering is done: the generator's shaders and the
  // source equirect are inputs to that one GPU job, and nothing samples them afterwards. Only
  // the render target's texture is still referenced (by `scene.environment`), which is why it is
  // the one thing this module keeps alive until `dispose()`.
  pmrem.dispose();
  equirect.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}

/** The source's `scene.environmentIntensity = 0.5` — the vault's resting exposure. The
 * choreography then drives this down as the reveal escalates (the source's own `lights()` lerps
 * it from 0.78 to 0.24 as the interior lights come up and the rarity moment lands), so the scene
 * leans progressively on its own spot/rim rig rather than on ambient reflection. Exported as a
 * named constant so the choreography config and the initial scene setup can't drift apart. */
export const VAULT_ENV_INTENSITY = 0.5;
