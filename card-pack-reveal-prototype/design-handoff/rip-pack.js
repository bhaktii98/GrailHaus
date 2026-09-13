// Grailhaus foil pack. Crimped snack-bag silhouette; the top rips off in one
// messy strip along the crimp, leaving a fibrous jagged edge, and the mouth
// gapes open so the cards can fan out. All meshes/materials are named for the
// OBJ + GLB export.
import * as THREE from 'three';
import { SEAM_FRAC, FLAP_FRAC, drawFront, drawBack, drawCardBack, drawShine } from './pack-art.js';

export const SIZE = { W: 0.068, H: 0.068 * (1200 / 800), T: 0.016 };

function tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Cheap multi-octave 1D noise — the tear edge needs detail at several scales
// or it reads as a machine-cut zigzag.
function noise(x) {
  let v = 0, amp = 1, f = 1;
  for (let o = 0; o < 5; o++) {
    v += amp * Math.sin(x * f * 137.13 + o * 2.7) * Math.cos(x * f * 61.7 + o * 1.3);
    amp *= 0.52; f *= 2.13;
  }
  return v * 0.5;
}

export function buildPack(logo) {
  const { W, H, T } = SIZE;
  const seamY = H / 2 - SEAM_FRAC * H;

  const pillowZ = (u, v) => {
    const t = (v - FLAP_FRAC) / (1 - 2 * FLAP_FRAC);
    if (t <= 0 || t >= 1) return 0;
    const uu = Math.min(1, Math.max(0, u));
    return (T / 2) * Math.pow(Math.sin(Math.PI * uu), 0.55) * Math.pow(Math.sin(Math.PI * t), 0.5);
  };

  const frontTex = tex(drawFront(logo));
  const backTex = tex(drawBack());
  const cardTex = tex(drawCardBack());
  const glintTex = tex(drawShine());
  glintTex.wrapS = THREE.RepeatWrapping;

  // Foil: fairly metallic, and flat-shaded so every crease catches its own
  // highlight instead of smoothing into plastic.
  const foil = (map, name) => new THREE.MeshStandardMaterial({
    name, map, roughness: 0.26, metalness: 0.45, flatShading: true,
    side: THREE.DoubleSide, transparent: false, alphaTest: 0.5, depthWrite: true,
  });
  const frontMat = foil(frontTex, 'foilFront');
  const backMat = foil(backTex, 'foilBack');

  // tear line: fibrous, with the odd deeper nick
  const tearY = (X) => {
    const n = noise(X * 55) * 0.0014;
    const fine = noise(X * 190) * 0.0005;
    const nick = Math.max(0, noise(X * 17 + 5.5)) ** 3 * 0.0026;
    return Math.max(0, n + fine + nick);
  };

  const sheet = (x0, x1, y0, y1, nx, ny, sign, mirror, edge) => {
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, nx, ny);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const pos = g.attributes.position, uv = g.attributes.uv;
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
    return { geometry: g, pos, rest: Float32Array.from(pos.array), center: [cx, cy] };
  };

  const group = new THREE.Group();
  group.name = 'grailhausPack';

  // ---- sealed body ------------------------------------------------------
  const body = new THREE.Group();
  body.name = 'packBody';
  const bodySheets = [];
  [[1, false, frontMat, 'bodyFrontSheet'], [-1, true, backMat, 'bodyBackSheet']].forEach(
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

  // ---- cards ------------------------------------------------------------
  const cards = new THREE.Group();
  cards.name = 'cards';
  const ch = H * 0.6, cw = ch * (620 / 868);
  const cardRestY = -H / 2 + FLAP_FRAC * H * 1.4 + ch / 2;
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(cw, ch),
      new THREE.MeshStandardMaterial({
        name: `cardBack${i}`, map: cardTex, roughness: 0.34, metalness: 0.25,
        emissive: 0x140a26, emissiveIntensity: 0.18,
      }),
    );
    m.name = `card${i}`;
    m.position.set(0, cardRestY, (i - 1) * 0.0013);
    cards.add(m);
  }
  group.add(cards);

  // ---- tear-away top strip (front + back halves) ------------------------
  const lidMat = frontMat.clone();
  lidMat.name = 'foilLidFront';
  const lidMatBack = backMat.clone();
  lidMatBack.name = 'foilLidBack';
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

  // Peel + crinkle: each column hinges at the crimp as the rip passes it, and
  // the sheet gathers into folds — foil buckles, it does not bend smoothly.
  const deformLid = (q) => {
    [lidS, lidSB].forEach((sh) => deformLidSheet(sh, q));
  };
  const deformLidSheet = (sheetData, q) => {
    const { pos, rest, center, geometry } = sheetData;
    const lead = q * (1 + PEEL);
    for (let i = 0; i < pos.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      const X = x + center[0];
      const u = (X + W / 2) / W;
      const t = Math.min(1, Math.max(0, (lead - u) / PEEL));
      // ease with a slow start: foil resists, then lets go
      const e = t * t * t * (t * (t * 6 - 15) + 10);
      // just ahead of the rip front the foil stretches and puckers
      const ahead = Math.max(0, 1 - Math.abs((lead - u) / (PEEL * 0.35)));
      const dy = y + center[1] - seamY;
      const along = Math.min(1, Math.max(0, dy / lidSpanY));

      // gather: columns pull toward the rip front, forming vertical folds
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
        (nz - e * 0.0015 + ahead * 0.0016 * (1 - along)) * k,
      );
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  };

  // The mouth: once the strip is off, the two walls spring apart into a V and
  // the torn edge loosens and buckles.
  const deformBody = (q) => {
    const open = Math.min(1, Math.max(0, (q - 0.22) / 0.78));
    bodySheets.forEach(({ pos, rest, center, sign, geometry }) => {
      for (let i = 0; i < pos.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const X = x + center[0], Y = y + center[1];
        const u = (X + W / 2) / W;
        const d = (seamY - Y) / (H * 0.3);                 // 0 at the mouth
        const gf = Math.pow(Math.max(0, 1 - d), 2.2) * open;
        const lip = Math.sin(Math.PI * Math.min(1, Math.max(0, u)));
        const buckle = noise(u * 14 + sign) * 0.0012 * gf;
        // Tug only exists while the rip is running, only near the rip front,
        // and only above the mouth — clamped so it can never invert the sheet.
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
  };

  // ---- glint travelling along the crimp (pull cue only) -----------------
  const seamV = (seamY + H / 2) / H;
  const glintGeo = new THREE.PlaneGeometry(W * 1.02, H * 0.022, 40, 1);
  {
    const gp = glintGeo.attributes.position;
    for (let i = 0; i < gp.count; i++) {
      const u = (gp.getX(i) + W * 0.51) / (W * 1.02);
      gp.setZ(i, pillowZ(Math.min(0.98, Math.max(0.02, u)), seamV) + 0.0013);
    }
  }
  const glintMat = new THREE.MeshBasicMaterial({
    name: 'crimpGlint', map: glintTex, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0,
  });
  const glint = new THREE.Mesh(glintGeo, glintMat);
  glint.name = 'crimpGlint';
  glint.position.y = seamY;
  group.add(glint);

  // ---- torn-off strip resting on the ground -----------------------------
  const scrapMat = frontMat.clone();
  scrapMat.side = THREE.DoubleSide;
  scrapMat.name = 'foilScrap';
  const scrapGeo = new THREE.PlaneGeometry(W, H / 2 - seamY, 60, 14);
  {
    const sp = scrapGeo.attributes.position, su = scrapGeo.attributes.uv;
    const hh = H / 2 - seamY;
    for (let i = 0; i < sp.count; i++) {
      const X = sp.getX(i), Y = sp.getY(i);
      const u = (X + W / 2) / W, v = (Y + hh / 2) / hh;
      // crumple: the strip does not lie flat once torn off
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
  const phys = { live: false, settled: false, p: new THREE.Vector3(), v: new THREE.Vector3(),
    r: new THREE.Euler(), w: new THREE.Vector3() };
  const groundLevel = -H / 2 + 0.0015;
  const release = (dirX) => {
    phys.live = true; phys.settled = false;
    phys.p.set(W * 0.3, seamY + (H / 2 - seamY) * 0.5, T * 2.4);
    phys.v.set(0.022 + dirX * 0.014, 0.024, 0.012);
    phys.r.set(-0.2, 0.1, -0.15);
    phys.w.set(1.8, 0.8, -2.2);
    scrap.visible = true;
  };
  const stepPhys = (dt) => {
    if (!phys.live || phys.settled) return;
    phys.v.y -= 0.55 * dt;                       // gravity
    phys.v.multiplyScalar(1 - 2.6 * dt);         // air drag: foil is light
    phys.v.x *= phys.p.x > W * 0.9 ? 0.82 : 1;   // keep it near the pack
    phys.p.addScaledVector(phys.v, dt);
    phys.r.x += phys.w.x * dt; phys.r.y += phys.w.y * dt; phys.r.z += phys.w.z * dt;
    phys.w.multiplyScalar(1 - 2.4 * dt);
    if (phys.p.y <= groundLevel) {
      phys.p.y = groundLevel;
      if (Math.abs(phys.v.y) < 0.012) {
        phys.settled = true;
        phys.v.set(0, 0, 0);
        phys.r.x = -Math.PI / 2 + 0.1; phys.r.z = -0.3;   // lies flat
      } else {
        phys.v.y = -phys.v.y * 0.24;             // foil barely bounces
        phys.v.x *= 0.5; phys.v.z *= 0.5;
        phys.w.multiplyScalar(0.4);
      }
    }
    scrap.position.copy(phys.p);
    scrap.rotation.copy(phys.r);
  };

  let fade = 1;
  const setProgress = (p) => {
    const q = Math.min(1, Math.max(0, p));
    const peel = Math.min(1, q / 0.8);
    deformLid(peel);
    deformBody(q);

    // strip comes free, tumbles down, and settles on the ground
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


    // cards rise, then fan
    const rise = Math.min(1, Math.max(0, (q - 0.45) / 0.55));
    const rq = rise * rise * (3 - 2 * rise);
    const fanQ = Math.min(1, Math.max(0, (q - 0.8) / 0.2));
    cards.children.forEach((c, i) => {
      const k = i - 1;
      c.position.set(
        k * fanQ * W * 0.16,
        cardRestY + rq * 0.042 - fanQ * Math.abs(k) * 0.004,
        (i - 1) * 0.0013,
      );
      c.rotation.set(0, 0, -k * fanQ * 0.13);
    });

    if (q > 0.97 && !phys.live) release(1);
    if (q < 0.02 && phys.live) { phys.live = false; scrap.visible = false; }

    fade = 1 - Math.min(1, q * 2.4);
  };

  // Pack reacts to the pull: leans against the tension, springs back when the
  // gesture is released.
  let lean = 0, leanV = 0;
  const react = (dt, pullX, pulling) => {
    const target = pulling ? pullX * 0.14 : 0;
    leanV += (target - lean) * 34 * dt;
    leanV *= 1 - 5.5 * dt;
    lean += leanV * dt;
    group.rotation.z = -lean * 0.5;
    group.rotation.y = lean * 0.7;
    body.position.x = lean * 0.004;
    stepPhys(dt);
  };

  const setTime = (time, energy = 0) => {
    glintTex.offset.x = (time * (0.11 + energy * 0.45)) % 1;
    const idle = 0.3 + 0.14 * Math.sin(time * 1.3);
    glintMat.opacity = fade * Math.min(1.1, idle + energy * 0.6);
  };

  setProgress(0);
  return { group, size: SIZE, seamY, setProgress, setTime, react };
}
