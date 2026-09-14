// GrailHaus "10-Pack Grail Hunt" scene — clean build.
//
// One zippered outer pouch, sealed. Drag the slider and the mouth unzips: the
// foil parts along a smooth torn edge, the lips fall away, and ten booster
// packs — every one of them ripped open at the top — spill out into two tidy
// rows in front of it.
//
// Kept deliberately spare: no crystal field, no debris storm, no glitter. A
// dark floor with one pool of light, the pouch, and the ten packs.

import { cv, T, metalFill, noise1 } from './art-util.js';
import { drawFront, drawBack } from './pack-art.js';

const ZIP_X0 = -1.42, ZIP_X1 = 1.42, ZIP_Y = 1.18;
const FRONT_H = 1.24, BACK_H = 1.36;
// shut: both lips lean in and meet on the zip line. open: they settle apart.
const FRONT_SHUT = -0.48, FRONT_OPEN = 0.56;
const BACK_SHUT = 0.44, BACK_OPEN = -0.34;

/* ------------------------------------------------------------------ *
 * canvas sources
 * ------------------------------------------------------------------ */

// A smooth, low-frequency torn edge. Earlier versions summed high-frequency
// noise, which drew a hard zigzag; foil tears in long soft curves.
function tearAt(x, w, seed) {
  const u = x / w;
  return 0.5
    + Math.sin(u * 5.2 + seed) * 0.3
    + Math.sin(u * 11.7 + seed * 2.3) * 0.14
    + Math.sin(u * 2.1 + seed * 0.7) * 0.1;
}

// Erase everything above the tear line, then lay a quiet lit lip under it.
function tearTop(ctx, w, h, seed, depth, lip = 3) {
  const at = (x) => depth * tearAt(x, w, seed);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= w; x += w / 160) ctx.lineTo(x, at(x));
  ctx.lineTo(w, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.lineWidth = lip;
  ctx.strokeStyle = 'rgba(255,238,200,0.45)';
  ctx.beginPath();
  for (let x = 0; x <= w; x += w / 160) {
    const y = at(x) + lip * 0.8;
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// Quiet obsidian: a soft gradient with a few faint gold veins. No glints.
function obsidian(ctx, w, h, o = {}) {
  const { veins = 7, alpha = 0.17 } = o;
  const g = ctx.createLinearGradient(0, 0, w * 0.4, h);
  g.addColorStop(0, '#120b22');
  g.addColorStop(0.45, '#1c1134');
  g.addColorStop(1, '#0a0614');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < veins; i++) {
    const y0 = ((i + 0.5) / veins) * h;
    ctx.beginPath();
    ctx.moveTo(-20, y0);
    for (let x = 0; x <= w + 20; x += 40) {
      ctx.lineTo(x, y0 + noise1(x / w * 2 + i * 5.1) * h * 0.05);
    }
    ctx.strokeStyle = `rgba(216,169,63,${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
}

function crownG(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(-80, -100); ctx.lineTo(-54, -144); ctx.lineTo(-26, -108);
  ctx.lineTo(0, -158); ctx.lineTo(26, -108); ctx.lineTo(54, -144);
  ctx.lineTo(80, -100); ctx.closePath();
  ctx.fillStyle = metalFill(ctx, -158, -96); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 86, 0, 7);
  ctx.strokeStyle = metalFill(ctx, -86, 86); ctx.lineWidth = 9; ctx.stroke();
  T(ctx, 'G', 0, 44, { size: 140, weight: 700, fill: metalFill(ctx, -56, 48) });
  ctx.restore();
}

// kind: back | front | side | bottom
function pouchPanel(kind, torn) {
  const w = 1024, h = kind === 'side' ? 512 : kind === 'bottom' ? 460 : 620;
  const c = cv(w, h), ctx = c.getContext('2d');
  obsidian(ctx, w, h);

  const hem = ctx.createLinearGradient(0, h - 22, 0, h);
  hem.addColorStop(0, 'rgba(216,169,63,0)');
  hem.addColorStop(1, 'rgba(216,169,63,0.55)');
  ctx.fillStyle = hem; ctx.fillRect(0, h - 22, w, 22);

  if (kind === 'back') {
    crownG(ctx, w / 2, h * 0.44, 0.86);
    T(ctx, 'GRAILHAUS', w / 2, h * 0.76, {
      size: 84, weight: 700, ls: 9, fill: metalFill(ctx, h * 0.69, h * 0.78),
    });
    T(ctx, 'MORE THAN COLLECTIBLES', w / 2, h * 0.86, {
      size: 21, weight: 700, ls: 12, family: 'ui-monospace, Menlo, monospace',
      fill: 'rgba(216,169,63,0.6)',
    });
  } else if (kind === 'front') {
    T(ctx, 'GRAILHAUS', w / 2, h * 0.56, {
      size: 70, weight: 700, ls: 8, fill: metalFill(ctx, h * 0.49, h * 0.58),
    });
    T(ctx, 'TEN PACK \u00b7 SERIES I', w / 2, h * 0.68, {
      size: 22, weight: 700, ls: 11, family: 'ui-monospace, Menlo, monospace',
      fill: 'rgba(216,169,63,0.5)',
    });
  }

  if (torn) tearTop(ctx, w, h, kind === 'front' ? 4.2 : 1.7, 92, 4);
  return c;
}

// A pack ripped open along its top: the crimp is gone and the wrapper gapes.
function tornPackTex(src, seed) {
  const w = src.width, h = src.height;
  const c = cv(w, h), ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  tearTop(ctx, w, h, seed, h * 0.2, 5);
  // shadow falling into the open wrapper
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const sh = ctx.createLinearGradient(0, h * 0.12, 0, h * 0.3);
  sh.addColorStop(0, 'rgba(4,2,10,0.8)');
  sh.addColorStop(1, 'rgba(4,2,10,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, h * 0.12, w, h * 0.18);
  ctx.restore();
  return c;
}

// Floor: near-black, with one soft pool of light where the pouch sits.
function groundTex() {
  const w = 1024, h = 1024;
  const c = cv(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#07050d'; ctx.fillRect(0, 0, w, h);
  const pool = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h * 0.46, w * 0.46);
  pool.addColorStop(0, 'rgba(86,54,142,0.5)');
  pool.addColorStop(0.45, 'rgba(48,28,84,0.26)');
  pool.addColorStop(1, 'rgba(7,5,13,0)');
  ctx.fillStyle = pool; ctx.fillRect(0, 0, w, h);
  const warm = ctx.createRadialGradient(w * 0.62, h * 0.6, 0, w * 0.62, h * 0.6, w * 0.3);
  warm.addColorStop(0, 'rgba(168,122,54,0.18)');
  warm.addColorStop(1, 'rgba(7,5,13,0)');
  ctx.fillStyle = warm; ctx.fillRect(0, 0, w, h);
  return c;
}

function scrapTex(seed) {
  const w = 256, h = 256;
  const c = cv(w, h), ctx = c.getContext('2d');
  obsidian(ctx, w, h, { veins: 2, alpha: 0.3 });
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = w * 0.44 * (0.78 + Math.sin(a * 3 + seed) * 0.2);
    const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
  return c;
}

/* ------------------------------------------------------------------ *
 * geometry helpers
 * ------------------------------------------------------------------ */

function tx(THREE, canvas, o = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}

// Gentle cloth sag plus an outward bulge, so panels read as soft material.
function slump(geo, amp, seed, bulge = 0) {
  const p = geo.attributes.position;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const hw = (bb.max.x - bb.min.x) / 2 || 1, hh = (bb.max.y - bb.min.y) / 2 || 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const n = Math.sin(x * 1.7 + seed) * 0.6 + Math.sin(y * 2.1 + seed * 1.6) * 0.4;
    const b = Math.cos((x / hw) * Math.PI / 2) * Math.cos((y / hh) * Math.PI / 2);
    p.setZ(i, p.getZ(i) + n * amp + Math.max(0, b) * bulge);
  }
  geo.computeVertexNormals();
  return geo;
}

function pillowGeo(THREE, w, h, t, seed) {
  const geo = new THREE.BoxGeometry(w, h, t, 22, 30, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const fx = Math.cos((x / w) * Math.PI), fy = Math.cos((y / h) * Math.PI);
    const crimp = Math.min(1, (1 - Math.abs(y) / (h / 2)) * 5);
    const puff = Math.max(0, fx) * Math.max(0, fy) * crimp;
    p.setZ(i, z * (1 + puff * 2.1) + Math.sin(x * 8 + y * 4 + seed) * t * 0.22);
  }
  geo.computeVertexNormals();
  return geo;
}

const ease = (p) => 1 - Math.pow(1 - p, 2.2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* ------------------------------------------------------------------ *
 * scene
 * ------------------------------------------------------------------ */

// All ten stay INSIDE the pouch — two staggered rows standing in the open
// mouth, torn tops facing up so every rip is visible from above.
// [x, z, yawDeg, tiltDeg]
const LAYOUT = [
  [-1.04, -0.32, -11, 74],
  [-0.52, -0.34,  -5, 76],
  [ 0.00, -0.35,   0, 77],
  [ 0.52, -0.34,   5, 76],
  [ 1.04, -0.32,  11, 74],
  [-0.92,  0.18, -14, 64],
  [-0.46,  0.20,  -7, 66],
  [ 0.00,  0.21,   0, 67],
  [ 0.46,  0.20,   7, 66],
  [ 0.92,  0.18,  14, 64],
];

export function buildTenPack(THREE, logo) {
  const group = new THREE.Group();
  group.name = 'GrailHausTenPack';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    new THREE.MeshStandardMaterial({
      map: tx(THREE, groundTex()), roughness: 0.66, metalness: 0.12, color: 0xa89ec2,
    }),
  );
  ground.name = 'Ground';
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  /* --- the travelling tear ------------------------------------------ */
  const aheadPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -ZIP_X0);   // keeps x >= cut
  const behindPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), ZIP_X0);  // keeps x <= cut

  const panelMat = (canvas, clip) => new THREE.MeshPhysicalMaterial({
    map: tx(THREE, canvas),
    transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
    roughness: 0.38, metalness: 0.28, clearcoat: 0.35, clearcoatRoughness: 0.4,
    clippingPlanes: clip ? [clip] : null,
  });

  /* --- pouch -------------------------------------------------------- */
  const pouch = new THREE.Group();
  pouch.name = 'ZipPouch';

  const lip = (name, hinge, h, shut, seed, kind) => {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.set(0, 0.05, hinge);
    pivot.rotation.x = shut;
    const geo = slump(new THREE.PlaneGeometry(2.84, h, 40, 24), 0.05, seed, 0.1);
    const sealed = new THREE.Mesh(geo, panelMat(pouchPanel(kind, false), aheadPlane));
    sealed.name = name + 'Sealed';
    sealed.position.y = h / 2;
    const torn = new THREE.Mesh(geo.clone(), panelMat(pouchPanel(kind, true), behindPlane));
    torn.name = name + 'Torn';
    torn.position.y = h / 2;
    pivot.add(sealed, torn);
    pouch.add(pivot);
    return pivot;
  };
  const frontPivot = lip('FrontLip', 0.6, FRONT_H, FRONT_SHUT, 4.2, 'front');
  const backPivot = lip('BackLip', -0.6, BACK_H, BACK_SHUT, 1.7, 'back');

  [-1, 1].forEach((s, i) => {
    const side = new THREE.Mesh(
      slump(new THREE.PlaneGeometry(1.26, 1, 20, 18), 0.05, 2.2 + i, 0.08),
      panelMat(pouchPanel('side', false), null),
    );
    side.name = 'PouchGusset' + (i + 1);
    side.position.set(s * 1.4, 0.53, 0);
    side.rotation.y = s * Math.PI / 2;
    pouch.add(side);
  });

  const bottom = new THREE.Mesh(
    new THREE.PlaneGeometry(2.84, 1.24),
    panelMat(pouchPanel('bottom', false), null),
  );
  bottom.name = 'PouchBottom';
  bottom.position.set(0, 0.03, 0);
  bottom.rotation.x = -Math.PI / 2;
  pouch.add(bottom);

  /* --- zipper: a gold cord on each lip + a neat slider -------------- */
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6c078, roughness: 0.28, metalness: 0.42, clearcoat: 0.6,
  });
  const cord = (name, pivot, h, flip) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.84, 14), goldMat);
    m.name = name;
    m.rotation.z = Math.PI / 2;
    m.position.set(0, h - 0.01, flip * 0.03);
    pivot.add(m);
    // the tape the teeth sit on
    const tape = new THREE.Mesh(new THREE.BoxGeometry(2.84, 0.075, 0.012), new THREE.MeshStandardMaterial({
      color: 0x1b1030, roughness: 0.7, metalness: 0.2,
    }));
    tape.name = name + 'Tape';
    tape.position.set(0, h - 0.07, flip * 0.03);
    pivot.add(tape);
  };
  cord('ZipCordFront', frontPivot, FRONT_H, 1);
  cord('ZipCordBack', backPivot, BACK_H, -1);

  const slider = new THREE.Group();
  slider.name = 'ZipSlider';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.15), goldMat);
  body.name = 'SliderBody';
  slider.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), goldMat);
  neck.name = 'SliderNeck';
  neck.position.set(0, -0.1, 0.04);
  slider.add(neck);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 10, 20), goldMat);
  ring.name = 'SliderRing';
  ring.position.set(0, -0.16, 0.055);
  ring.rotation.y = Math.PI / 2;
  slider.add(ring);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.022), goldMat);
  tag.name = 'SliderTag';
  tag.position.set(0, -0.3, 0.055);
  slider.add(tag);
  slider.position.set(ZIP_X0, ZIP_Y, 0.02);
  pouch.add(slider);

  pouch.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  group.add(pouch);

  /* --- ten packs, every one torn open ------------------------------- */
  const frontSrc = drawFront(logo), backSrc = drawBack();
  const frontMaps = [0.7, 3.4, 6.1].map((s) => tx(THREE, tornPackTex(frontSrc, s)));
  const backMaps = [1.9, 5.2].map((s) => tx(THREE, tornPackTex(backSrc, s)));
  const edgeMat = new THREE.MeshPhysicalMaterial({
    color: 0x241340, roughness: 0.44, metalness: 0.26,
  });
  const openMat = new THREE.MeshBasicMaterial({ visible: false });
  const cavityMat = new THREE.MeshStandardMaterial({
    color: 0x090512, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  });

  const packs = [];
  LAYOUT.forEach((L, i) => {
    const [x, z, yaw, tilt] = L;
    const faceMat = (map) => new THREE.MeshPhysicalMaterial({
      map, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
      roughness: 0.34, metalness: 0.28, clearcoat: 0.45, clearcoatRoughness: 0.3,
      emissive: 0xd8a93f, emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(
      pillowGeo(THREE, 0.54, 0.8, 0.05, i * 1.7 + 0.4),
      [edgeMat, edgeMat, openMat, edgeMat,
        faceMat(frontMaps[i % 3]), faceMat(backMaps[i % 2])],
    );
    mesh.name = 'BoosterPack' + String(i + 1).padStart(2, '0');
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const cavity = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), cavityMat);
    cavity.name = 'PackCavity' + (i + 1);
    cavity.position.set(0, 0.26, 0);
    mesh.add(cavity);

    const rot = new THREE.Euler(-(90 - tilt) * Math.PI / 180, yaw * Math.PI / 180, 0);
    mesh.position.set(x, 0.4, z);
    mesh.rotation.copy(rot);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // rest on the pouch floor, not the ground
    const restY = 0.4 + (0.05 - box.min.y);

    // they start settled lower and more upright, then rise into view as the
    // mouth opens — no spilling out, they never leave the pouch
    const stow = new THREE.Vector3(x, restY - 0.34, z - 0.06);
    const stowRot = new THREE.Euler(rot.x - 0.16, rot.y * 0.5, 0);

    mesh.userData = {
      pack: i,
      home: new THREE.Vector3(x, restY, z),
      homeRot: rot,
      stow, stowRot,
      delay: i * 0.05,
    };
    mesh.position.copy(stow);
    mesh.rotation.copy(stowRot);
    packs.push(mesh);
    group.add(mesh);
  });

  /* --- a handful of scraps, close in ------------------------------- */
  const scraps = [];
  for (let i = 0; i < 7; i++) {
    const s = 0.1 + (i % 4) * 0.025;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(s, s * 0.8),
      new THREE.MeshPhysicalMaterial({
        map: tx(THREE, scrapTex(i)),
        transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
        roughness: 0.4, metalness: 0.3,
      }),
    );
    m.name = 'Scrap' + (i + 1);
    const x = -1.75 + i * 0.58;
    m.position.set(x, 0.008, 1.85 + (i % 3) * 0.16);
    m.rotation.set(-Math.PI / 2, 0, i * 1.3);
    m.castShadow = true;
    m.scale.setScalar(0.001);
    m.userData.at = clamp01((x - ZIP_X0) / (ZIP_X1 - ZIP_X0)) * 0.8;
    scraps.push(m);
    group.add(m);
  }

  /* --- lights ------------------------------------------------------- */
  const violet = new THREE.PointLight(0x9a5ff0, 11, 10, 2);
  violet.name = 'VioletKey';
  violet.position.set(-2.3, 2.5, 2);
  group.add(violet);
  const gold = new THREE.PointLight(0xffc97a, 7, 8.5, 2);
  gold.name = 'GoldFill';
  gold.position.set(2.2, 1.7, 2.1);
  group.add(gold);
  const rim = new THREE.PointLight(0xa878ff, 5, 9, 2);
  rim.name = 'RimGlow';
  rim.position.set(0, 1.6, -2.6);
  group.add(rim);
  const seamGlow = new THREE.PointLight(0xffdfa8, 0, 1.8, 2);
  seamGlow.name = 'SeamGlow';
  group.add(seamGlow);

  /* --- drivers ------------------------------------------------------ */
  function setZip(p) {
    p = clamp01(p);
    const cut = ZIP_X0 + (ZIP_X1 - ZIP_X0) * p;
    aheadPlane.constant = -cut;
    behindPlane.constant = cut;

    const e = ease(p);
    frontPivot.rotation.x = FRONT_SHUT + (FRONT_OPEN - FRONT_SHUT) * e;
    backPivot.rotation.x = BACK_SHUT + (BACK_OPEN - BACK_SHUT) * e;

    slider.position.set(cut, ZIP_Y - e * 0.2, 0.02 + e * 0.1);
    slider.rotation.z = -e * 0.18;
    slider.visible = p < 0.995;

    seamGlow.position.set(cut, ZIP_Y - e * 0.15, 0.05);
    seamGlow.intensity = p > 0.002 && p < 0.999 ? 1.3 : 0;

    scraps.forEach((m) => {
      const k = clamp01((p - m.userData.at) / 0.16);
      m.scale.setScalar(0.001 + k * 0.999);
    });
    return p;
  }

  // s: 0 = settled low inside the sealed pouch, 1 = risen into the open mouth
  function setSpill(s) {
    s = clamp01(s);
    packs.forEach((m) => {
      const d = m.userData;
      const k = ease(clamp01((s - d.delay) / (1 - d.delay || 1)));
      m.position.lerpVectors(d.stow, d.home, k);
      m.position.y += Math.sin(k * Math.PI) * 0.05;
      m.rotation.x = d.stowRot.x + (d.homeRot.x - d.stowRot.x) * k;
      m.rotation.y = d.stowRot.y + (d.homeRot.y - d.stowRot.y) * k;
      m.rotation.z = d.stowRot.z + (d.homeRot.z - d.stowRot.z) * k;
    });
    return s;
  }

  function tick(t) {
    violet.intensity = 11 + Math.sin(t * 0.7) * 0.8;
  }

  setZip(0);
  setSpill(0);

  return {
    group, packs, pouch, slider,
    zip: { x0: ZIP_X0, x1: ZIP_X1, y: ZIP_Y },
    setZip, setSpill, tick,
  };
}
