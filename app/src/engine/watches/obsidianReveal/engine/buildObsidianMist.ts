// The vault mist — a faithful port of the design's own mist system
// (the-obsidian-vault/project/apex-vault.html, lines 585-695).
//
// WHY THIS FILE WAS REWRITTEN
//
// The first attempt substituted `THREE.Points` for the design's `THREE.Sprite` billboards, and
// that single choice broke the whole effect. A Sprite's `scale` is in WORLD UNITS: the design's
// blobs are `s0` = 0.082-0.144, i.e. 8-14cm across inside a 31cm chamber, so sixteen overlapping
// ones fill it completely. A Points primitive sizes in PIXELS via `gl_PointSize`, which cannot
// express "14cm wide in world space" — the blobs came out small and scattered, hid nothing, and
// the chamber read as sparse puffs rather than a packed volume.
//
// Compounding it, the body slabs were then made fully opaque to compensate. The design's own body
// is `opacity: dense * 0.9` — deliberately never opaque — because the SPRITES do the hiding and the
// body only supplies the soft volumetric wash behind them. An opaque body instead renders as a
// hard-edged grey box with visible rounded corners, and the watch reads through its flat faces.
//
// So: the design's math is reproduced exactly, and the only change of technique is the one the
// original could not afford on a phone — 426 separate Sprite objects (each its own draw call and
// its own material) become one InstancedMesh of billboarded quads. Instancing preserves world-unit
// sizing precisely, which is the property that actually mattered.
import * as THREE from "three";
import { Skia, TileMode, PaintStyle, BlendMode } from "@shopify/react-native-skia";
import { makeSurface } from "../../../cards/reveal/art/canvasHelpers";
import { makeDataTexture } from "../../../cards/reveal/engine/textures";
import { slab } from "./obsidianGeometry";

/** Particle counts, per bank, exactly as the design declares them. */
const N_CORE = 120;
const N_CAP = 70;
const N_CENTRE = 26;
const N_SPILL = 210;
const N_TOTAL = N_CORE + N_CAP + N_CENTRE + N_SPILL;

/** 0 = a static bank that hides the watch; 1 = the spill that pours out of the sides. */
const ROLE_CORE = 0;
const ROLE_SPILL = 1;

/**
 * The vapour sprite — the design's own `mistTexture()`.
 *
 * A soft radial blob with nine offset lobes, then alpha-masked to a circle so its edge is soft
 * rather than clipped to the quad. Skia's `BlendMode.DstIn` is the exact equivalent of the
 * `destination-in` canvas composite the design uses for that mask.
 */
function mistTexture(): THREE.DataTexture {
  const S = 128;
  const surf = makeSurface(S, S);
  const { canvas } = surf;
  const rnd = seeded(0x3b17f0);

  const base = Skia.Paint();
  base.setAntiAlias(true);
  base.setStyle(PaintStyle.Fill);
  base.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(64, 64),
      62,
      [
        Skia.Color("rgba(255,255,255,0.95)"),
        Skia.Color("rgba(255,255,255,0.45)"),
        Skia.Color("rgba(255,255,255,0.12)"),
        Skia.Color("rgba(255,255,255,0)"),
      ],
      [0, 0.35, 0.72, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), base);

  for (let i = 0; i < 9; i++) {
    const r = 18 + rnd() * 26;
    const px = 32 + rnd() * 64;
    const py = 32 + rnd() * 64;
    const lobe = Skia.Paint();
    lobe.setAntiAlias(true);
    lobe.setStyle(PaintStyle.Fill);
    lobe.setShader(
      Skia.Shader.MakeRadialGradient(
        Skia.Point(px, py),
        r,
        [Skia.Color("rgba(255,255,255,0.16)"), Skia.Color("rgba(255,255,255,0)")],
        [0, 1],
        TileMode.Clamp,
      ),
    );
    canvas.drawRect(Skia.XYWHRect(0, 0, S, S), lobe);
  }

  const mask = Skia.Paint();
  mask.setAntiAlias(true);
  mask.setStyle(PaintStyle.Fill);
  mask.setBlendMode(BlendMode.DstIn);
  mask.setShader(
    Skia.Shader.MakeRadialGradient(
      Skia.Point(64, 64),
      63,
      [
        Skia.Color("rgba(255,255,255,1)"),
        Skia.Color("rgba(255,255,255,0.55)"),
        Skia.Color("rgba(255,255,255,0)"),
      ],
      [0, 0.6, 1],
      TileMode.Clamp,
    ),
  );
  canvas.drawRect(Skia.XYWHRect(0, 0, S, S), mask);

  const tex = makeDataTexture({ data: surf.toRGBA(), width: S, height: S });
  tex.name = "chamber-vapour";
  tex.needsUpdate = true;
  return tex;
}

/** mulberry32 — deterministic, so the mist is fixed art rather than re-rolled per mount. The
 * design uses Math.random(); seeding means a replayed reveal looks identical. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A billboarded instanced quad. `position` is the quad's own -0.5..0.5 corner offset; every
// instance supplies its own world centre, world size, opacity, tint and roll.
//
// The billboarding is the crux: the corner offset is applied in VIEW space (after the instance
// centre has been transformed), which is exactly what THREE.Sprite does internally and what makes
// `aScale` a genuine world-unit diameter rather than a pixel figure.
const VERT = /* glsl */ `
  attribute vec3  aCentre;
  attribute float aScale;
  attribute float aOpacity;
  attribute vec3  aTint;
  attribute float aRoll;

  varying vec2  vUv;
  varying float vAlpha;
  varying vec3  vTint;

  void main(){
    vUv    = uv;
    vAlpha = aOpacity;
    vTint  = aTint;

    if (aOpacity <= 0.002 || aScale <= 0.0) {
      // Collapse the quad behind the far plane rather than rasterising a zero-alpha billboard.
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }

    vec4 centreView = viewMatrix * modelMatrix * vec4(aCentre, 1.0);

    float c = cos(aRoll);
    float s = sin(aRoll);
    vec2  corner = position.xy * aScale;
    vec2  rolled = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);

    centreView.xy += rolled;
    gl_Position = projectionMatrix * centreView;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec2  vUv;
  varying float vAlpha;
  varying vec3  vTint;

  void main(){
    vec4 t = texture2D(uMap, vUv);
    float a = t.a * vAlpha;
    if (a <= 0.002) discard;
    gl_FragColor = vec4(vTint, a);
  }
`;

/** One particle's static character, mirroring the design's own per-sprite object. */
interface Particle {
  role: number;
  x0: number;
  y0: number;
  z0: number;
  s0: number;
  op: number;
  rot: number;
  spin: number;
  ph: number;
  // Spill-only.
  lift: number;
  drop: number;
  ang: number;
  reach: number;
  spillAt: number;
  t0: number;
  dur: number;
}

export interface ObsidianMist {
  group: THREE.Group;
  /**
   * The design's own `updateMist(F, t, ceil, lidUp)`.
   *
   * @param fog   0..1 overall progress (the design's `F`)
   * @param time  seconds, for the idle drift
   * @param ceil  world Y above which vapour may not rise (tracks the lid)
   * @param lidUp 0..1 lid openness
   */
  update(fog: number, time: number, ceil: number, lidUp: number): void;
  dispose(): void;
}

export function buildObsidianMist(interiorW: number, interiorD: number): ObsidianMist {
  const rnd = seeded(0x7f2a91);
  const tex = mistTexture();

  // ---- particle table, verbatim from the design's four banks ----------------
  const parts: Particle[] = [];
  const blank = { lift: 0, drop: 0, ang: 0, reach: 0, spillAt: 0, t0: 0, dur: 1 };

  // The main chamber bank.
  for (let i = 0; i < N_CORE; i++) {
    parts.push({
      role: ROLE_CORE,
      x0: (rnd() * 2 - 1) * 0.138,
      y0: 0.024 + rnd() * 0.058,
      z0: (rnd() * 2 - 1) * 0.09,
      s0: 0.082 + rnd() * 0.062,
      op: 0.62 + rnd() * 0.33,
      rot: rnd() * 6.28,
      spin: (rnd() - 0.5) * 0.6,
      ph: rnd() * 6.28,
      ...blank,
    });
  }
  // A tighter bank right over the cushion, "so nothing of the watch reads through".
  for (let i = 0; i < N_CAP; i++) {
    parts.push({
      role: ROLE_CORE,
      x0: (rnd() * 2 - 1) * 0.058,
      y0: 0.07 + rnd() * 0.042,
      z0: (rnd() * 2 - 1) * 0.05,
      s0: 0.068 + rnd() * 0.05,
      op: 0.78 + rnd() * 0.22,
      rot: rnd() * 6.28,
      spin: (rnd() - 0.5) * 0.5,
      ph: rnd() * 6.28,
      ...blank,
    });
  }
  // Dead centre, right on top of the watch — "the last place any shape could read through".
  for (let i = 0; i < N_CENTRE; i++) {
    parts.push({
      role: ROLE_CORE,
      x0: (rnd() * 2 - 1) * 0.03,
      y0: 0.082 + rnd() * 0.038,
      z0: (rnd() * 2 - 1) * 0.026,
      s0: 0.058 + rnd() * 0.034,
      op: 0.92 + rnd() * 0.08,
      rot: rnd() * 6.28,
      spin: (rnd() - 0.5) * 0.4,
      ph: rnd() * 6.28,
      ...blank,
    });
  }
  // The part that pours out over the two sides.
  for (let i = 0; i < N_SPILL; i++) {
    const early = i % 2 === 0;
    const x0 = (rnd() * 2 - 1) * 0.145;
    parts.push({
      role: ROLE_SPILL,
      x0,
      y0: 0.022 + rnd() * 0.028,
      z0: (rnd() * 2 - 1) * 0.092,
      s0: 0.034 + rnd() * 0.046,
      op: 0.2 + rnd() * 0.18,
      rot: rnd() * 6.28,
      spin: (rnd() - 0.5) * 1.3,
      ph: rnd() * 6.28,
      lift: 0.048 + rnd() * 0.042,
      drop: 0.055 + rnd() * 0.075,
      // The spill runs left and right — off the two long sides, never toward the camera.
      ang: (x0 < 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.85,
      reach: 0.1 + rnd() * 0.26,
      spillAt: early ? 0.05 : 0.26,
      t0: early ? rnd() * 0.1 : rnd() * 0.4,
      dur: early ? 0.34 + rnd() * 0.26 : 0.48 + rnd() * 0.46,
    });
  }

  // ---- instanced billboard geometry ---------------------------------------
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.attributes.position = quad.attributes.position;
  geo.attributes.uv = quad.attributes.uv;
  geo.instanceCount = N_TOTAL;

  const aCentre = new Float32Array(N_TOTAL * 3);
  const aScale = new Float32Array(N_TOTAL);
  const aOpacity = new Float32Array(N_TOTAL);
  const aTint = new Float32Array(N_TOTAL * 3);
  const aRoll = new Float32Array(N_TOTAL);

  // Per-particle tint, from the design's own `setHSL(.08, .05, ...)` — a barely-warm grey, varied
  // in lightness so the volume has internal structure instead of reading as one flat colour.
  const tintColor = new THREE.Color();
  for (let i = 0; i < N_TOTAL; i++) {
    const p = parts[i];
    const light =
      p.role === ROLE_SPILL
        ? 0.52 + rnd() * 0.16
        : p.s0 > 0.08
          ? 0.5 + rnd() * 0.16
          : 0.54 + rnd() * 0.14;
    tintColor.setHSL(0.08, 0.05, light);
    aTint[i * 3] = tintColor.r;
    aTint[i * 3 + 1] = tintColor.g;
    aTint[i * 3 + 2] = tintColor.b;
    aCentre[i * 3] = p.x0;
    aCentre[i * 3 + 1] = p.y0;
    aCentre[i * 3 + 2] = p.z0;
    aScale[i] = p.s0;
    aRoll[i] = p.rot;
  }

  const centreAttr = new THREE.InstancedBufferAttribute(aCentre, 3);
  const scaleAttr = new THREE.InstancedBufferAttribute(aScale, 1);
  const opacityAttr = new THREE.InstancedBufferAttribute(aOpacity, 1);
  const rollAttr = new THREE.InstancedBufferAttribute(aRoll, 1);
  centreAttr.setUsage(THREE.DynamicDrawUsage);
  scaleAttr.setUsage(THREE.DynamicDrawUsage);
  opacityAttr.setUsage(THREE.DynamicDrawUsage);
  rollAttr.setUsage(THREE.DynamicDrawUsage);

  geo.setAttribute("aCentre", centreAttr);
  geo.setAttribute("aScale", scaleAttr);
  geo.setAttribute("aOpacity", opacityAttr);
  geo.setAttribute("aTint", new THREE.InstancedBufferAttribute(aTint, 3));
  geo.setAttribute("aRoll", rollAttr);
  // The spill travels well outside the chamber; a bounds derived from resting positions alone
  // would frustum-cull the cloud mid-vent.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.06, 0), 0.8);

  const spriteMat = new THREE.ShaderMaterial({
    name: "chamber_vapour_sprites",
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uMap: { value: tex } },
    transparent: true,
    depthWrite: false,
    // Normal blending, as the design's SpriteMaterial uses. Additive would brighten the watch into
    // visibility instead of hiding it.
    blending: THREE.NormalBlending,
  });

  const sprites = new THREE.Mesh(geo, spriteMat);
  sprites.name = "ChamberVapourSprites";
  sprites.frustumCulled = false;
  // Drawn after the volume wash, so the textured blobs sit in front of it.
  sprites.renderOrder = 11;

  // ---- the volume wash ----------------------------------------------------
  // Reverted to the design's own material and transforms. `opacity = dense * 0.9` — deliberately
  // NEVER opaque. This is a soft volumetric fill behind the sprites, not the occluder; making it
  // opaque is what produced the hard-edged grey box.
  const volMat = new THREE.MeshStandardMaterial({
    name: "chamber_vapour",
    color: 0x9b9c9e,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    envMapIntensity: 0.35,
  });
  const volOuterGeo = slab(interiorW - 0.006, interiorD - 0.006, 0.09, 0.036, 0.016);
  const volInnerGeo = slab(interiorW - 0.046, interiorD - 0.042, 0.086, 0.032, 0.014);
  const volOuter = new THREE.Mesh(volOuterGeo, volMat);
  volOuter.name = "ChamberVapour";
  volOuter.renderOrder = 9;
  const volInner = new THREE.Mesh(volInnerGeo, volMat);
  volInner.name = "ChamberVapourCore";
  volInner.renderOrder = 10;

  const group = new THREE.Group();
  group.name = "VaultMist";
  group.visible = false;
  group.add(volOuter, volInner, sprites);

  function update(fog: number, time: number, ceil: number, lidUp: number): void {
    // Nothing renders while the vault is still sealed, or once the chamber has cleared.
    group.visible = fog > 0.002 && fog < 0.999;
    if (!group.visible) return;

    // The design's own curves, unchanged: opaque -> translucent -> empty, and a vapour column that
    // can only rise with the lid.
    const dense = 1 - smooth(0.44, 0.95, fog);
    const k = 0.55 + 0.36 * Math.min(1, lidUp * 1.3);

    volMat.opacity = dense * 0.9;
    const volVisible = dense > 0.004;
    volOuter.visible = volVisible;
    volInner.visible = volVisible;
    volOuter.scale.y = k;
    volOuter.position.y = 0.02 + 0.045 * k;
    volInner.scale.y = k * 0.96;
    volInner.position.y = 0.02 + 0.043 * k * 0.96;

    for (let i = 0; i < N_TOTAL; i++) {
      const p = parts[i];

      if (p.role === ROLE_CORE) {
        if (dense <= 0.003) {
          aOpacity[i] = 0;
          continue;
        }
        aCentre[i * 3] = p.x0 + Math.sin(time * 0.17 + p.ph) * 0.007;
        aCentre[i * 3 + 1] = Math.min(
          p.y0 + Math.sin(time * 0.21 + p.ph * 1.7) * 0.004 + (1 - dense) * 0.034,
          ceil
        );
        aCentre[i * 3 + 2] = p.z0 + Math.cos(time * 0.14 + p.ph) * 0.007;
        aScale[i] = p.s0 * (1 + (1 - dense) * 0.55);
        aRoll[i] = p.rot + time * p.spin * 0.08;
        aOpacity[i] = p.op * dense;
        continue;
      }

      const u = clamp01((fog - p.t0) / p.dur);
      if (u <= 0 || u >= 1) {
        aOpacity[i] = 0;
        continue;
      }
      const climb = easeOut(clamp01(u / 0.34));
      const spill = smooth(p.spillAt, 1, u);
      const r = spill * p.reach;
      const nx = p.x0 + Math.cos(p.ang) * r;
      const inBox = Math.abs(nx) < 0.17;
      aCentre[i * 3] = nx;
      aCentre[i * 3 + 1] = clamp(
        p.y0 + climb * p.lift - spill * spill * p.drop,
        0.004,
        inBox ? ceil : 0.14
      );
      aCentre[i * 3 + 2] = p.z0 + Math.sin(p.ang) * r;
      aScale[i] = p.s0 * (1 + spill * 2.1);
      aRoll[i] = p.rot + u * p.spin;
      aOpacity[i] = p.op * smooth(0, 0.13, u) * (1 - smooth(0.58, 1, u));
    }

    centreAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    opacityAttr.needsUpdate = true;
    rollAttr.needsUpdate = true;
  }

  return {
    group,
    update,
    dispose: () => {
      quad.dispose();
      geo.dispose();
      spriteMat.dispose();
      volOuterGeo.dispose();
      volInnerGeo.dispose();
      volMat.dispose();
      tex.dispose();
    },
  };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
function smooth(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
