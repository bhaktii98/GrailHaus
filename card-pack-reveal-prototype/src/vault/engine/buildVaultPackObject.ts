// Ported from project/rip-pack.js's buildPack(), specialised to the Tier 2
// "Vault Break" config (project/tiers.js's 'vault-break' entry): the same
// crimped-bag geometry and tear/peel/gape deformation as Tier 1's
// ../../reveal/engine/buildPackObject.ts, plus the pieces street-rip never
// needed — a metallic inner liner (visible once the mouth gapes), a foil
// pre-stretch before the tear starts (setStretch), and the staged card
// reveal (engine/buildReveal.ts) wired into setProgress's seal/unseal
// transitions. Pure three.js math, carried over unchanged; only the
// texture pipeline differs from the DOM prototype (see
// ../../reveal/engine/textures.ts's makeDataTexture, reused here as-is).
import * as THREE from 'three';
import type { SkImage } from '@shopify/react-native-skia';
import { noise } from '../../reveal/engine/noise';
import { makeDataTexture } from '../../reveal/engine/textures';
import { drawFront, drawBack, drawLiner, drawShine } from '../art/vaultArt';
import { drawCardFace, drawCardVerso } from '../art/cardArt';
import { buildReveal, type BuiltReveal } from './buildReveal';
import type { VaultBreakPersonality } from '../config/types';

export interface BuiltVaultPack {
  group: THREE.Group;
  size: { W: number; H: number; T: number };
  seamY: number;
  reveal: BuiltReveal;
  setProgress: (p: number) => void;
  setStretch: (amount: number, u: number) => void;
  setTime: (time: number, energy?: number) => void;
  react: (dt: number, pullX: number, pulling: boolean) => void;
  dispose: () => void;
}

interface SheetData {
  geometry: THREE.BufferGeometry;
  pos: THREE.BufferAttribute;
  rest: Float32Array;
  center: [number, number];
  sign?: number;
}

export function buildVaultPackObject(personality: VaultBreakPersonality, logo: SkImage | null): BuiltVaultPack {
  const { size, seamFrac, flapFrac, material, tear, liner: linerCfg, fan, reveal: revealTiming, riseY, deck } = personality;
  const { width: W, height: H, thickness: T } = size;
  const seamY = H / 2 - seamFrac * H;

  const disposeGeo: THREE.BufferGeometry[] = [];
  const disposeMat: THREE.Material[] = [];
  const disposeTex: THREE.Texture[] = [];

  // Texture resolution: 640×960 for the front/back foil panels (the
  // prototype's browser-preview canvases were 800×1200 — a phone shows
  // this pack at a fraction of that width), 256×256 for the liner web,
  // 512×32 for the crimp glint. Card faces/versos are native-resolution
  // in art/cardArt.ts already (see that file's own note).
  const frontPixels = drawFront({ width: 640, height: 960, seamFrac, flapFrac, logo });
  const backPixels = drawBack({ width: 640, height: 960, seamFrac, flapFrac, logo: null });
  const shinePixels = drawShine(512, 32);

  const frontTex = makeDataTexture(frontPixels);
  const backTex = makeDataTexture(backPixels);
  const glintTex = makeDataTexture(shinePixels, { repeatX: true });
  disposeTex.push(frontTex, backTex, glintTex);

  const pillowZ = (u: number, v: number) => {
    const t = (v - flapFrac) / (1 - 2 * flapFrac);
    if (t <= 0 || t >= 1) return 0;
    const uu = Math.min(1, Math.max(0, u));
    return (T / 2) * Math.pow(Math.sin(Math.PI * uu), 0.55) * Math.pow(Math.sin(Math.PI * t), 0.5);
  };

  // Foil: fairly metallic, and flat-shaded so every crease catches its own
  // highlight instead of smoothing into plastic.
  const foil = (map: THREE.Texture, name: string) => {
    const m = new THREE.MeshStandardMaterial({
      name, map, roughness: material.roughness, metalness: material.metalness, flatShading: true,
      side: THREE.DoubleSide, transparent: false, alphaTest: 0.5, depthWrite: true,
    });
    disposeMat.push(m);
    return m;
  };
  const frontMat = foil(frontTex, 'foilFront');
  const backMat = foil(backTex, 'foilBack');

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
    return { geometry: g, pos, rest: Float32Array.from(pos.array), center: [cx, cy] };
  };

  const group = new THREE.Group();
  group.name = 'grailhausVaultPack';

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

  // ---- inner liner: metal web inside the mouth, dark interior behind it -
  const liner = new THREE.Group();
  liner.name = 'packLiner';
  type LinerMesh = { mesh: THREE.Mesh; pos: THREE.BufferAttribute; rest: Float32Array; sign: number };
  let linerFront: LinerMesh | null = null;
  let linerBack: LinerMesh | null = null;
  if (linerCfg.enabled) {
    const linerTex = makeDataTexture(drawLiner(256, 256));
    disposeTex.push(linerTex);
    const lmat = new THREE.MeshStandardMaterial({
      name: 'innerLiner', map: linerTex, metalness: linerCfg.metalness, roughness: linerCfg.roughness,
      side: THREE.DoubleSide,
    });
    disposeMat.push(lmat);
    const lh = H * 0.28;
    const mk = (sign: number, name: string) => {
      const g = new THREE.PlaneGeometry(W * 0.9, lh, 24, 14);
      disposeGeo.push(g);
      const cy = seamY - lh / 2 - H * 0.004;
      const pos = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + cy);
      const m = new THREE.Mesh(g, lmat);
      m.name = name;
      m.receiveShadow = true;
      return { mesh: m, pos, rest: Float32Array.from(pos.array), sign };
    };
    linerFront = mk(1, 'linerFront');
    linerBack = mk(-1, 'linerBack');
    const interiorGeo = new THREE.PlaneGeometry(W * 0.96, H * 0.42);
    disposeGeo.push(interiorGeo);
    const interiorMat = new THREE.MeshStandardMaterial({ name: 'interiorShell', color: 0x06030d, roughness: 0.92, metalness: 0 });
    disposeMat.push(interiorMat);
    const interior = new THREE.Mesh(interiorGeo, interiorMat);
    interior.name = 'packInterior';
    interior.position.set(0, seamY - H * 0.21, -T * 0.24);
    liner.add(interior, linerBack.mesh, linerFront.mesh);
    liner.visible = false;
    group.add(liner);
  }

  // ---- cards: the staged reveal engine owns this group -------------------
  const ch = H * 0.6, cw = ch * (620 / 868);
  const cardRestY = -H / 2 + flapFrac * H * 1.4 + ch / 2;
  const faceTexes = deck.map((c) => {
    const tex = makeDataTexture(drawCardFace(c));
    disposeTex.push(tex);
    return tex;
  });
  const versoTex = makeDataTexture(drawCardVerso());
  disposeTex.push(versoTex);
  const reveal = buildReveal({
    deck, faceTexes, versoTex, cardW: cw, cardH: ch, restY: cardRestY, packT: T, fan, timing: revealTiming, riseY,
  });
  group.add(reveal.group);

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
  const PEEL = material.peel;

  // Foil stretch under the thumb before the tear front starts moving.
  // Reads as material density; costs the user only a few pixels of travel.
  let stretchAmt = 0, stretchU = 0;
  const setStretch = (amount: number, u: number) => { stretchAmt = amount; stretchU = u; };

  const deformLidSheet = (sheetData: SheetData, q: number) => {
    const { pos, rest, center, geometry } = sheetData;
    const lead = q * (1 + PEEL);
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      const X = x + center[0];
      const u = (X + W / 2) / W;
      const t = Math.min(1, Math.max(0, (lead - u) / PEEL));
      const e = t * t * t * (t * (t * 6 - 15) + 10);
      const ahead = Math.max(0, 1 - Math.abs((lead - u) / (PEEL * 0.35)));
      const pull = stretchAmt > 0
        ? Math.max(0, 1 - Math.abs(u - stretchU) / 0.22) * stretchAmt : 0;
      const dy = y + center[1] - seamY;
      const along = Math.min(1, Math.max(0, dy / lidSpanY));

      const fold = Math.sin(u * Math.PI * 13 + q * 5) * Math.sin(along * Math.PI);
      const crinkle = fold * 0.0031 * e + noise(u * 8 + q) * 0.0012 * e;

      const gone = Math.min(1, Math.max(0, (t - 0.72) / 0.28)) ** 1.6;
      const a = e * 2.35 * (0.5 + 0.5 * along) + crinkle * 26 + ahead * 0.22 * along;
      const ny = dy * Math.cos(a) - z * Math.sin(a);
      const nz = dy * Math.sin(a) + z * Math.cos(a) + crinkle;

      const k = 1 - gone;
      pos.setXYZ(
        i,
        x - e * 0.006 * (u - 0.5) + crinkle * 0.5,
        (ny - (center[1] - seamY) + e * 0.0022 * along - ahead * 0.0009 * (1 - along)) * k,
        (nz - e * 0.0015 + ahead * 0.0016 * (1 - along) + pull * 0.0042 * (0.35 + along)) * k,
      );
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };
  const deformLid = (q: number) => { [lidS, lidSB].forEach((sh) => deformLidSheet(sh, q)); };

  // The mouth: once the strip is off, the two walls spring apart into a V
  // and the torn edge loosens and buckles.
  const deformBody = (q: number) => {
    const open = Math.min(1, Math.max(0, (q - 0.22) / 0.78));
    bodySheets.forEach(({ pos, rest, center, sign, geometry }) => {
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const X = x + center[0], Y = y + center[1];
        const u = (X + W / 2) / W;
        const d = (seamY - Y) / (H * 0.3);
        const gf = Math.pow(Math.max(0, 1 - d), 2.2) * open;
        const lip = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
        const buckle = noise(u * 14 + sign) * 0.0012 * gf;
        const ripU = Math.min(1, q / 0.8);
        const tug = q < 0.02 ? 0
          : Math.max(0, 1 - Math.abs(u - ripU) / 0.16) * Math.max(0, 1 - d) * 0.0014;
        pos.setXYZ(
          i,
          x * (1 + gf * 0.05 * lip),
          y - gf * 0.0015 + tug * 0.6,
          z + sign * (gf * T * 2.4 * lip + Math.abs(buckle) + tug),
        );
      }
      pos.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
    });
    if (linerFront && linerBack) {
      liner.visible = open > 0.015;
      [linerFront, linerBack].forEach(({ pos, rest, sign, mesh }) => {
        for (let i = 0; i < pos.count; i++) {
          const x = rest[i * 3], Y = rest[i * 3 + 1];
          const u = (x + W / 2) / W;
          const d = (seamY - Y) / (H * 0.3);
          const gf = Math.pow(Math.max(0, 1 - d), 2.2) * open;
          const lip = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
          const wall = gf * T * 2.4 * lip + pillowZ(u, (Y + H / 2) / H);
          pos.setXYZ(i, x * (1 + gf * 0.05 * lip) * 0.97, Y - gf * 0.0015, sign * wall * 0.68);
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
      });
    }
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
      su.setXY(i, u, 1 - ((H / 2 - seamY) / H) * (1 - v));
    }
    scrapGeo.computeVertexNormals();
  }
  const scrap = new THREE.Mesh(scrapGeo, scrapMat);
  scrap.name = 'tornStrip';
  scrap.receiveShadow = scrap.castShadow = true;
  scrap.visible = false;
  group.add(scrap);

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
  const setProgress = (p: number) => {
    const q = Math.min(1, Math.max(0, p));
    const peel = Math.min(1, q / 0.8);
    deformLid(peel);
    deformBody(q);

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

    // the seal is the user's job; the presentation is the system's
    if (q > 0.97) reveal.start();
    if (q < 0.02) reveal.reset();

    if (q > 0.97 && !phys.live) release(1);
    if (q < 0.02 && phys.live) { phys.live = false; scrap.visible = false; }

    fade = 1 - Math.min(1, q * 2.4);
  };

  // Pack reacts to the pull: leans against the tension, springs back when
  // the gesture is released.
  let lean = 0, leanV = 0;
  const react = (dt: number, pullX: number, pulling: boolean) => {
    const target2 = pulling ? pullX * 0.14 : 0;
    leanV += (target2 - lean) * 34 * dt;
    leanV *= 1 - 5.5 * dt;
    lean += leanV * dt;
    group.rotation.z = -lean * 0.5;
    group.rotation.y = lean * 0.7;
    body.position.x = lean * 0.004;
    stepPhys(dt);
    reveal.step(dt);
  };

  const setTime = (time: number, energy = 0) => {
    glintTex.offset.x = (time * (0.11 + energy * 0.45)) % 1;
    const idle = 0.3 + 0.14 * Math.sin(time * 1.3);
    glintMat.opacity = fade * Math.min(1.1, idle + energy * 0.6) * tear.glint;
  };

  const dispose = () => {
    disposeGeo.forEach((g) => g.dispose());
    disposeMat.forEach((m) => m.dispose());
    disposeTex.forEach((t) => t.dispose());
    reveal.dispose();
  };

  setProgress(0);
  return { group, size: { W, H, T }, seamY, reveal, setProgress, setStretch, setTime, react, dispose };
}
