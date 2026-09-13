// The Reserve's environment map — ported from the design handoff's own `envMap()`
// (heritage-case-watch-reveal/project/heritage-case.js, lines 79-107).
//
// WHY THIS TIER NEEDS ITS OWN ENVIRONMENT RATHER THAN SHARING THE ARCHIVE'S
//
// The two watch reveals supply environments that are almost opposites, and that is the single
// biggest reason they read as different objects rather than one reveal in two colourways:
//
//   The Archive  — a cool near-black studio (#232830 -> #040507) with a white softbox and a blue
//                  rim. Machined titanium and black lacquer, reflecting a cold room.
//   The Reserve  — a warm room (#3a2f26 -> #8d7355 at the horizon -> #0a0807) with a cream
//                  softbox and a pale blue counter-rim. Walnut, brass and burgundy velvet,
//                  reflecting lamplight.
//
// The horizon band at 0.42-0.52 is the important detail here and has no counterpart in the
// Archive's: it puts a bright warm mid-tone right where a horizontal surface's reflection samples
// it, which is what makes the brass inlay and the polished steel case pick up a golden sheen
// instead of the Archive's silver one. Copied verbatim rather than re-tinted from the Archive's,
// because "same gradient, different colours" would lose exactly that structure.
//
// NOTE ON THE SOURCE'S TWO-STAGE SETUP: unlike the Archive bundle — whose `three-d-stage.js`
// builds its own environment — this bundle's stage explicitly has none ("NO environment map — so
// high metalness has nothing to reflect and renders near-black", three-d-stage.js:59) and the
// page builds one itself. So this file is a port of the *page's* env map, and the stage's bare
// hemisphere/key/fill rig is ported separately by the scene component.
//
// Mechanics are identical to the Archive's port (Skia offscreen surface -> DataTexture -> PMREM);
// see ../../vaultReveal/art/vaultEnv.ts for the full reasoning on why a DOM canvas is unavailable
// here and why `flipY` must be forced off for an equirect.
import * as THREE from "three";
import { Skia, TileMode } from "@shopify/react-native-skia";
import { makeSurface, linearGradientPaint } from "../../../cards/reveal/art/canvasHelpers";
import { makeDataTexture } from "../../../cards/reveal/engine/textures";

const ENV_W = 512;
const ENV_H = 256;

/**
 * The two light sources, verbatim from the source's own radial gradients.
 *
 * Radial rather than the Archive's rectangles — the source draws these with
 * `createRadialGradient`, which gives a soft round highlight rather than a hard-edged softbox.
 * That difference is visible on a curved watch case: a round source reads as a warm lamp, a
 * rectangular one as a photographic studio panel.
 */
const LIGHTS: { x: number; y: number; r: number; inner: string; outer: string }[] = [
  // The warm key — "one warm softbox" in the source's own comment.
  { x: 150, y: 70, r: 90, inner: "rgba(255,236,203,1)", outer: "rgba(255,236,203,0)" },
  // The cooler counter-rim, which keeps brass from going entirely orange.
  { x: 400, y: 110, r: 60, inner: "rgba(190,205,225,0.75)", outer: "rgba(190,205,225,0)" },
];

function drawReserveEquirect(): THREE.DataTexture {
  const surf = makeSurface(ENV_W, ENV_H);
  const { canvas } = surf;

  // The warm room gradient. Four stops, not three: the pair at 0.42/0.52 forms a narrow bright
  // horizon band (see the file header) rather than a smooth top-to-bottom fade.
  canvas.drawRect(
    Skia.XYWHRect(0, 0, ENV_W, ENV_H),
    linearGradientPaint(0, 0, 0, ENV_H, [
      [0, "#3a2f26"],
      [0.42, "#8d7355"],
      [0.52, "#1a1512"],
      [1, "#0a0807"],
    ]),
  );

  for (const light of LIGHTS) {
    const paint = Skia.Paint();
    paint.setAntiAlias(true);
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(light.x, light.y),
        light.r,
        [Skia.Color(light.inner), Skia.Color(light.outer)],
        [0, 1],
        TileMode.Clamp,
      ),
    );
    // The source fills the whole canvas with each radial gradient and lets the gradient's own
    // transparent outer stop do the masking, rather than clipping to the light's radius — kept
    // identical, since a clipped circle would cut off the soft falloff that makes it read as a
    // lamp rather than a disc.
    canvas.drawRect(Skia.XYWHRect(0, 0, ENV_W, ENV_H), paint);
  }

  const tex = makeDataTexture({ data: surf.toRGBA(), width: ENV_W, height: ENV_H });
  // Must be false for an equirect — PMREM samples by world direction, not mesh UVs, so the
  // DataTexture default that mimics a DOM canvas would light every watch from underneath. Same
  // override and same reason as the Archive's env map.
  tex.flipY = false;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export interface ReserveEnvironment {
  texture: THREE.Texture;
  dispose(): void;
}

/**
 * Builds the prefiltered environment for the Reserve scene. Needs the live renderer (PMREM is a
 * GPU job) — inside r3f that is `state.gl` / `useThree().gl`. Call once per Canvas, never per
 * frame.
 */
export function buildReserveEnvironment(renderer: THREE.WebGLRenderer): ReserveEnvironment {
  const equirect = drawReserveEquirect();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(equirect);
  pmrem.dispose();
  equirect.dispose();
  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}

/**
 * The source's own `scene.environmentIntensity = 0.68` (heritage-case.js:405).
 *
 * Higher than the Archive's resting 0.5, and deliberately so: this is a lit room rather than a
 * dark vault, and the Reserve's choreography holds it roughly steady instead of collapsing it for
 * a rarity moment — the Reserve is the entry tier, whose reveal is meant to feel warm and
 * unhurried rather than ceremonial. Raised from the source's literal value for the same
 * small-screen reason the Archive's was (see reserveChoreography's own exposure note).
 */
export const RESERVE_ENV_INTENSITY = 0.95;
