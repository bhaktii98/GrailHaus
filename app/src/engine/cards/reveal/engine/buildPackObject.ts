// Ported from project/rip-pack.js (Claude Design prototype). This module
// is pure three.js math — geometry construction, procedural deformation,
// simple ballistic physics for the torn strip — and had zero DOM
// dependencies in the original beyond the texture source, so it carries
// over to React Native almost unchanged. The only real change is the
// texture pipeline (see art/packArt.ts + engine/textures.ts) and the
// addition of dispose() for GPU-memory discipline across a session, which
// the trial spec calls out explicitly (instructions.md, "GPU discipline").
import * as THREE from 'three';
import type { SkImage } from '@shopify/react-native-skia';
import { noise } from './noise';
import { drawFront, drawBack, drawCardBack, drawShine } from '../art/packArt';
import { fastComputeVertexNormals, gridLayout, makeScratch, type DeformScratch } from './fastGeometry';
import { makeDataTexture } from './textures';
import type { CategoryPersonality } from '../config/types';

export interface BuiltPack {
  group: THREE.Group;
  size: { W: number; H: number; T: number };
  seamY: number;
  setProgress: (p: number) => void;
  setTime: (time: number, energy?: number) => void;
  react: (dt: number, pullX: number, pulling: boolean) => void;
  /** True on frames where something the shadow map depends on actually moved — the tear deform
   * re-ran, or the released strip is still falling. The scene uses this to re-render the shadow
   * map only when it would actually change (see PackTearMesh), instead of every frame. */
  shadowDirty: () => boolean;
  /** Frees every geometry, material and texture this pack allocated.
   * Call when the reveal is dismissed — required before building the next
   * pack in a batch, or memory climbs pack over pack. */
  dispose: () => void;
}

interface SheetData {
  geometry: THREE.BufferGeometry;
  pos: THREE.BufferAttribute;
  rest: Float32Array;
  center: [number, number];
  sign?: number;
  /** Per-column/per-row term caches for the deform passes — see engine/fastGeometry.ts. */
  scratch: DeformScratch;
}

export function buildPackObject(personality: CategoryPersonality, logo: SkImage | null): BuiltPack {
  const { size, seamFrac, flapFrac, palette, copy, cardFace, cardCount } = personality;
  const { width: W, height: H, thickness: T } = size;
  const seamY = H / 2 - seamFrac * H;

  const disposeGeo: THREE.BufferGeometry[] = [];
  const disposeMat: THREE.Material[] = [];
  const disposeTex: THREE.Texture[] = [];

  // Texture resolution: a phone shows this pack at a fraction of screen
  // width, not the full-bleed browser preview the prototype targeted —
  // 640×960 (front/back) and 480×672 (card, one texture shared by every
  // card mesh) keep the crimp/text detail crisp while cutting GPU memory
  // roughly in half versus the prototype's 800×1200 canvases.
  const frontPixels = drawFront({ width: 640, height: 960, seamFrac, flapFrac, palette, copy, logo });
  const backPixels = drawBack({ width: 640, height: 960, seamFrac, flapFrac, palette, copy, logo: null });
  const cardPixels = drawCardBack({ width: 480, height: 672, palette, cardFace });
  const shinePixels = drawShine(512, 32);

  const frontTex = makeDataTexture(frontPixels);
  const backTex = makeDataTexture(backPixels);
  const cardTex = makeDataTexture(cardPixels);
  const glintTex = makeDataTexture(shinePixels, { repeatX: true });
  disposeTex.push(frontTex, backTex, cardTex, glintTex);

  // Foil: fairly metallic, and flat-shaded so every crease catches its own
  // highlight instead of smoothing into plastic.
  const foil = (map: THREE.Texture, name: string) => {
    const m = new THREE.MeshStandardMaterial({
      name, map, roughness: 0.26, metalness: 0.45, flatShading: true,
      side: THREE.DoubleSide, transparent: false, alphaTest: 0.5, depthWrite: true,
    });
    disposeMat.push(m);
    return m;
  };
  const frontMat = foil(frontTex, 'foilFront');
  const backMat = foil(backTex, 'foilBack');

  const pillowZ = (u: number, v: number) => {
    const t = (v - flapFrac) / (1 - 2 * flapFrac);
    if (t <= 0 || t >= 1) return 0;
    const uu = Math.min(1, Math.max(0, u));
    return (T / 2) * Math.pow(Math.sin(Math.PI * uu), 0.55) * Math.pow(Math.sin(Math.PI * t), 0.5);
  };

  // tear line: fibrous, with the odd deeper nick
  const tearY = (X: number) => {
    const n = noise(X * 55) * 0.0014;
    const fine = noise(X * 190) * 0.0005;
    const nick = Math.max(0, noise(X * 17 + 5.5)) ** 3 * 0.0026;
    return Math.max(0, n + fine + nick);
  };

  const sheet = (
    x0: number, x1: number, y0: number, y1: number,
    nx: number, ny: number, sign: number, mirror: boolean, edge: 'top' | 'bottom',
  ): SheetData => {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, nx, ny);
    disposeGeo.push(g);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const pos = g.attributes.position as THREE.BufferAttribute;
    const uv = g.attributes.uv as THREE.BufferAttribute;
    let yTop = -Infinity, yBot = Infinity;
    for (let i = 0; i < pos.count; i++) {
      yTop = Math.max(yTop, pos.getY(i)); yBot = Math.min(yBot, pos.getY(i));
    }
    for (let i = 0; i < pos.count; i++) {
      const X = pos.getX(i) + cx;
      let Y = pos.getY(i) + cy;
      // the two torn edges are cut from the same curve, so they interlock
      if (edge === 'top' && Math.abs(pos.getY(i) - yTop) < 1e-6) {
        Y -= tearY(X); pos.setY(i, Y - cy);
      } else if (edge === 'bottom' && Math.abs(pos.getY(i) - yBot) < 1e-6) {
        Y -= tearY(X); pos.setY(i, Y - cy);
      }
      const u = (X + W / 2) / W, v = (Y + H / 2) / H;
      pos.setZ(i, sign * pillowZ(u, v));
      uv.setXY(i, mirror ? 1 - u : u, v);
    }
    g.computeVertexNormals();
    // The pack is always the subject of this shot and never leaves the frustum, so culling buys
    // nothing — but leaving it on would force a bounding-sphere rebuild (a whole extra pass over
    // the vertices) after every deform. A fixed, generous sphere keeps the mesh permanently
    // "visible" to the culler and takes that pass off the per-frame path.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Math.max(W, H) * 2);

    const rest = Float32Array.from(pos.array as Float32Array);
    const scratch = makeScratch(gridLayout(nx, ny));
    const { cols, rows } = scratch.layout;
    // Bake the rest-pose-only terms: each column's `u`, and each row's set (which differs by the
    // sheet's role — see the matching comment in vaultReveal/engine/buildVaultPackObject.ts).
    for (let c = 0; c < cols; c++) {
      scratch.u[c] = (rest[c * 3] + cx + W / 2) / W;
    }
    for (let r = 0; r < rows; r++) {
      const rowI3 = r * cols * 3;
      if (edge === 'bottom') {
        const dy = rest[rowI3 + 1] + cy - seamY;
        const along = Math.min(1, Math.max(0, dy / (H / 2 - seamY)));
        scratch.rowA[r] = dy;
        scratch.rowB[r] = along;
        scratch.rowC[r] = Math.sin(along * Math.PI);
      } else {
        const Y = rest[rowI3 + 1] + cy;
        const d = (seamY - Y) / (H * 0.3);
        const oneMinusD = Math.max(0, 1 - d);
        scratch.rowA[r] = Math.pow(oneMinusD, 2.2);
        scratch.rowB[r] = oneMinusD;
      }
    }

    return { geometry: g, pos, rest, center: [cx, cy], scratch };
  };

  const group = new THREE.Group();
  group.name = 'grailhausPack';

  // ---- sealed body ------------------------------------------------------
  const body = new THREE.Group();
  body.name = 'packBody';
  const bodySheets: (SheetData & { sign: number })[] = [];
  ([[1, false, frontMat, 'bodyFrontSheet'], [-1, true, backMat, 'bodyBackSheet']] as const).forEach(
    ([sign, mirror, mat, name]) => {
      const s = sheet(-W / 2, W / 2, -H / 2, seamY, 96, 80, sign, mirror, 'top');
      const m = new THREE.Mesh(s.geometry, mat);
      m.name = name;
      m.position.set(s.center[0], s.center[1], 0);
      m.castShadow = m.receiveShadow = true;
      body.add(m);
      bodySheets.push({ ...s, sign });
    },
  );
  group.add(body);

  // `lip` and the buckle noise are pure functions of a column's `u` and the sheet's `sign`, so
  // they are evaluated once here rather than once per vertex per frame — taking a five-octave
  // noise off the per-frame path for 2 x 97 columns.
  bodySheets.forEach(({ sign, scratch }) => {
    const { cols } = scratch.layout;
    for (let c = 0; c < cols; c++) {
      const u = scratch.u[c];
      scratch.colA[c] = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
      scratch.colB[c] = noise(u * 14 + sign);
    }
  });

  // ---- cards ------------------------------------------------------------
  const cards = new THREE.Group();
  cards.name = 'cards';
  // Portrait ratio matching this file's own card texture (480×672, drawn just above) — the
  // original (rip-pack.js) used 620/868, the equivalent ratio (~0.714) for its own canvas size.
  // This had been inverted to 672/480 (~1.4, landscape) during the original port, stretching
  // every card mesh sideways instead of keeping it portrait.
  const ch = H * 0.6, cw = ch * (480 / 672);
  const cardRestY = -H / 2 + flapFrac * H * 1.4 + ch / 2;
  const cardGeo = new THREE.PlaneGeometry(cw, ch);
  disposeGeo.push(cardGeo);
  for (let i = 0; i < cardCount; i++) {
    const mat = new THREE.MeshStandardMaterial({
      name: `cardBack${i}`, map: cardTex, roughness: 0.34, metalness: 0.25,
      emissive: 0x140a26, emissiveIntensity: 0.18,
    });
    disposeMat.push(mat);
    const m = new THREE.Mesh(cardGeo, mat);
    m.name = `card${i}`;
    m.position.set(0, cardRestY, (i - (cardCount - 1) / 2) * 0.0013);
    cards.add(m);
  }
  group.add(cards);

  // ---- tear-away top strip (front + back halves) ------------------------
  const lidMat = frontMat.clone();
  lidMat.name = 'foilLidFront';
  const lidMatBack = backMat.clone();
  lidMatBack.name = 'foilLidBack';
  disposeMat.push(lidMat, lidMatBack);
  const lidS = sheet(-W / 2, W / 2, seamY, H / 2, 96, 30, 1, false, 'bottom');
  const lidSB = sheet(-W / 2, W / 2, seamY, H / 2, 96, 30, -1, true, 'bottom');
  const lid = new THREE.Group();
  lid.name = 'packTopStrip';
  const lidFace = new THREE.Mesh(lidS.geometry, lidMat);
  lidFace.name = 'lidFrontSheet';
  lidFace.castShadow = true;
  lidFace.position.set(lidS.center[0], lidS.center[1], 0);
  const lidBack = new THREE.Mesh(lidSB.geometry, lidMatBack);
  lidBack.name = 'lidBackSheet';
  lidBack.castShadow = true;
  lidBack.position.set(lidSB.center[0], lidSB.center[1], 0);
  lid.add(lidFace, lidBack);
  group.add(lid);

  const lidHome = lid.position.clone();
  const lidSpanY = H / 2 - seamY;
  const PEEL = 0.4;

  // Peel + crinkle: each column hinges at the crimp as the rip passes it,
  // and the sheet gathers into folds — foil buckles, it does not bend
  // smoothly.
  // Restructured into two passes — per-column terms once, then a grid sweep — rather than
  // recomputing every column's `u`-derived terms (including a five-octave noise) once per row.
  // Identical math and identical output; see engine/fastGeometry.ts for the full rationale.
  const deformLidSheet = (sheetData: SheetData, q: number) => {
    const { pos, rest, center, geometry, scratch } = sheetData;
    const { cols, rows } = scratch.layout;
    const arr = pos.array as Float32Array;
    const lead = q * (1 + PEEL);
    const cy0 = center[1] - seamY;

    const cU = scratch.u, cE = scratch.colA, cAhead = scratch.colB, cK = scratch.colC,
      cFold = scratch.colD, cNoise = scratch.colE;
    for (let c = 0; c < cols; c++) {
      const u = cU[c];
      const t = Math.min(1, Math.max(0, (lead - u) / PEEL));
      cE[c] = t * t * t * (t * (t * 6 - 15) + 10);
      cAhead[c] = Math.max(0, 1 - Math.abs((lead - u) / (PEEL * 0.35)));
      cK[c] = 1 - (Math.min(1, Math.max(0, (t - 0.72) / 0.28)) ** 1.6);
      cFold[c] = Math.sin(u * Math.PI * 13 + q * 5);
      cNoise[c] = noise(u * 8 + q);
    }

    for (let r = 0; r < rows; r++) {
      const dy = scratch.rowA[r], along = scratch.rowB[r], sinAlong = scratch.rowC[r];
      const base = r * cols;
      for (let c = 0; c < cols; c++) {
        const i3 = (base + c) * 3;
        const x = rest[i3], z = rest[i3 + 2];
        const u = cU[c], e = cE[c], ahead = cAhead[c];

        const crinkle = cFold[c] * sinAlong * 0.0031 * e + cNoise[c] * 0.0012 * e;
        const a = e * 2.35 * (0.5 + 0.5 * along) + crinkle * 26 + ahead * 0.22 * along;
        const ca = Math.cos(a), sa = Math.sin(a);
        const ny = dy * ca - z * sa;
        const nz = dy * sa + z * ca + crinkle;
        const k = cK[c];

        arr[i3] = x - e * 0.006 * (u - 0.5) + crinkle * 0.5;
        arr[i3 + 1] = (ny - cy0 + e * 0.0022 * along - ahead * 0.0009 * (1 - along)) * k;
        arr[i3 + 2] = (nz - e * 0.0015 + ahead * 0.0016 * (1 - along)) * k;
      }
    }
    pos.needsUpdate = true;
    fastComputeVertexNormals(geometry);
  };
  const deformLid = (q: number) => { [lidS, lidSB].forEach((sh) => deformLidSheet(sh, q)); };

  // The mouth: once the strip is off, the two walls spring apart into a V
  // and the torn edge loosens and buckles.
  // Two-pass, same as deformLidSheet. `lip` and the buckle noise depend only on `u`/`sign`, so
  // they are baked once at build (see bakeBodyColumns below the sheet construction) and only the
  // rip-tracking tug is recomputed per column per frame.
  const deformBody = (q: number) => {
    const open = Math.min(1, Math.max(0, (q - 0.22) / 0.78));
    const ripU = Math.min(1, q / 0.8);
    const tugOn = q >= 0.02;
    bodySheets.forEach(({ pos, rest, sign, geometry, scratch }) => {
      const { cols, rows } = scratch.layout;
      const arr = pos.array as Float32Array;
      const cU = scratch.u, cLip = scratch.colA, cNoise = scratch.colB, cTugU = scratch.colC;

      for (let c = 0; c < cols; c++) {
        cTugU[c] = tugOn ? Math.max(0, 1 - Math.abs(cU[c] - ripU) / 0.16) * 0.0014 : 0;
      }

      for (let r = 0; r < rows; r++) {
        const gfRow = scratch.rowA[r] * open;
        const oneMinusD = scratch.rowB[r];
        const base = r * cols;
        for (let c = 0; c < cols; c++) {
          const i3 = (base + c) * 3;
          const x = rest[i3], y = rest[i3 + 1], z = rest[i3 + 2];
          const lip = cLip[c];
          const buckle = cNoise[c] * 0.0012 * gfRow;
          const tug = cTugU[c] * oneMinusD;

          arr[i3] = x * (1 + gfRow * 0.05 * lip);
          arr[i3 + 1] = y - gfRow * 0.0015 + tug * 0.6;
          arr[i3 + 2] = z + sign * (gfRow * T * 2.4 * lip + Math.abs(buckle) + tug);
        }
      }
      pos.needsUpdate = true;
      fastComputeVertexNormals(geometry);
    });
  };

  // ---- glint travelling along the crimp (pull cue only) -----------------
  const seamV = (seamY + H / 2) / H;
  const glintGeo = new THREE.PlaneGeometry(W * 1.02, H * 0.022, 40, 1);
  disposeGeo.push(glintGeo);
  {
    const gp = glintGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i++) {
      const u = (gp.getX(i) + W * 0.51) / (W * 1.02);
      gp.setZ(i, pillowZ(Math.min(0.98, Math.max(0.02, u)), seamV) + 0.0013);
    }
  }
  const glintMat = new THREE.MeshBasicMaterial({
    name: 'crimpGlint', map: glintTex, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
  });
  disposeMat.push(glintMat);
  const glint = new THREE.Mesh(glintGeo, glintMat);
  glint.name = 'crimpGlint';
  glint.position.y = seamY;
  group.add(glint);

  // ---- torn-off strip resting on the ground -----------------------------
  const scrapMat = frontMat.clone();
  scrapMat.side = THREE.DoubleSide;
  scrapMat.name = 'foilScrap';
  disposeMat.push(scrapMat);
  const scrapGeo = new THREE.PlaneGeometry(W, H / 2 - seamY, 60, 14);
  disposeGeo.push(scrapGeo);
  {
    const sp = scrapGeo.attributes.position as THREE.BufferAttribute;
    const su = scrapGeo.attributes.uv as THREE.BufferAttribute;
    const hh = H / 2 - seamY;
    for (let i = 0; i < sp.count; i++) {
      const X = sp.getX(i), Y = sp.getY(i);
      const u = (X + W / 2) / W, v = (Y + hh / 2) / hh;
      sp.setZ(i, noise(u * 9) * 0.0022 + Math.sin(u * 19) * 0.0009 * (0.4 + v));
      sp.setX(i, X + noise(u * 5 + 2) * 0.0015);
      su.setXY(i, u, 1 - (H / 2 - seamY) / H * (1 - v));
    }
    scrapGeo.computeVertexNormals();
  }
  const scrap = new THREE.Mesh(scrapGeo, scrapMat);
  scrap.name = 'tornStrip';
  scrap.receiveShadow = scrap.castShadow = true;
  scrap.visible = false;
  group.add(scrap);

  // simple ballistic state for the released strip
  const phys = {
    live: false, settled: false,
    p: new THREE.Vector3(), v: new THREE.Vector3(),
    r: new THREE.Euler(), w: new THREE.Vector3(),
  };
  const groundLevel = -H / 2 + 0.0015;
  const release = (dirX: number) => {
    phys.live = true; phys.settled = false;
    phys.p.set(W * 0.3, seamY + (H / 2 - seamY) * 0.5, T * 2.4);
    phys.v.set(0.022 + dirX * 0.014, 0.024, 0.012);
    phys.r.set(-0.2, 0.1, -0.15);
    phys.w.set(1.8, 0.8, -2.2);
    scrap.visible = true;
  };
  const stepPhys = (dt: number) => {
    if (!phys.live || phys.settled) return;
    phys.v.y -= 0.55 * dt;
    phys.v.multiplyScalar(1 - 2.6 * dt);
    phys.v.x *= phys.p.x > W * 0.9 ? 0.82 : 1;
    phys.p.addScaledVector(phys.v, dt);
    phys.r.x += phys.w.x * dt; phys.r.y += phys.w.y * dt; phys.r.z += phys.w.z * dt;
    phys.w.multiplyScalar(1 - 2.4 * dt);
    if (phys.p.y <= groundLevel) {
      phys.p.y = groundLevel;
      if (Math.abs(phys.v.y) < 0.012) {
        phys.settled = true;
        phys.v.set(0, 0, 0);
        phys.r.x = -Math.PI / 2 + 0.1; phys.r.z = -0.3;
      } else {
        phys.v.y = -phys.v.y * 0.24;
        phys.v.x *= 0.5; phys.v.z *= 0.5;
        phys.w.multiplyScalar(0.4);
      }
    }
    scrap.position.copy(phys.p);
    scrap.rotation.copy(phys.r);
  };

  let fade = 1;
  // `setProgress` runs every frame whether or not the tear actually moved (PackTearMesh's
  // useFrame calls it unconditionally), but deformLid/deformBody walk every vertex of four
  // sheets and rebuild their normals — real, continuous CPU cost with nothing to show for it
  // while the pack sits static, which is most of this screen's on-screen time (sealed at 0
  // before the user starts, fully torn at 1 afterwards). Skipping the deform when `q` hasn't
  // meaningfully changed leaves every other per-frame system untouched and costs nothing
  // visually — a deform with the same input produces the same vertices.
  // (vaultReveal/engine/buildVaultPackObject.ts has had this guard; Tier 1 did not.)
  let lastQ = -1;
  let deformedThisFrame = false;
  const setProgress = (p: number) => {
    const q = Math.min(1, Math.max(0, p));
    if (Math.abs(q - lastQ) > 1e-4) {
      lastQ = q;
      deformedThisFrame = true;
      const peel = Math.min(1, q / 0.8);
      deformLid(peel);
      deformBody(q);
    }

    const o = Math.min(1, Math.max(0, (q - 0.86) / 0.14));
    const drop = o * o;
    const groundY = -H / 2 + 0.001;
    lid.position.set(
      lidHome.x + o * W * 0.42,
      lidHome.y + Math.sin(o * Math.PI) * H * 0.06 - drop * (lidHome.y - groundY),
      lidHome.z - o * T * 2.6,
    );
    lid.rotation.set(-drop * Math.PI / 2, o * 0.3, -o * 0.35 * (1 - drop * 0.7));
    lid.receiveShadow = drop > 0.9;

    const rise = Math.min(1, Math.max(0, (q - 0.45) / 0.55));
    const rq = rise * rise * (3 - 2 * rise);
    const fanQ = Math.min(1, Math.max(0, (q - 0.8) / 0.2));
    const mid = (cardCount - 1) / 2;
    cards.children.forEach((c, i) => {
      const k = i - mid;
      c.position.set(
        k * fanQ * W * 0.16,
        cardRestY + rq * 0.042 - fanQ * Math.abs(k) * 0.004,
        (i - mid) * 0.0013,
      );
      c.rotation.set(0, 0, -k * fanQ * 0.13);
    });

    if (q > 0.97 && !phys.live) release(1);
    if (q < 0.02 && phys.live) { phys.live = false; scrap.visible = false; }

    fade = 1 - Math.min(1, q * 2.4);
  };

  // Pack reacts to the pull: leans against the tension, springs back when
  // the gesture is released.
  let lean = 0, leanV = 0;
  const react = (dt: number, pullX: number, pulling: boolean) => {
    const target = pulling ? pullX * 0.14 : 0;
    leanV += (target - lean) * 34 * dt;
    leanV *= 1 - 5.5 * dt;
    lean += leanV * dt;
    group.rotation.z = -lean * 0.5;
    group.rotation.y = lean * 0.7;
    body.position.x = lean * 0.004;
    stepPhys(dt);
  };

  const setTime = (time: number, energy = 0) => {
    glintTex.offset.x = (time * (0.11 + energy * 0.45)) % 1;
    const idle = 0.3 + 0.14 * Math.sin(time * 1.3);
    glintMat.opacity = fade * Math.min(1.1, idle + energy * 0.6);
  };

  // Consumed once per frame by the scene. The shadow map needs redrawing whenever the pack's
  // geometry moved (a deform ran) or the torn strip is still airborne — and on nothing else, so
  // a sealed or fully-torn pack sitting still stops paying for a second full render pass.
  // Reading it clears the flag, so each frame's answer reflects only that frame's work.
  const shadowDirty = () => {
    const dirty = deformedThisFrame || (phys.live && !phys.settled);
    deformedThisFrame = false;
    return dirty;
  };

  const dispose = () => {
    disposeGeo.forEach((g) => g.dispose());
    disposeMat.forEach((m) => m.dispose());
    disposeTex.forEach((t) => t.dispose());
  };

  setProgress(0);
  return { group, size: { W, H, T }, seamY, setProgress, setTime, react, shadowDirty, dispose };
}
