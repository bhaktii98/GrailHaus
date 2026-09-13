import * as THREE from 'three';
import { HERITAGE, specFor } from './watch-catalog.js';
import { buildWatch } from './watch-builder.js';

const stage = document.querySelector('three-d-stage');
await Promise.all([stage.ready, document.fonts.ready.catch(() => {})]);

/* ---------- procedural maps (kept in GLB; OBJ carries colors only) ---------- */

function grainTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#3a2118';
  x.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) {
    const y = Math.random() * 1024;
    const w = 0.4 + Math.random() * 1.6;
    const a = 0.02 + Math.random() * 0.07;
    x.strokeStyle = Math.random() > 0.45 ? `rgba(20,10,6,${a})` : `rgba(140,96,58,${a * 0.8})`;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(0, y);
    const amp = 6 + Math.random() * 22;
    for (let px = 0; px <= 1024; px += 32) {
      x.lineTo(px, y + Math.sin((px / 1024) * Math.PI * (1 + Math.random()) + i) * amp * 0.25);
    }
    x.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const cx = Math.random() * 1024, cy = Math.random() * 1024;
    const g = x.createRadialGradient(cx, cy, 2, cx, cy, 40 + Math.random() * 90);
    g.addColorStop(0, 'rgba(24,12,7,0.35)');
    g.addColorStop(1, 'rgba(24,12,7,0)');
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(cx, cy, 60, 22, Math.random(), 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.name = 'walnut-grain';
  return t;
}

function emblemTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#a87f3e';
  x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(48,32,12,0.85)';
  x.lineWidth = 5;
  x.beginPath(); x.arc(256, 256, 196, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 2;
  x.beginPath(); x.arc(256, 256, 178, 0, Math.PI * 2); x.stroke();
  x.fillStyle = 'rgba(30,18,6,0.95)';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '700 118px "IBM Plex Mono", monospace';
  x.save();
  x.translate(256, 214);
  x.letterSpacing = '18px';
  x.fillText('GH', 8, 0);
  x.restore();
  x.font = '500 42px "IBM Plex Mono", monospace';
  x.letterSpacing = '12px';
  x.fillText('GRAILHAUS', 262, 336);
  x.fillRect(140, 288, 232, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.name = 'emblem-engraving';
  return t;
}

function envMap(renderer) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#3a2f26');
  g.addColorStop(0.42, '#8d7355');
  g.addColorStop(0.52, '#1a1512');
  g.addColorStop(1, '#0a0807');
  x.fillStyle = g;
  x.fillRect(0, 0, 512, 256);
  // one warm softbox + a cooler rim, the only two things metal will reflect
  const box = x.createRadialGradient(150, 70, 4, 150, 70, 90);
  box.addColorStop(0, 'rgba(255,236,203,1)');
  box.addColorStop(1, 'rgba(255,236,203,0)');
  x.fillStyle = box; x.fillRect(0, 0, 512, 256);
  const rim = x.createRadialGradient(400, 110, 2, 400, 110, 60);
  rim.addColorStop(0, 'rgba(190,205,225,0.75)');
  rim.addColorStop(1, 'rgba(190,205,225,0)');
  x.fillStyle = rim; x.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}

/* ---------- materials ---------- */

const M = {
  walnut: new THREE.MeshPhysicalMaterial({
    name: 'walnut_lacquer', color: 0x4b2a1e, map: grainTexture(),
    roughness: 0.34, metalness: 0.04, clearcoat: 0.85, clearcoatRoughness: 0.12,
  }),
  brass: new THREE.MeshStandardMaterial({
    name: 'brushed_brass', color: 0xb9924f, roughness: 0.32, metalness: 1.0,
  }),
  brassDark: new THREE.MeshStandardMaterial({
    name: 'aged_brass', color: 0x8a6c39, roughness: 0.5, metalness: 0.95,
  }),
  velvet: new THREE.MeshPhysicalMaterial({
    name: 'burgundy_velvet', color: 0x33101a, roughness: 0.98, metalness: 0,
    sheen: 0.8, sheenRoughness: 0.75, sheenColor: new THREE.Color(0x50131f),
  }),
  velvetCream: new THREE.MeshPhysicalMaterial({
    name: 'cream_velvet', color: 0x3a1220, roughness: 0.98, metalness: 0,
    sheen: 0.75, sheenRoughness: 0.75, sheenColor: new THREE.Color(0x5a1927),
  }),
  leather: new THREE.MeshPhysicalMaterial({
    name: 'stitched_leather', color: 0x1f110c, roughness: 0.88, metalness: 0.02,
    sheen: 0.25, sheenColor: new THREE.Color(0x5a3a28), envMapIntensity: 0.4,
  }),
  thread: new THREE.MeshStandardMaterial({ name: 'thread', color: 0x9c8a6a, roughness: 0.9, envMapIntensity: 0.4 }),
  emblem: new THREE.MeshStandardMaterial({
    name: 'engraved_brass_plate', color: 0xffffff, map: emblemTexture(),
    roughness: 0.34, metalness: 0.95,
  }),
  steel: new THREE.MeshStandardMaterial({
    name: 'polished_steel', color: 0xd6dade, roughness: 0.14, metalness: 1.0,
  }),
  steelBrushed: new THREE.MeshStandardMaterial({
    name: 'brushed_steel', color: 0xc4cace, roughness: 0.3, metalness: 0.9,
  }),
  crystal: new THREE.MeshPhysicalMaterial({
    name: 'sapphire_crystal', color: 0xffffff, roughness: 0.02, metalness: 0,
    transparent: true, opacity: 0.12, transmission: 0.94, ior: 1.55, thickness: 0.002,
  }),
  dial: new THREE.MeshStandardMaterial({
    name: 'lacquer_dial', color: 0xcfc6b2, roughness: 0.36, metalness: 0.08,
  }),
  gold: new THREE.MeshStandardMaterial({
    name: 'yellow_gold', color: 0xc9a44c, roughness: 0.2, metalness: 1.0,
  }),
};

/* ---------- geometry helpers ---------- */

function roundedBox(w, h, d, r, bevel = 0.002) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  s.moveTo(x0 + r, z0);
  s.lineTo(x1 - r, z0); s.quadraticCurveTo(x1, z0, x1, z0 + r);
  s.lineTo(x1, z1 - r); s.quadraticCurveTo(x1, z1, x1 - r, z1);
  s.lineTo(x0 + r, z1); s.quadraticCurveTo(x0, z1, x0, z1 - r);
  s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - bevel * 2, bevelEnabled: true, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 3, curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  return g;
}

const mesh = (name, geo, mat) => {
  const m = new THREE.Mesh(geo, mat);
  m.name = name;
  return m;
};

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
  s.moveTo(x0 + r, z0);
  s.lineTo(x1 - r, z0); s.quadraticCurveTo(x1, z0, x1, z0 + r);
  s.lineTo(x1, z1 - r); s.quadraticCurveTo(x1, z1, x1 - r, z1);
  s.lineTo(x0 + r, z1); s.quadraticCurveTo(x0, z1, x0, z1 - r);
  s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  return s;
}

// a walled ring — outer rounded rect with a rounded rect cavity punched through
function ringBox(w, h, d, r, iw, id, ir, bevel = 0.0015) {
  const s = roundedRectShape(w, d, r);
  const hole = roundedRectShape(iw, id, ir);
  s.holes.push(new THREE.Path(hole.getPoints(24).reverse()));
  const g = new THREE.ExtrudeGeometry(s, {
    depth: h - bevel * 2, bevelEnabled: true, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 2, curveSegments: 10,
  });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  return g;
}

/* ---------- dimensions ---------- */

const W = 0.176, D = 0.132;          // footprint
const BODY_H = 0.056, LID_H = 0.034;
const WALL = 0.010, FLOOR = 0.012;
const INNER_W = W - WALL * 2, INNER_D = D - WALL * 2;

const root = new THREE.Group();
root.name = 'GrailHaus_HeritageCase';

/* ---------- body ---------- */

const body = new THREE.Group();
body.name = 'case_body';
root.add(body);

const shell = mesh('body_walls',
  ringBox(W, BODY_H, D, 0.008, INNER_W, INNER_D, 0.005), M.walnut);
body.add(shell);
const underside = mesh('body_base', new THREE.BoxGeometry(W - 0.007, 0.005, D - 0.007), M.walnut);
underside.position.y = 0.0026;
body.add(underside);
const innerFloor = mesh('body_inner_floor',
  new THREE.BoxGeometry(INNER_W + 0.002, 0.004, INNER_D + 0.002), M.walnut);
innerFloor.position.y = FLOOR - 0.002;
body.add(innerFloor);

// interior velvet lining: floor + four walls, inset a hair to avoid z-fighting
const linFloorY = FLOOR;
const lining = new THREE.Group();
lining.name = 'velvet_lining';
body.add(lining);
const linFloor = mesh('lining_floor', new THREE.BoxGeometry(INNER_W, 0.003, INNER_D), M.velvet);
linFloor.position.set(0, linFloorY + 0.0015, 0);
lining.add(linFloor);
const wallH = BODY_H - FLOOR - 0.001;
[-1, 1].forEach((sz, i) => {
  const w = mesh(`lining_wall_${i === 0 ? 'back' : 'front'}`,
    new THREE.BoxGeometry(INNER_W, wallH, 0.003), M.velvet);
  w.position.set(0, FLOOR + wallH / 2, sz * (INNER_D / 2 - 0.0015));
  lining.add(w);
});
[-1, 1].forEach((sx, i) => {
  const w = mesh(`lining_wall_${i === 0 ? 'left' : 'right'}`,
    new THREE.BoxGeometry(0.003, wallH, INNER_D), M.velvet);
  w.position.set(sx * (INNER_W / 2 - 0.0015), FLOOR + wallH / 2, 0);
  lining.add(w);
});

// brass inlay line around the body top edge
const inlay = mesh('brass_inlay',
  ringBox(W - 0.005, 0.0012, D - 0.005, 0.006, W - 0.011, D - 0.011, 0.005, 0.0003), M.brassDark);
inlay.position.y = BODY_H - 0.0004;
body.add(inlay);

// feet
[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
  const f = mesh(`foot_${i}`, new THREE.CylinderGeometry(0.006, 0.007, 0.004, 20), M.brassDark);
  f.position.set(sx * (W / 2 - 0.02), -0.002, sz * (D / 2 - 0.02));
  body.add(f);
});
root.position.y = 0.004; // rest on the feet

/* ---------- cushion ---------- */

const cushionY = linFloorY + 0.019;
const platform = new THREE.Group();
platform.name = 'WatchPlatform';
body.add(platform);
const cushion = new THREE.Group();
cushion.name = 'watch_cushion';
platform.add(cushion);
const pill = mesh('cushion_leather',
  new THREE.CapsuleGeometry(0.0212, 0.062, 16, 40), M.leather);
pill.rotation.z = Math.PI / 2;
pill.position.set(0, cushionY, 0);
cushion.add(pill);
// stitched seam along the top-side of the pillow
for (let i = 0; i < 26; i++) {
  const t = -0.042 + (i / 25) * 0.084;
  const st = mesh(`stitch_${i}`, new THREE.SphereGeometry(0.0005, 8, 6), M.thread);
  st.position.set(t, cushionY + 0.0158, 0.0143);
  cushion.add(st);
}

/* ---------- the watch (swappable, built from the catalog) ---------- */

const watchAnchor = new THREE.Group();
watchAnchor.name = 'WatchAnchor';
platform.add(watchAnchor);

const watchPivot = new THREE.Group();       // pivots on the cushion axis, so the band stays wrapped
watchPivot.name = 'WatchPivot';
watchAnchor.add(watchPivot);

let watch = null, caseY = 0, glint = null, spec = null;

function mountWatch(row) {
  if (watch) {
    watch.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((mt) => { if (mt.map) mt.map.dispose(); mt.dispose(); });
    });
    watchPivot.remove(watch);
  }
  spec = specFor(row);
  spec.loopR = 0.0212 + 0.0038;              // stand the band clear of the cushion
  watch = buildWatch(spec);
  caseY = cushionY + 0.0212 + watch.userData.caseHeight * 0.55;
  watchPivot.position.y = cushionY;
  watch.position.y = caseY - cushionY;
  // the band loop is concentric with the cushion — and with the pivot, so the tilt keeps it wrapped
  watch.getObjectByName('Bracelet').position.y = -(caseY - cushionY);
  glint = watch.userData.glint;
  watchPivot.add(watch);
  return watch;
}

/* ---------- lid ---------- */

const lid = new THREE.Group();          // pivot at the back hinge line
lid.name = 'lid';
lid.position.set(0, BODY_H, -D / 2 + 0.006);
root.add(lid);

const LID_TOP = 0.014, LID_RIM = LID_H - LID_TOP;
const lidRim = mesh('lid_rim',
  ringBox(W, LID_RIM, D, 0.008, INNER_W, INNER_D, 0.005), M.walnut);
lidRim.position.set(0, 0.0012, D / 2 - 0.006);
lid.add(lidRim);
const lidTop = mesh('lid_top', roundedBox(W, LID_TOP, D, 0.008), M.walnut);
lidTop.position.set(0, 0.0012 + LID_RIM - 0.0006, D / 2 - 0.006);
lid.add(lidTop);

const lidLining = mesh('lid_lining',
  new THREE.BoxGeometry(INNER_W - 0.001, 0.003, INNER_D - 0.001), M.velvetCream);
lidLining.position.set(0, 0.0012 + LID_RIM - 0.0022, D / 2 - 0.006);
lid.add(lidLining);
[-1, 1].forEach((sz, i) => {
  const w = mesh(`lid_lining_${i === 0 ? 'back' : 'front'}`,
    new THREE.BoxGeometry(INNER_W - 0.001, LID_RIM - 0.004, 0.0025), M.velvetCream);
  w.position.set(0, 0.0012 + (LID_RIM - 0.004) / 2, D / 2 - 0.006 + sz * (INNER_D / 2 - 0.0013));
  lid.add(w);
});
const lidInlay = mesh('lid_inlay',
  ringBox(W - 0.005, 0.0012, D - 0.005, 0.006, W - 0.011, D - 0.011, 0.005, 0.0003), M.brassDark);
lidInlay.position.set(0, 0.0006, D / 2 - 0.006);
lid.add(lidInlay);

// engraved emblem on the lid top
const emblem = new THREE.Group();
emblem.name = 'emblem';
emblem.position.set(0, LID_H + 0.0004, D / 2 - 0.006);
lid.add(emblem);
const emblemPlate = mesh('emblem_plate',
  new THREE.CylinderGeometry(0.019, 0.019, 0.0012, 64), M.emblem);
emblemPlate.rotation.y = Math.PI / 2;
emblem.add(emblemPlate);
const emblemRing = mesh('emblem_ring', new THREE.TorusGeometry(0.0188, 0.001, 10, 64), M.brassDark);
emblemRing.rotation.x = Math.PI / 2;
emblemRing.position.y = 0.0002;
emblem.add(emblemRing);

/* ---------- hinges + latch ---------- */

[-1, 1].forEach((s, i) => {
  const barrel = mesh(`hinge_barrel_${i}`, new THREE.CylinderGeometry(0.0034, 0.0034, 0.020, 24), M.brassDark);
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(s * 0.048, BODY_H - 0.0012, -D / 2 - 0.0026);
  root.add(barrel);
  [-1, 1].forEach((k, j) => {
    const knuckle = mesh(`hinge_knuckle_${i}${j}`, new THREE.CylinderGeometry(0.0042, 0.0042, 0.005, 24), M.brass);
    knuckle.rotation.z = Math.PI / 2;
    knuckle.position.set(s * 0.048 + k * 0.0122, BODY_H - 0.0012, -D / 2 - 0.0026);
    root.add(knuckle);
  });
});
const latchBase = mesh('latch_base', new THREE.BoxGeometry(0.026, 0.012, 0.0035), M.brass);
latchBase.position.set(0, BODY_H - 0.008, D / 2 + 0.0012);
body.add(latchBase);
const latchTongue = mesh('latch_tongue', new THREE.BoxGeometry(0.018, 0.011, 0.0035), M.brassDark);
latchTongue.position.set(0, 0.0072, D - 0.0102);
lid.add(latchTongue);

let selected = 0;
mountWatch(HERITAGE[selected]);

stage.setObject(root);

/* ---------- lighting: one warm key, deep negative space ---------- */

const scene = stage._scene;
const renderer = stage._renderer;
scene.environment = envMap(renderer);
scene.environmentIntensity = 0.68;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

scene.traverse((o) => {
  if (o.isHemisphereLight) o.intensity = 0.1;
  else if (o.isDirectionalLight) o.intensity = o === stage._key ? 0.28 : 0.08;
});
stage._ground.material.opacity = 0.42;

const spot = new THREE.SpotLight(0xffd9a0, 1.5, 0, 0.44, 0.9, 1.4);
spot.name = 'key_spot';
spot.position.set(0.06, 0.62, 0.22);
spot.target.position.set(0, 0.05, 0);
spot.castShadow = true;
spot.shadow.mapSize.set(2048, 2048);
spot.shadow.bias = -0.0005;
scene.add(spot, spot.target);

const interior = new THREE.PointLight(0xffc98a, 0, 0.6, 1.6);
interior.name = 'interior_glow';
interior.position.set(0, BODY_H + 0.03, 0.01);
scene.add(interior);

const watchKey = new THREE.SpotLight(0xfff0d6, 0, 0.5, 0.7, 0.75, 1.2);
watchKey.name = 'watch_key';
watchKey.position.set(0.05, 0.30, 0.14);
scene.add(watchKey, watchKey.target);

const rim = new THREE.DirectionalLight(0xbcd0e8, 0.22);
rim.position.set(-0.4, 0.25, -0.5);
scene.add(rim);

/* ---------- camera + controls ---------- */

const camera = stage._camera;
const controls = stage._controls;
camera.position.set(0.30, 0.20, 0.40);
controls.target.set(0, 0.055, 0);
controls.enabled = false;
controls.minDistance = 0.14;
controls.maxDistance = 0.85;
controls.maxPolarAngle = Math.PI * 0.52;
controls.update();

/* ---------- choreography ---------- */

const LID_MAX = 1.92;
const RISE = 0.055;
const el = {
  states: [...document.querySelectorAll('.state')],
  list: document.getElementById('collection'),
  ident: document.getElementById('ident'),
  moment: document.getElementById('moment'),
  hint: document.getElementById('hint'),
  actions: document.getElementById('actions'),
  reset: document.getElementById('reset'),
};

let phase = -1;           // 0 closed 1 opening 2 open 3 emergence 4 inspection
let lidAngle = 0, lidTarget = 0;
let rise = 0, riseTarget = 0;
let glintT = -1;
let dragging = false, lastY = 0, released = true;
let userTook = false;
let manual = false;
controls.addEventListener('start', () => { userTook = true; });

// the state list doubles as a scrubber — pose the case, then export that pose
const POSES = [
  { lid: 0, rise: 0 },
  { lid: LID_MAX * 0.45, rise: 0 },
  { lid: LID_MAX, rise: 0 },
  { lid: LID_MAX, rise: RISE * 0.55 },
  { lid: LID_MAX, rise: RISE },
];
el.states.forEach((s, i) => {
  s.addEventListener('click', () => {
    const p = POSES[i];
    manual = true;
    userTook = i === 4 ? userTook : false;
    lidTarget = p.lid;
    riseTarget = p.rise;
    if (i === 3) glintT = 0;
    controls.enabled = i === 4;
    setPhase(i);
  });
});

function setPhase(p) {
  if (p === phase) return;
  phase = p;
  el.states.forEach((s, i) => {
    s.classList.toggle('on', i === p);
    s.classList.toggle('done', i < p);
  });
  el.actions.classList.toggle('on', p >= 3);
  el.hint.classList.toggle('fade', p >= 2 && p < 4);
  if (p === 4) {
    el.hint.querySelector('em').textContent = 'Drag to rotate · scroll to zoom';
    el.hint.lastChild.textContent = 'Inspect the dial, crown and bracelet';
    el.hint.classList.remove('fade');
  }
  if (p === 0) {
    el.hint.querySelector('em').textContent = 'Drag upward to lift the lid';
    el.hint.lastChild.textContent = 'Slow and steady';
    el.hint.classList.remove('fade');
  }
}
setPhase(0);

stage.addEventListener('pointerdown', (e) => {
  if (phase >= 4) return;
  manual = false;
  dragging = true; released = false; lastY = e.clientY;
  stage.setPointerCapture?.(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!dragging || phase >= 3) return;
  const dy = lastY - e.clientY;
  lastY = e.clientY;
  // mechanical resistance: heavy off the seat, easier past the detent
  const resist = lidTarget < 0.14 ? 0.0022 : 0.0052;
  lidTarget = Math.min(LID_MAX, Math.max(0, lidTarget + dy * resist));
  if (lidTarget > 0.02 && phase === 0) setPhase(1);
});
function endDrag() {
  if (!dragging) return;
  dragging = false; released = true;
  if (phase < 3) lidTarget = lidTarget > LID_MAX * 0.42 ? LID_MAX : 0;
  if (lidTarget === 0 && phase === 1) setPhase(0);
}
stage.addEventListener('pointerup', endDrag);
stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('pointerleave', endDrag);

el.reset.addEventListener('click', () => {
  controls.enabled = false;
  userTook = false;
  manual = false;
  riseTarget = 0;
  setPhase(2);
  setTimeout(() => { lidTarget = 0; setPhase(0); }, 2600);
});

/* ---------- collection: any Heritage row drops into this same case ---------- */

HERITAGE.forEach((row, i) => {
  const b = document.createElement('button');
  b.className = 'row';
  b.innerHTML = '<span class="ref">' + row.ref.replace('GH-W-', '') + '</span>' +
    '<span class="nm">' + row.name + '</span>' +
    '<span class="ed">' + row.edition + '</span>';
  b.addEventListener('click', () => select(i));
  el.list.appendChild(b);
});

function paintIdent() {
  const row = HERITAGE[selected];
  [...el.list.children].forEach((c, i) => c.classList.toggle('on', i === selected));
  el.ident.innerHTML = '<em>' + row.name + ' · ' + row.edition + '</em>' +
    row.caseMaterial + ' · ' + row.dial + ' · ' + row.size + ' · ' + row.movement;
}

function select(i) {
  selected = i;
  mountWatch(HERITAGE[i]);
  paintIdent();
  if (phase >= 2) { glintT = 0; heritageT = -1; el.moment.classList.remove('on'); }
}
paintIdent();

let heritageT = -1;      // the Heritage moment: hairline, one word, nothing else
let openHeld = 0;
let last = performance.now() / 1000, elapsed = 0;
const clock = {
  getDelta() { const n = performance.now() / 1000, d = n - last; last = n; elapsed += d; return d; },
  get elapsedTime() { return elapsed; },
};

function step() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // lid: critically damped approach, no overshoot, slower near the stops
  const ease = dragging ? 6.5 : 2.1;
  lidAngle += (lidTarget - lidAngle) * Math.min(1, dt * ease);
  lid.rotation.x = -lidAngle;

  const openness = lidAngle / LID_MAX;

  if (!manual) {
    if (phase === 1 && released && lidTarget === LID_MAX && openness > 0.985) setPhase(2);
    if (phase === 2 && riseTarget === 0 && openness > 0.985) {
      openHeld += dt;
      if (openHeld > 0.9) { setPhase(3); riseTarget = RISE; glintT = 0; }
    } else if (phase !== 2) openHeld = 0;
  }

  // watch emergence: slow, weighted, no bounce
  rise += (riseTarget - rise) * Math.min(1, dt * 0.85);
  const lifted = rise / RISE;
  platform.position.y = rise;                 // cushion and watch rise together
  watchPivot.rotation.x = 0.30 * lifted;     // tilt the dial toward the lens
  watchPivot.rotation.y = 0.22 * lifted;     // ~13° hero turn

  if (phase === 3 && rise > RISE * 0.94 && heritageT < 0) heritageT = 0;
  if (heritageT >= 0) {
    heritageT += dt;
    const on = heritageT > 0.35 && heritageT < 3.1;
    el.moment.classList.toggle('on', on);
    if (heritageT > 3.5) heritageT = -1;
  }

  if (phase === 3 && rise > RISE * 0.94 && !manual && heritageT > 2.6) {
    setPhase(4);
    controls.enabled = true;
    controls.target.set(0, root.position.y + caseY + RISE, 0.0);
  }
  if (phase === 4 && riseTarget === 0 && rise < RISE * 0.06 && !manual) setPhase(2);

  // interior + key light bloom with the reveal
  const revealed = Math.max(0, openness - 0.12) / 0.88;
  interior.intensity = 0.012 * revealed + 0.02 * (rise / RISE);
  spot.intensity = 1.5 + 0.55 * revealed + 0.25 * lifted;
  spot.target.position.y = 0.05 + 0.06 * (rise / RISE);
  watchKey.intensity = 0.18 * revealed + 0.45 * lifted;
  watchKey.target.position.set(0, root.position.y + caseY + rise, 0);

  // a single glint crossing the crystal once the watch has risen
  if (glintT >= 0 && rise > RISE * 0.35) {
    glintT += dt / 2.4;
    const t = Math.min(1, glintT);
    glint.position.x = -0.026 + t * 0.052;
    glint.material.opacity = Math.sin(t * Math.PI) * 0.55;
    if (t >= 1) { glintT = -1; glint.material.opacity = 0; }
  }

  // gentle camera drift while the case is still closed
  if (phase === 0 && !dragging) {
    const a = clock.elapsedTime * 0.06;
    const p = new THREE.Vector3(Math.sin(a + 0.7) * 0.42, 0.20, Math.cos(a + 0.7) * 0.42);
    camera.position.lerp(p, Math.min(1, dt * 1.2));
    controls.target.lerp(new THREE.Vector3(0, 0.055, 0), Math.min(1, dt * 1.2));
    camera.lookAt(controls.target);
  }

  // ceremonial dolly in as the watch presents itself, until the user takes over
  if (phase >= 3 && !userTook) {
    const wy = root.position.y + caseY + rise;
    camera.position.lerp(new THREE.Vector3(0.115, wy + 0.055, 0.215), Math.min(1, dt * 0.5));
    controls.target.lerp(new THREE.Vector3(0, wy, 0), Math.min(1, dt * 0.9));
    camera.lookAt(controls.target);
  }
}

// the stage owns rendering; this loop only advances the choreography
function tick() { step(); requestAnimationFrame(tick); }
tick();

// state hooks (also what the export toolbar poses against)
window.heritageCase = {
  select,
  get watch() { return watch; },
  get spec() { return spec; },
  open() { lidTarget = LID_MAX; setPhase(1); },
  close() { riseTarget = 0; lidTarget = 0; setPhase(0); },
  get phase() { return phase; },
};
