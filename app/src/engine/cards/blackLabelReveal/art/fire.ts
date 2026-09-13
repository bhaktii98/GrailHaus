// Black Label's fire system — ported from the actual Claude Design handoff's fire.js almost
// unchanged. Everything here is GPU-animated: each layer is one THREE.Points draw call whose
// particles loop on their own clock in the vertex shader, so intensity/surge/color are uniform
// writes per frame, not per-particle CPU work — the same reasoning that made
// ../../vaultReveal/engine/buildVaultPackObject.ts's tear deformation affordable applies here.
// Layers read as fire *coming out of* the card/pack — a tight edge-hugging skirt, a taller sheet
// behind the plane, embers, smoke, sparks — never as a rectangular border; see each layer's emit
// function below.
//
// The only real port change: the original's two texture functions (wispTex/dotTex) built their
// sprites on a DOM <canvas>, which React Native has none of. They're rebuilt here on Skia's
// offscreen surface — the same substitute ../../vaultReveal/engine/textures.ts's
// makeDataTexture() already exists for — including the taper pass, which used
// `ctx.globalCompositeOperation = 'destination-in'` against a vertical alpha ramp; Skia's
// `BlendMode.DstIn` on a second draw is the exact same operation (only the ramp's alpha channel
// matters under DstIn, so the RGB in its gradient stops is arbitrary — kept as `rgba(0,0,0,a)`
// to mirror the original's own stops 1:1).
import * as THREE from "three";
import { Skia, TileMode, BlendMode } from "@shopify/react-native-skia";
import { makeSurface } from "../../reveal/art/canvasHelpers";
import { makeDataTexture } from "../../reveal/engine/textures";

function wispTexture(): THREE.DataTexture {
  const S = 128;
  const surf = makeSurface(S, S);
  const { canvas } = surf;
  const g = Skia.Paint();
  g.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(S / 2, S * 0.6), S * 0.5,
    [
      Skia.Color("rgba(255,255,255,1)"), Skia.Color("rgba(255,242,214,0.86)"),
      Skia.Color("rgba(255,176,74,0.34)"), Skia.Color("rgba(255,96,20,0.08)"), Skia.Color("rgba(255,80,16,0)"),
    ],
    [0, 0.16, 0.4, 0.72, 1], TileMode.Clamp
  ));
  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), g);
  // taper the tip so particles read as tongues of flame, not dots — see this file's header
  const taper = Skia.Paint();
  taper.setShader(Skia.Shader.MakeLinearGradient(
    Skia.Point(0, 0), Skia.Point(0, S),
    [Skia.Color("rgba(0,0,0,0)"), Skia.Color("rgba(0,0,0,0.55)"), Skia.Color("rgba(0,0,0,1)"), Skia.Color("rgba(0,0,0,0.5)")],
    [0, 0.34, 0.66, 1], TileMode.Clamp
  ));
  taper.setBlendMode(BlendMode.DstIn);
  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), taper);
  const tex = makeDataTexture({ data: surf.toRGBA(), width: S, height: S });
  return tex;
}

function dotTexture(soft: boolean): THREE.DataTexture {
  const S = 64;
  const surf = makeSurface(S, S);
  const { canvas } = surf;
  const stops = soft
    ? { colors: ["rgba(255,255,255,0.5)", "rgba(255,255,255,0.16)", "rgba(255,255,255,0)"], pos: [0, 0.5, 1] }
    : { colors: ["rgba(255,255,255,1)", "rgba(255,255,255,0.8)", "rgba(255,255,255,0.14)", "rgba(255,255,255,0)"], pos: [0, 0.3, 0.7, 1] };
  const g = Skia.Paint();
  g.setShader(Skia.Shader.MakeRadialGradient(
    Skia.Point(S / 2, S / 2), S / 2,
    stops.colors.map((c) => Skia.Color(c)), stops.pos, TileMode.Clamp
  ));
  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), g);
  return makeDataTexture({ data: surf.toRGBA(), width: S, height: S });
}

const VERT = /* glsl */ `
uniform float uTime, uLevel, uSurge, uSize, uLife, uRise, uSway, uPix, uSpin, uConverge;
attribute vec3 aSeed;
attribute float aPhase;
varying float vHeat, vAlpha, vSeed;
void main() {
  float life = uLife * (0.55 + 0.9 * aSeed.x);
  float t = fract(uTime / life + aPhase);
  vec3 p = position;
  float rise = uRise * (0.6 + 0.8 * aSeed.y) * (1.0 + uSurge * 1.6);
  p.y += t * rise;
  float ph = aSeed.z * 43.0;
  p.x += (sin(uTime * uSway + ph) * 0.55 + sin(uTime * uSway * 2.3 + ph * 1.7) * 0.45)
         * rise * 0.22 * t;
  p.z += cos(uTime * uSway * 0.8 + ph) * rise * 0.1 * t;
  p.x *= 1.0 - uConverge * t;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float grow = smoothstep(0.0, 0.22, t);
  float die = 1.0 - smoothstep(0.55, 1.0, t);
  float size = uSize * (0.4 + 1.5 * t) * (0.55 + 0.9 * aSeed.y) * (1.0 + uSurge * 0.7);
  gl_PointSize = size * uPix / max(0.0001, -mv.z);
  vAlpha = grow * die * uLevel * (0.6 + 0.4 * aSeed.x);
  vHeat = pow(1.0 - t, 1.5) + uSurge * 0.25;
  vSeed = aSeed.z + uTime * uSpin;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uHot, uMid, uCool;
uniform float uSpin;
varying float vHeat, vAlpha, vSeed;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  if (uSpin > 0.0) {
    float a = vSeed * 6.2831;
    uv = mat2(cos(a), -sin(a), sin(a), cos(a)) * uv;
  }
  vec4 tx = texture2D(uMap, uv + 0.5);
  float h = clamp(vHeat, 0.0, 1.4);
  vec3 col = mix(uCool, uMid, smoothstep(0.0, 0.55, h));
  col = mix(col, uHot, smoothstep(0.62, 1.15, h));
  float a = tx.a * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(col * (0.85 + h * 0.8), a);
}`;

interface LayerOpts {
  count: number;
  map: THREE.Texture;
  size: number;
  life: number;
  rise: number;
  sway: number;
  hot: number;
  mid: number;
  cool: number;
  blending?: THREE.Blending;
  spin?: number;
  converge?: number;
  emit: (u: number, i: number) => [number, number, number];
}

function layer(opts: LayerOpts): THREE.Points {
  const {
    count, map, size, life, rise, sway, hot, mid, cool,
    blending = THREE.AdditiveBlending, spin = 0, converge = 0.34, emit,
  } = opts;
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const p = emit(i / count, i);
    pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
    seed[i * 3] = Math.random();
    seed[i * 3 + 1] = Math.random();
    seed[i * 3 + 2] = Math.random();
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uLevel: { value: 0 }, uSurge: { value: 0 },
      uSize: { value: size }, uLife: { value: life }, uRise: { value: rise },
      uSway: { value: sway }, uPix: { value: 600 }, uSpin: { value: spin },
      uConverge: { value: converge },
      uMap: { value: map },
      uHot: { value: new THREE.Color(hot) },
      uMid: { value: new THREE.Color(mid) },
      uCool: { value: new THREE.Color(cool) },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, depthTest: true,
    blending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// Fire palette: crimson at the tail, molten orange through the body, champagne-white only at
// the core.
const HOT = 0xfff1cf, MID = 0xff7a1e, COOL = 0x7a0f06;

export interface BuiltFire {
  group: THREE.Group;
  sweep: THREE.Mesh;
  step: (dt: number, camera: THREE.Camera | null, pixHeight: number) => { level: number; flick: number; surge: number };
  setLevel: (v: number) => void;
  burst: () => void;
  runSweep: () => void;
  readonly level: number;
  dispose: () => void;
}

export function buildFire({ cardW, cardH, pack = false }: { cardW: number; cardH: number; pack?: boolean }): BuiltFire {
  const group = new THREE.Group();
  group.name = pack ? "packFire" : "apexFire";

  const wisp = wispTexture(), dot = dotTexture(false), puff = dotTexture(true);
  const hx = cardW / 2, hy = cardH / 2;
  const disposeGeo: THREE.BufferGeometry[] = [];
  const disposeMat: THREE.Material[] = [];
  const disposeTex: THREE.Texture[] = [wisp, dot, puff];

  // Perimeter sample, weighted to corners and the lower edge. Emission sits just OUTSIDE the
  // card outline and a hair BEHIND its plane, so the card always depth-tests in front of its own
  // flames and never washes out.
  const rim = (u: number): [number, number, number] => {
    const s = (u * 1.618) % 1;
    let x: number, y: number;
    if (pack) {
      if (s < 0.34) { x = (u * 2 - 1) * hx * 1.02; y = -hy * 1.0; }
      else { x = (Math.random() < 0.5 ? -1 : 1) * hx * (1.0 + Math.random() * 0.1); y = (Math.random() * 2 - 1) * hy * 1.02; }
      return [x, y, (Math.random() - 0.42) * 0.036];
    }
    if (s < 0.42) { x = (u * 2 - 1) * hx * 1.02; y = -hy * 1.03; }
    else if (s < 0.74) { x = (Math.random() < 0.5 ? -1 : 1) * hx * 1.04; y = (Math.random() * 2 - 1) * hy; }
    else if (s < 0.9) { x = (u * 2 - 1) * hx * 0.92; y = hy * 1.02; }
    else { x = (Math.random() < 0.5 ? -1 : 1) * hx * 1.0; y = (Math.random() < 0.5 ? -1 : 1) * hy * 0.98; }
    return [x, y, -0.0016 - Math.random() * 0.002];
  };

  // Particle counts cut roughly a third from the ported original — this is a THREE.Points draw
  // call per layer, and every one of them (regardless of on-screen opacity) still costs a full
  // vertex+fragment pass per particle every frame; two full fire instances (card + pack) run at
  // once for most of the tear (see BlackLabelScene.tsx), so the layer count multiplies fast. The
  // cut targets fill-rate, not silhouette — each layer still reads as the same shape of flame,
  // just fewer particles making it up.
  const skirt = layer({
    count: pack ? 210 : 240, map: wisp,
    size: pack ? 0.0135 : 0.0062, life: pack ? 0.8 : 0.62,
    rise: pack ? 0.05 : 0.014, sway: pack ? 3.2 : 5.2,
    converge: pack ? -0.06 : 0.34,
    hot: HOT, mid: MID, cool: COOL, emit: rim,
  });
  skirt.name = "fireSkirt";

  // Pack instance also skips this one — the sealed-pack ambient fire reads fine as skirt +
  // embers + smoke; the taller flame sheet is worth its draw call once a card is actually the
  // subject (card instance), not for the whole duration of the tear.
  const sheet = pack ? null : layer({
    count: 160, map: wisp, size: 0.019, life: 1.35,
    rise: 0.062, sway: 2.4,
    hot: 0xffd9a0, mid: 0xf2600f, cool: 0x4a0703,
    emit: (u) => [(u * 2 - 1) * hx * 1.06, -hy * (0.5 + Math.random() * 0.5), -0.006 - Math.random() * 0.01],
  });
  if (sheet) sheet.name = "fireSheet";

  // The pack instance forces this layer's uLevel to 0 below (no visible cracks on the sealed
  // pack, only on cards) — so for `pack`, skip building/drawing it at all rather than paying a
  // full draw call every frame for something permanently invisible.
  const cracks = pack ? null : layer({
    count: 60, map: wisp, size: 0.0034, life: 0.8, rise: 0.012, sway: 4.0,
    hot: 0xfff6e2, mid: 0xff9330, cool: 0x6d1004,
    emit: () => [(Math.random() * 2 - 1) * hx * 0.86, (Math.random() * 2 - 1) * hy * 0.88, 0.0012],
  });
  if (cracks) cracks.name = "fireCracks";

  const embers = layer({
    count: 110, map: dot, size: 0.0034, life: 3.4, rise: 0.14, sway: 1.1,
    hot: 0xffe7bd, mid: 0xff8a2a, cool: 0x8e2408,
    emit: () => [(Math.random() * 2 - 1) * hx * 1.5, -hy + Math.random() * cardH, (Math.random() - 0.5) * 0.03],
  });
  embers.name = "fireEmbers";

  const smoke = layer({
    count: 30, map: puff, size: pack ? 0.04 : 0.055, life: 4.2, rise: 0.17, sway: 0.7,
    hot: 0x3a2a20, mid: 0x241a14, cool: 0x0d0908,
    blending: THREE.NormalBlending, spin: 0.05, converge: 0,
    emit: () => [(Math.random() * 2 - 1) * hx * 1.2, hy * (pack ? 0.9 : 0.2) + Math.random() * 0.02, -0.012],
  });
  smoke.name = "fireSmoke";

  // Sparks read as a burst/energy-release accent — worth it on the hero card, skipped on the
  // ambient sealed-pack fire for the same reason as `sheet` above.
  const sparks = pack ? null : layer({
    count: 90, map: dot, size: 0.0026, life: 1.1, rise: 0.3, sway: 2.0,
    hot: 0xffffff, mid: 0xffc46a, cool: 0xff5a12,
    emit: () => [(Math.random() * 2 - 1) * hx * 1.1, (Math.random() * 2 - 1) * hy, (Math.random() - 0.5) * 0.01],
  });
  if (sparks) sparks.name = "fireSparks";

  const layers = [smoke, sheet, embers, skirt, cracks, sparks].filter((l): l is THREE.Points => l !== null);
  layers.forEach((l) => {
    disposeGeo.push(l.geometry);
    disposeMat.push(l.material as THREE.Material);
  });
  group.add(...layers);

  // Light sweep across the card face — a single additive band, driven only during the reveal beat.
  const sweepSurf = makeSurface(256, 8);
  {
    const p = Skia.Paint();
    p.setShader(Skia.Shader.MakeLinearGradient(
      Skia.Point(0, 0), Skia.Point(256, 0),
      [
        Skia.Color("rgba(0,0,0,0)"), Skia.Color("rgba(255,190,110,0.25)"), Skia.Color("rgba(255,246,224,0.95)"),
        Skia.Color("rgba(255,170,80,0.22)"), Skia.Color("rgba(0,0,0,0)"),
      ],
      [0, 0.42, 0.5, 0.58, 1], TileMode.Clamp
    ));
    sweepSurf.canvas.drawRect(Skia.XYWHRect(0, 0, 256, 8), p);
  }
  const sweepTex = makeDataTexture({ data: sweepSurf.toRGBA(), width: 256, height: 8 });
  disposeTex.push(sweepTex);
  const sweepGeo = new THREE.PlaneGeometry(cardW * 0.34, cardH * 1.04);
  disposeGeo.push(sweepGeo);
  const sweepMat = new THREE.MeshBasicMaterial({
    name: "apexSweep", map: sweepTex, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  disposeMat.push(sweepMat);
  const sweep = new THREE.Mesh(sweepGeo, sweepMat);
  sweep.name = "apexSweep";
  sweep.position.z = 0.0016;
  sweep.rotation.z = -0.09;

  // Heat haze: one large, very low-contrast additive wash that sits behind the card/pack and
  // pushes warm light into the room without washing the subject out.
  const haloGeo = new THREE.PlaneGeometry(cardW * (pack ? 2.6 : 5.5), cardH * (pack ? 1.5 : 3.4));
  disposeGeo.push(haloGeo);
  const haloMat = new THREE.MeshBasicMaterial({
    name: "apexHalo", map: puff, color: 0xff6a18, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  disposeMat.push(haloMat);
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.name = "apexHalo";
  halo.position.set(0, pack ? cardH * 0.1 : 0, pack ? -0.03 : -0.02);
  group.add(halo, sweep);

  const state = { level: 0, want: 0, surge: 0, sweep: -1, t: 0, flick: 0 };

  const setLevel = (v: number) => { state.want = Math.max(0, Math.min(1, v)); };
  const burst = () => { state.surge = 1; };
  const runSweep = () => { state.sweep = 0; };

  const step = (dt: number, camera: THREE.Camera | null, pixHeight: number) => {
    state.t += dt;
    state.level += (state.want - state.level) * Math.min(1, dt * 2.2);
    state.surge = Math.max(0, state.surge - dt * 1.35);
    state.flick = 0.82 + 0.18 * Math.sin(state.t * 11.3) * Math.cos(state.t * 5.1)
      + 0.06 * Math.sin(state.t * 27.7);

    const surgeE = state.surge * state.surge;
    const projEl = (camera as THREE.PerspectiveCamera | null)?.projectionMatrix.elements[5];
    const pix = pixHeight * 0.5 * (projEl || 1);
    layers.forEach((l) => {
      const u = (l.material as THREE.ShaderMaterial).uniforms;
      u.uTime.value = state.t;
      u.uPix.value = pix;
      u.uSurge.value = surgeE;
    });
    const lv = state.level;
    const uOf = (m: THREE.Points) => (m.material as THREE.ShaderMaterial).uniforms;
    uOf(skirt).uLevel.value = lv * (0.6 + 0.24 * state.flick) * (1 + surgeE * 0.6);
    if (sheet) uOf(sheet).uLevel.value = Math.pow(lv, 1.25) * (0.55 + 0.35 * state.flick) * (1 + surgeE);
    if (cracks) uOf(cracks).uLevel.value = Math.pow(lv, 2.2) * 0.28 * (1 + surgeE * 0.6);
    uOf(embers).uLevel.value = Math.pow(lv, 0.8) * 0.8;
    uOf(smoke).uLevel.value = Math.pow(lv, 1.1) * (pack ? 0.18 : 0.5);
    if (sparks) uOf(sparks).uLevel.value = surgeE * 1.1 + lv * 0.05;

    haloMat.opacity = Math.pow(lv, 1.5) * (pack ? 0.07 : 0.1) + surgeE * 0.22;
    halo.scale.setScalar(1 + surgeE * 0.35);

    if (state.sweep >= 0) {
      state.sweep += dt / 1.15;
      const q = state.sweep;
      if (q >= 1) { state.sweep = -1; sweepMat.opacity = 0; } else {
        sweep.position.x = (-0.85 + q * 1.7) * cardW;
        sweepMat.opacity = Math.sin(Math.PI * q) * 0.9;
      }
    }
    if (camera) {
      const yaw = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
      halo.rotation.y = yaw - group.rotation.y;
    }
    return { level: lv, flick: state.flick, surge: surgeE };
  };

  const dispose = () => {
    disposeGeo.forEach((g) => g.dispose());
    disposeMat.forEach((m) => m.dispose());
    disposeTex.forEach((t) => t.dispose());
  };

  return {
    group, sweep, step, setLevel, burst, runSweep, dispose,
    get level() { return state.level; },
  };
}
