// Ported from the Claude Design handoff's tenpack-art.js `buildTenPack` — geometry only (the
// texture layer lives in tenPackArt.ts). One zippered outer pouch, sealed; drag the slider and
// the mouth unzips: the foil parts along the seam, the lips fall away, and all ten booster packs
// — every one already torn open at the top — rise into view inside the open mouth. Deliberately
// spare, matching the source: no crystal field, no debris storm, just the pouch and the ten packs.
//
// Two things this port drops relative to the source, both explicit scope cuts, not oversights:
// the small "scrap" confetti planes (pure decoration), and the PMREM environment-reflection map
// (a real render-quality nicety, but meaningfully more setup for a beat on screen a few seconds).
// Everything that makes the mechanic *work* — the travelling clip-plane tear, the hinged lips, the
// zipper slider, the stow→home spill interpolation — is carried over unchanged.
import * as THREE from 'three';
import type { CategoryPersonality } from '../../reveal/config/types';
import { makeDataTexture } from '../../reveal/engine/textures';
import { buildPouchPanelTexture, buildTornPackFaceTexture, buildGroundTexture } from './tenPackArt';

const ZIP_X0 = -1.42;
const ZIP_X1 = 1.42;
const ZIP_Y = 1.18;
const FRONT_H = 1.24;
const BACK_H = 1.36;
// shut: both lips lean in and meet on the zip line. open: they settle apart.
const FRONT_SHUT = -0.48;
const FRONT_OPEN = 0.56;
const BACK_SHUT = 0.44;
const BACK_OPEN = -0.34;

const ease = (p: number) => 1 - Math.pow(1 - p, 2.2);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Gentle cloth sag plus an outward bulge, so panels read as soft material rather than flat card.
function slump(geo: THREE.BufferGeometry, amp: number, seed: number, bulge = 0) {
  const p = geo.attributes.position;
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const hw = (bb.max.x - bb.min.x) / 2 || 1;
  const hh = (bb.max.y - bb.min.y) / 2 || 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const n = Math.sin(x * 1.7 + seed) * 0.6 + Math.sin(y * 2.1 + seed * 1.6) * 0.4;
    const b = Math.cos(((x / hw) * Math.PI) / 2) * Math.cos(((y / hh) * Math.PI) / 2);
    p.setZ(i, p.getZ(i) + n * amp + Math.max(0, b) * bulge);
  }
  geo.computeVertexNormals();
  return geo;
}

// The booster-pack "pillow" shape: a box puffed out toward its center with a crimped edge.
function pillowGeo(w: number, h: number, t: number, seed: number) {
  const geo = new THREE.BoxGeometry(w, h, t, 22, 30, 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const fx = Math.cos((x / w) * Math.PI);
    const fy = Math.cos((y / h) * Math.PI);
    const crimp = Math.min(1, (1 - Math.abs(y) / (h / 2)) * 5);
    const puff = Math.max(0, fx) * Math.max(0, fy) * crimp;
    p.setZ(i, z * (1 + puff * 2.1) + Math.sin(x * 8 + y * 4 + seed) * t * 0.22);
  }
  geo.computeVertexNormals();
  return geo;
}

// All ten stay INSIDE the pouch — two staggered rows standing in the open mouth, torn tops facing
// up so every rip is visible from above. [x, z, yawDeg, tiltDeg]
const LAYOUT: Array<[number, number, number, number]> = [
  [-1.04, -0.32, -11, 74],
  [-0.52, -0.34, -5, 76],
  [0.0, -0.35, 0, 77],
  [0.52, -0.34, 5, 76],
  [1.04, -0.32, 11, 74],
  [-0.92, 0.18, -14, 64],
  [-0.46, 0.2, -7, 66],
  [0.0, 0.21, 0, 67],
  [0.46, 0.2, 7, 66],
  [0.92, 0.18, 14, 64],
];

interface PackUserData {
  pack: number;
  home: THREE.Vector3;
  homeRot: THREE.Euler;
  stow: THREE.Vector3;
  stowRot: THREE.Euler;
  delay: number;
}

export interface BuiltTenPack {
  group: THREE.Group;
  packs: THREE.Mesh[];
  slider: THREE.Group;
  zip: { x0: number; x1: number; y: number };
  setZip: (p: number) => void;
  setSpill: (s: number) => void;
  tick: (t: number) => void;
  dispose: () => void;
}

export function buildTenPack(personality: CategoryPersonality): BuiltTenPack {
  const { palette } = personality;
  const group = new THREE.Group();
  group.name = 'GrailHausTenPack';

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(x: T): T => {
    disposables.push(x);
    return x;
  };
  const texOf = (img: ReturnType<typeof buildGroundTexture>) => track(makeDataTexture(img));

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    track(
      new THREE.MeshStandardMaterial({
        map: texOf(buildGroundTexture(palette)),
        roughness: 0.66,
        metalness: 0.12,
        color: 0xa89ec2,
      })
    )
  );
  ground.name = 'Ground';
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  /* --- the travelling tear ------------------------------------------ */
  const aheadPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -ZIP_X0); // keeps x >= cut
  const behindPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), ZIP_X0); // keeps x <= cut

  const panelMat = (img: ReturnType<typeof buildGroundTexture>, clip: THREE.Plane | null) =>
    track(
      new THREE.MeshPhysicalMaterial({
        map: texOf(img),
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        roughness: 0.38,
        metalness: 0.28,
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
        clippingPlanes: clip ? [clip] : null,
      })
    );

  /* --- pouch -------------------------------------------------------- */
  const pouch = new THREE.Group();
  pouch.name = 'ZipPouch';

  const lip = (hinge: number, h: number, shut: number, seed: number, kind: 'front' | 'back') => {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.05, hinge);
    pivot.rotation.x = shut;
    const geo = track(slump(new THREE.PlaneGeometry(2.84, h, 40, 24), 0.05, seed, 0.1));
    const sealed = new THREE.Mesh(geo, panelMat(buildPouchPanelTexture(kind, false, palette), aheadPlane));
    sealed.position.y = h / 2;
    const geo2 = track(geo.clone());
    const torn = new THREE.Mesh(geo2, panelMat(buildPouchPanelTexture(kind, true, palette), behindPlane));
    torn.position.y = h / 2;
    pivot.add(sealed, torn);
    pouch.add(pivot);
    return pivot;
  };
  const frontPivot = lip(0.6, FRONT_H, FRONT_SHUT, 4.2, 'front');
  const backPivot = lip(-0.6, BACK_H, BACK_SHUT, 1.7, 'back');

  [-1, 1].forEach((s, i) => {
    const side = new THREE.Mesh(
      track(slump(new THREE.PlaneGeometry(1.26, 1, 20, 18), 0.05, 2.2 + i, 0.08)),
      panelMat(buildPouchPanelTexture('side', false, palette), null)
    );
    side.name = `PouchGusset${i + 1}`;
    side.position.set(s * 1.4, 0.53, 0);
    side.rotation.y = (s * Math.PI) / 2;
    pouch.add(side);
  });

  const bottom = new THREE.Mesh(new THREE.PlaneGeometry(2.84, 1.24), panelMat(buildPouchPanelTexture('bottom', false, palette), null));
  bottom.name = 'PouchBottom';
  bottom.position.set(0, 0.03, 0);
  bottom.rotation.x = -Math.PI / 2;
  pouch.add(bottom);

  /* --- zipper: a cord on each lip + a slider ------------------------ */
  const goldMat = track(
    new THREE.MeshPhysicalMaterial({ color: new THREE.Color(palette.gold), roughness: 0.28, metalness: 0.42, clearcoat: 0.6 })
  );
  const cord = (pivot: THREE.Group, h: number, flip: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 2.84, 14), goldMat);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, h - 0.01, flip * 0.03);
    pivot.add(m);
    const tape = new THREE.Mesh(
      new THREE.BoxGeometry(2.84, 0.075, 0.012),
      track(new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.ink), roughness: 0.7, metalness: 0.2 }))
    );
    tape.position.set(0, h - 0.07, flip * 0.03);
    pivot.add(tape);
  };
  cord(frontPivot, FRONT_H, 1);
  cord(backPivot, BACK_H, -1);

  const slider = new THREE.Group();
  slider.name = 'ZipSlider';
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.15), goldMat);
  slider.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.05), goldMat);
  neck.position.set(0, -0.1, 0.04);
  slider.add(neck);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 10, 20), goldMat);
  ring.position.set(0, -0.16, 0.055);
  ring.rotation.y = Math.PI / 2;
  slider.add(ring);
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.022), goldMat);
  tag.position.set(0, -0.3, 0.055);
  slider.add(tag);
  slider.position.set(ZIP_X0, ZIP_Y, 0.02);
  pouch.add(slider);

  group.add(pouch);

  /* --- ten packs, every one torn open ------------------------------- */
  const frontMaps = [0.7, 3.4, 6.1].map((s) => buildTornPackFaceTexture('front', s, personality));
  const backMaps = [1.9, 5.2].map((s) => buildTornPackFaceTexture('back', s, personality));
  const edgeMat = track(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(palette.violet), roughness: 0.44, metalness: 0.26 }));
  const openMat = track(new THREE.MeshBasicMaterial({ visible: false }));
  const cavityMat = track(
    new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.ink), roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  );
  // The single-pack rip reads as torn because the foil itself physically peels and separates —
  // a baked texture cut alone (however bold) never gave that on a small, distant pack; there was
  // no actual break in the mesh's own silhouette for the eye to catch. This is that same peeled
  // flap, standing in for what PackTearMesh's live deformation does on a real rip: a small loose
  // foil piece, tilted back and held slightly clear of the body, so every pack reads as
  // physically opened — not just "has a torn-looking picture on it" — even at a glance.
  const flapMat = track(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(palette.gold),
      roughness: 0.28,
      metalness: 0.55,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    })
  );

  const packs: THREE.Mesh[] = [];
  LAYOUT.forEach((L, i) => {
    const [x, z, yaw, tilt] = L;
    const faceMat = (img: ReturnType<typeof buildGroundTexture>) =>
      track(
        new THREE.MeshPhysicalMaterial({
          map: texOf(img),
          transparent: true,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
          roughness: 0.34,
          metalness: 0.28,
          clearcoat: 0.45,
          clearcoatRoughness: 0.3,
          emissive: new THREE.Color(palette.gold),
          emissiveIntensity: 0,
        })
      );
    const mesh = new THREE.Mesh(track(pillowGeo(0.54, 0.8, 0.05, i * 1.7 + 0.4)), [
      edgeMat,
      edgeMat,
      openMat,
      edgeMat,
      faceMat(frontMaps[i % 3]),
      faceMat(backMaps[i % 2]),
    ]);
    mesh.name = `BoosterPack${String(i + 1).padStart(2, '0')}`;

    const cavity = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), cavityMat);
    cavity.position.set(0, 0.26, 0);
    mesh.add(cavity);

    // The peeled-open foil flap — hinged from roughly where the top edge sits, tilted back and
    // held clear of the body so there's a real, visible gap between it and the pack underneath.
    const flap = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.24), flapMat);
    flap.position.set(0, 0.34, 0.045);
    flap.rotation.x = -1.15;
    flap.rotation.z = (((i % 2 === 0 ? 1 : -1) * 4) * Math.PI) / 180;
    mesh.add(flap);

    const rot = new THREE.Euler((-(90 - tilt) * Math.PI) / 180, (yaw * Math.PI) / 180, 0);
    mesh.position.set(x, 0.4, z);
    mesh.rotation.copy(rot);
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(mesh);
    // rest on the pouch floor, not the ground
    const restY = 0.4 + (0.05 - box.min.y);

    // they start settled lower and more upright, then rise into view as the mouth opens — no
    // spilling out, they never leave the pouch
    const stow = new THREE.Vector3(x, restY - 0.34, z - 0.06);
    const stowRot = new THREE.Euler(rot.x - 0.16, rot.y * 0.5, 0);

    const userData: PackUserData = {
      pack: i,
      home: new THREE.Vector3(x, restY, z),
      homeRot: rot,
      stow,
      stowRot,
      delay: i * 0.05,
    };
    mesh.userData = userData;
    mesh.position.copy(stow);
    mesh.rotation.copy(stowRot);
    packs.push(mesh);
    group.add(mesh);
  });

  /* --- lights --------------------------------------------------------- */
  // Intensities bumped up from the source's own numbers — this app's renderer setup doesn't
  // reproduce whatever exposure/tone-mapping three-d-stage.js's stock studio rig relied on, and
  // at the source's original values the scene read too dim/murky here to read clearly.
  const violet = new THREE.PointLight(0x9a5ff0, 16, 10, 2);
  violet.name = 'VioletKey';
  violet.position.set(-2.3, 2.5, 2);
  group.add(violet);
  const gold = new THREE.PointLight(0xffc97a, 11, 8.5, 2);
  gold.name = 'GoldFill';
  gold.position.set(2.2, 1.7, 2.1);
  group.add(gold);
  const rim = new THREE.PointLight(0xa878ff, 8, 9, 2);
  rim.name = 'RimGlow';
  rim.position.set(0, 1.6, -2.6);
  group.add(rim);
  const seamGlow = new THREE.PointLight(0xffdfa8, 0, 1.8, 2);
  seamGlow.name = 'SeamGlow';
  group.add(seamGlow);

  /* --- drivers --------------------------------------------------------- */
  function setZip(pIn: number) {
    const p = clamp01(pIn);
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
  }

  // s: 0 = settled low inside the sealed pouch, 1 = risen into the open mouth
  function setSpill(sIn: number) {
    const s = clamp01(sIn);
    packs.forEach((m) => {
      const d = m.userData as PackUserData;
      const k = ease(clamp01((s - d.delay) / (1 - d.delay || 1)));
      m.position.lerpVectors(d.stow, d.home, k);
      m.position.y += Math.sin(k * Math.PI) * 0.05;
      m.rotation.x = d.stowRot.x + (d.homeRot.x - d.stowRot.x) * k;
      m.rotation.y = d.stowRot.y + (d.homeRot.y - d.stowRot.y) * k;
      m.rotation.z = d.stowRot.z + (d.homeRot.z - d.stowRot.z) * k;
    });
  }

  function tick(t: number) {
    violet.intensity = 16 + Math.sin(t * 0.7) * 0.8;
  }

  setZip(0);
  setSpill(0);

  function dispose() {
    disposables.forEach((d) => d.dispose());
  }

  return {
    group,
    packs,
    slider,
    zip: { x0: ZIP_X0, x1: ZIP_X1, y: ZIP_Y },
    setZip,
    setSpill,
    tick,
    dispose,
  };
}
