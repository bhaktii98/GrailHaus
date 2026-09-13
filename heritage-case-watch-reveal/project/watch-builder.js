import * as THREE from 'three';

/* Builds a Heritage-tier watch from a spec (see watch-catalog.js specFor).
   Hierarchy is fixed so the Reserve case can swap any watch in:
   Watch > Case | Crystal | Dial | Hands | Crown | Bracelet | Caseback  */

const mesh = (name, geo, mat) => { const m = new THREE.Mesh(geo, mat); m.name = name; return m; };
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

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

function extrudeShape(shape, h, bevel = 0.0006) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0002, h - bevel * 2), bevelEnabled: bevel > 0, bevelSize: bevel,
    bevelThickness: bevel, bevelSegments: 2, curveSegments: 12,
  });
  g.rotateX(-Math.PI / 2);
  g.computeBoundingBox();
  g.translate(0, -(g.boundingBox.min.y + g.boundingBox.max.y) / 2, 0);
  return g;
}

function frameGeo(w, d, h, r, iw, id, ir) {
  const s = roundedRectShape(w, d, r);
  s.holes.push(new THREE.Path(roundedRectShape(iw, id, ir).getPoints(28).reverse()));
  return extrudeShape(s, h, 0.0004);
}

/* ---------- dial ---------- */

function dialTexture(spec) {
  const S = 1024, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const base = hex(spec.dialColor);
  x.fillStyle = base; x.fillRect(0, 0, S, S);

  if (spec.dialTexture === 'sunburst') {
    for (let i = 0; i < 240; i++) {
      const a = (i / 240) * Math.PI * 2;
      x.strokeStyle = i % 2 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.10)';
      x.lineWidth = 1.4;
      x.beginPath();
      x.moveTo(S / 2 + Math.cos(a) * S * 0.16, S / 2 + Math.sin(a) * S * 0.16);
      x.lineTo(S / 2 + Math.cos(a) * S, S / 2 + Math.sin(a) * S);
      x.stroke();
    }
    const vig = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S / 2);
    vig.addColorStop(0, 'rgba(255,255,255,0.02)');
    vig.addColorStop(0.72, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.3)');
    x.fillStyle = vig; x.fillRect(0, 0, S, S);
  } else if (spec.dialTexture === 'birch') {
    for (let i = 0; i < 150; i++) {
      const px = (i / 150) * S;
      x.strokeStyle = `rgba(120,132,140,${0.05 + Math.random() * 0.13})`;
      x.lineWidth = 1 + Math.random() * 4;
      x.beginPath(); x.moveTo(px, 0);
      for (let py = 0; py <= S; py += 48) x.lineTo(px + Math.sin(py / 90 + i) * 9, py);
      x.stroke();
    }
  } else {
    const g = x.createRadialGradient(S / 2, S / 2, 40, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.05)');
    g.addColorStop(1, 'rgba(0,0,0,0.22)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }

  const light = spec.dialColor > 0x999999;
  const ink = light ? 'rgba(26,28,32,' : 'rgba(236,238,240,';
  const cx = S / 2, cy = S / 2, R = S / 2;

  // chrono registers, drawn before the minute track so the track overlays cleanly
  if (spec.subdials) {
    [[0, 0.52], [-0.52, 0], [0.52, 0]].forEach(([ox, oy]) => {
      const sx = cx + ox * R * 0.62, sy = cy + oy * R * 0.62, sr = R * 0.215;
      x.fillStyle = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';
      x.beginPath(); x.arc(sx, sy, sr, 0, Math.PI * 2); x.fill();
      x.strokeStyle = ink + '0.4)'; x.lineWidth = 2;
      x.beginPath(); x.arc(sx, sy, sr, 0, Math.PI * 2); x.stroke();
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        x.strokeStyle = ink + (k % 3 ? '0.35)' : '0.75)');
        x.lineWidth = k % 3 ? 2 : 3.5;
        x.beginPath();
        x.moveTo(sx + Math.cos(a) * sr * 0.78, sy + Math.sin(a) * sr * 0.78);
        x.lineTo(sx + Math.cos(a) * sr * 0.94, sy + Math.sin(a) * sr * 0.94);
        x.stroke();
      }
    });
  }

  // minute track
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const long = i % 5 === 0;
    x.strokeStyle = ink + (long ? '0.85)' : '0.42)');
    x.lineWidth = long ? 5 : 2.4;
    const r0 = R * 0.855, r1 = R * (long ? 0.91 : 0.895);
    x.beginPath();
    x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    x.stroke();
  }

  if (spec.romanIndices) {
    x.fillStyle = ink + '0.92)';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '400 78px "Cormorant Garamond", Georgia, serif';
    ['XII', 'III', 'VI', 'IX'].forEach((n, i) => {
      const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
      x.fillText(n, cx + Math.cos(a) * R * 0.7, cy + Math.sin(a) * R * 0.7);
    });
  }

  if (spec.dateWindow) {
    const wx = cx + R * 0.66, wy = cy;
    x.fillStyle = light ? '#1c1e22' : '#eceef0';
    x.fillRect(wx - R * 0.085, wy - R * 0.062, R * 0.17, R * 0.124);
    x.fillStyle = light ? '#eceef0' : '#1c1e22';
    x.font = '500 52px "IBM Plex Mono", monospace';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('28', wx, wy + 2);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.center.set(0.5, 0.5);
  t.name = 'dial_' + spec.ref;
  return t;
}

function bezelInsertTexture(spec) {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = hex(spec.accent != null ? spec.accent : spec.dialColor);
  x.fillRect(0, 0, S, S);
  x.translate(S / 2, S / 2);
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
    const long = i % 5 === 0;
    x.strokeStyle = `rgba(238,238,232,${long ? 0.9 : 0.45})`;
    x.lineWidth = long ? 7 : 3;
    x.beginPath();
    x.moveTo(Math.cos(a) * S * 0.36, Math.sin(a) * S * 0.36);
    x.lineTo(Math.cos(a) * S * (long ? 0.46 : 0.44), Math.sin(a) * S * (long ? 0.46 : 0.44));
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.name = 'bezel_insert_' + spec.ref;
  return t;
}

/* ---------- build ---------- */

export function buildWatch(spec) {
  const m = spec.metal;
  const MAT = {
    brushed: new THREE.MeshStandardMaterial({ name: m.name + '_brushed', color: m.color, roughness: m.brushed, metalness: 1 }),
    polished: new THREE.MeshStandardMaterial({ name: m.name + '_polished', color: m.color, roughness: m.polish, metalness: 1 }),
    dial: new THREE.MeshStandardMaterial({ name: 'dial_lacquer', map: dialTexture(spec), color: 0xffffff, roughness: spec.dialTexture === 'matte' ? 0.78 : 0.66, metalness: 0, envMapIntensity: 0.35 }),
    crystal: new THREE.MeshPhysicalMaterial({ name: 'sapphire_crystal', color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08, ior: 1.52, reflectivity: 0.5, envMapIntensity: 0.55, depthWrite: false }),
    hand: new THREE.MeshStandardMaterial({ name: 'hand_metal', color: 0xe7e9ea, roughness: 0.18, metalness: 1, envMapIntensity: 0.8 }),
    lume: new THREE.MeshStandardMaterial({ name: 'lume', color: 0xd8d2b4, roughness: 0.75, emissive: 0x2a2a18, metalness: 0 }),
    index: new THREE.MeshStandardMaterial({ name: 'applied_index', color: 0xe3e6e8, roughness: 0.2, metalness: 1, envMapIntensity: 0.9 }),
    leather: new THREE.MeshPhysicalMaterial({ name: 'strap_leather', color: 0x38211a, roughness: 0.74, metalness: 0.02, sheen: 0.35, sheenColor: new THREE.Color(0x8a6045) }),
  };

  const watch = new THREE.Group();
  watch.name = 'Watch';
  const caseGrp = new THREE.Group(); caseGrp.name = 'Case';
  const dialGrp = new THREE.Group(); dialGrp.name = 'Dial';
  const handsGrp = new THREE.Group(); handsGrp.name = 'Hands';
  const crownGrp = new THREE.Group(); crownGrp.name = 'Crown';
  const braceletGrp = new THREE.Group(); braceletGrp.name = 'Bracelet';
  const casebackGrp = new THREE.Group(); casebackGrp.name = 'Caseback';
  const crystalGrp = new THREE.Group(); crystalGrp.name = 'Crystal';
  watch.add(caseGrp, dialGrp, handsGrp, crownGrp, braceletGrp, casebackGrp, crystalGrp);

  const R = spec.caseR;                     // case radius / half-width
  const rect = spec.archetype === 'rectangular';
  const squared = rect || spec.squareCase || spec.archetype === 'integrated';
  const H = R * (spec.archetype === 'dress' ? 0.40 : 0.48);   // mid-case height
  const W = rect ? R * 1.62 : R * 2;        // outer footprint
  const Dp = rect ? R * 2.16 : R * 2;

  /* case middle */
  if (squared) {
    caseGrp.add(mesh('case_mid', extrudeShape(roundedRectShape(W, Dp, R * (rect ? 0.16 : 0.3)), H, 0.0007), MAT.brushed));
  } else {
    caseGrp.add(mesh('case_mid', new THREE.CylinderGeometry(R, R * 0.955, H, 56), MAT.brushed));
    caseGrp.add(mesh('case_flank', new THREE.CylinderGeometry(R * 1.005, R * 1.005, H * 0.34, 56), MAT.polished));
  }

  /* bezel */
  const bezelY = H / 2;
  const dialY = bezelY + 0.0004;              // the dial sits on the case top
  if (spec.archetype === 'diver') {
    const bz = mesh('bezel', new THREE.CylinderGeometry(R * 1.0, R * 1.0, H * 0.2, 56, 1, true), MAT.polished);
    bz.position.y = bezelY + H * 0.1;
    caseGrp.add(bz);
    const insert = mesh('bezel_insert', new THREE.RingGeometry(R * 0.80, R * 0.985, 56, 1),
      new THREE.MeshStandardMaterial({ name: 'bezel_insert', map: bezelInsertTexture(spec), roughness: 0.28, metalness: 0.15 }));
    insert.rotation.x = -Math.PI / 2;
    insert.position.y = dialY + H * 0.19;
    caseGrp.add(insert);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const tooth = mesh(`bezel_grip_${i}`, new THREE.BoxGeometry(R * 0.02, H * 0.2, R * 0.03), MAT.polished);
      tooth.position.set(Math.sin(a) * R * 1.008, bezelY + H * 0.1, Math.cos(a) * R * 1.008);
      tooth.rotation.y = a;
      caseGrp.add(tooth);
    }
  } else if (spec.archetype === 'integrated') {
    const bz = mesh('bezel', frameGeo(W * 1.0, Dp * 1.0, H * 0.28, R * 0.3, R * 1.55, R * 1.55, R * 0.26), MAT.polished);
    bz.position.y = bezelY + H * 0.12;
    caseGrp.add(bz);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const s = mesh(`bezel_screw_${i}`, new THREE.CylinderGeometry(R * 0.055, R * 0.055, H * 0.32, 14), MAT.brushed);
      s.position.set(Math.sin(a) * R * 0.85, bezelY + H * 0.13, Math.cos(a) * R * 0.85);
      caseGrp.add(s);
    }
  } else if (rect || spec.squareCase) {
    const bz = mesh('bezel', frameGeo(W, Dp, H * 0.26, R * (rect ? 0.16 : 0.3), W - R * 0.42, Dp - R * 0.42, R * 0.12), MAT.polished);
    bz.position.y = bezelY + H * 0.11;
    caseGrp.add(bz);
    if (spec.godrons) {
      for (let i = -1; i <= 1; i++) {
        const g = mesh(`godron_${i + 1}`, new THREE.BoxGeometry(W * 0.86, H * 0.06, Dp * 0.022), MAT.polished);
        g.position.set(0, bezelY + H * 0.24, i * Dp * 0.055 - Dp * 0.40);
        caseGrp.add(g);
      }
    }
  } else {
    const bz = mesh('bezel', new THREE.TorusGeometry(R * 0.935, R * 0.06, 14, 64), MAT.polished);
    bz.rotation.x = Math.PI / 2;
    bz.position.y = dialY + H * 0.04;
    caseGrp.add(bz);
  }

  /* dial + applied indices */
  if (squared) {
    // a plane, not an extrusion: ExtrudeGeometry's UVs would scramble the printed dial
    const d = mesh('dial_plate', new THREE.PlaneGeometry(W - R * 0.5, Dp - R * 0.5), MAT.dial);
    d.rotation.x = -Math.PI / 2;
    d.position.y = dialY;
    dialGrp.add(d);
  } else {
    const dr = spec.archetype === 'diver' ? R * 0.81 : R * 0.9;
    const d = mesh('dial_plate', new THREE.CylinderGeometry(dr, dr, 0.0008, 64), MAT.dial);
    d.position.y = dialY;
    dialGrp.add(d);
  }
  if (!spec.romanIndices) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (spec.subdials && (i === 3 || i === 6 || i === 9)) continue;
      if (spec.dateWindow && i === 3) continue;
      const marker = spec.lume
        ? mesh(`index_lume_${i}`, new THREE.CylinderGeometry(R * 0.045, R * 0.045, 0.0008, 16), MAT.lume)
        : mesh(`index_${i}`, new THREE.BoxGeometry(i % 3 === 0 ? R * 0.06 : R * 0.038, 0.0008, R * 0.15), MAT.index);
      const ir = spec.archetype === 'diver' ? R * 0.64 : R * 0.70;
      marker.position.set(Math.sin(a) * ir, dialY + 0.0008, Math.cos(a) * ir);
      marker.rotation.y = a;
      dialGrp.add(marker);
    }
  }

  /* hands */
  const handY = dialY + 0.0018;
  const hour = mesh('hand_hour', new THREE.BoxGeometry(R * 0.07, 0.0004, R * 0.52), MAT.hand);
  hour.geometry.translate(0, 0, R * 0.19);
  hour.position.y = handY;
  hour.rotation.y = -0.95;
  const min = mesh('hand_minute', new THREE.BoxGeometry(R * 0.055, 0.0004, R * 0.76), MAT.hand);
  min.geometry.translate(0, 0, R * 0.31);
  min.position.y = handY + 0.0004;
  min.rotation.y = 1.86;
  handsGrp.add(hour, min);
  if (spec.subdials) {
    const sec = mesh('hand_chrono_seconds', new THREE.BoxGeometry(R * 0.022, 0.0003, R * 0.88),
      new THREE.MeshStandardMaterial({ name: 'hand_accent', color: spec.accent != null ? spec.accent : 0xd8dadb, roughness: 0.3, metalness: 0.6 }));
    sec.geometry.translate(0, 0, R * 0.30);
    sec.position.y = handY + 0.0008;
    sec.rotation.y = 0.42;
    handsGrp.add(sec);
  }
  const pin = mesh('hand_pinion', new THREE.CylinderGeometry(R * 0.05, R * 0.05, 0.0012, 16), MAT.polished);
  pin.position.y = handY + 0.0012;
  handsGrp.add(pin);

  /* crystal — box-domed on the round cases, flat on the squared ones */
  const cryY = dialY + H * (spec.archetype === 'diver' ? 0.24 : 0.2);
  if (squared) {
    const g = mesh('crystal', extrudeShape(roundedRectShape(W - R * 0.44, Dp - R * 0.44, R * 0.1), H * 0.12, 0), MAT.crystal);
    g.position.y = cryY;
    crystalGrp.add(g);
  } else {
    const g = mesh('crystal', new THREE.CylinderGeometry(R * 0.875, R * 0.875, H * 0.16, 64), MAT.crystal);
    g.position.y = cryY;
    crystalGrp.add(g);
    if (spec.archetype !== 'diver') {
      const dome = mesh('crystal_dome', new THREE.SphereGeometry(R * 0.875, 48, 12, 0, Math.PI * 2, 0, Math.PI * 0.19), MAT.crystal);
      dome.position.y = cryY + H * 0.08 - R * 0.83;
      crystalGrp.add(dome);
    }
  }
  const glint = mesh('crystal_glint', new THREE.PlaneGeometry(R * 0.24, R * 1.9),
    new THREE.MeshBasicMaterial({ name: 'glint', color: 0xfff4dd, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  glint.rotation.x = -Math.PI / 2;
  glint.rotation.z = -0.5;
  glint.position.y = cryY + H * 0.14;
  crystalGrp.add(glint);

  /* crown + pushers */
  const crownX = (squared ? W / 2 : R) + R * 0.07;
  const crown = mesh('crown', new THREE.CylinderGeometry(R * 0.15, R * 0.17, R * 0.2, 20), MAT.polished);
  crown.rotation.z = Math.PI / 2;
  crown.position.x = crownX;
  crownGrp.add(crown);
  if (spec.archetype === 'integrated' || rect) {
    const cab = mesh('crown_cabochon', new THREE.SphereGeometry(R * 0.075, 16, 12),
      new THREE.MeshStandardMaterial({ name: 'crown_stone', color: 0x1c2a4a, roughness: 0.18, metalness: 0.2 }));
    cab.position.x = crownX + R * 0.1;
    crownGrp.add(cab);
  }
  if (spec.subdials) {
    [-1, 1].forEach((s, i) => {
      const p = mesh(`pusher_${i}`, new THREE.CylinderGeometry(R * 0.085, R * 0.085, R * 0.17, 16), MAT.polished);
      p.rotation.z = Math.PI / 2;
      p.position.set(crownX - R * 0.02, 0, s * R * 0.46);
      crownGrp.add(p);
    });
  }

  /* lugs */
  const lugSpan = squared ? W * 0.30 : R * 0.58;
  const lugZ = squared ? Dp / 2 - R * 0.04 : R * 0.86;
  [-1, 1].forEach((sz, i) => [-1, 1].forEach((sx, j) => {
    const lug = mesh(`lug_${i}${j}`, new THREE.BoxGeometry(R * 0.12, H * 0.5, R * 0.26), MAT.brushed);
    lug.position.set(sx * lugSpan, -H * 0.12, sz * lugZ);
    lug.rotation.y = sz * sx * (squared ? 0 : 0.16);
    caseGrp.add(lug);
  }));

  /* caseback */
  if (squared) {
    const cb = mesh('caseback', extrudeShape(roundedRectShape(W - R * 0.16, Dp - R * 0.16, R * 0.14), H * 0.2, 0.0004), MAT.brushed);
    cb.position.y = -H / 2 - H * 0.08;
    casebackGrp.add(cb);
  } else {
    const cb = mesh('caseback', new THREE.CylinderGeometry(R * 0.9, R * 0.8, H * 0.24, 48), MAT.brushed);
    cb.position.y = -H / 2 - H * 0.09;
    casebackGrp.add(cb);
    const ring = mesh('caseback_ring', new THREE.TorusGeometry(R * 0.86, R * 0.03, 10, 48), MAT.polished);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -H / 2 - H * 0.04;
    casebackGrp.add(ring);
  }

  /* bracelet / strap — a closed loop that wraps the cushion and lifts with the watch */
  const LR = spec.loopR || R * 1.22;
  braceletGrp.position.y = -LR - H * 0.08;
  if (spec.strap === 'leather') {
    // one continuous sweep, gapped where the case sits — per-segment boxes scalloped
    const GAP_A = 62 * Math.PI / 180, GAP_B = 118 * Math.PI / 180;
    const tube = R * 0.03;
    const band = mesh('strap', new THREE.TorusGeometry(LR, tube, 8, 112, Math.PI * 2 - (GAP_B - GAP_A)), MAT.leather);
    band.geometry.rotateZ(GAP_B);
    band.geometry.rotateY(-Math.PI / 2);       // into the Y-Z plane, so X stays the band's width
    band.scale.x = (W * 0.55) / (tube * 2);
    braceletGrp.add(band);
    const keeper = mesh('strap_keeper', new THREE.BoxGeometry(W * 0.60, R * 0.05, R * 0.34), MAT.leather);
    keeper.position.y = -LR * 0.72;
    keeper.position.z = LR * 0.66;
    braceletGrp.add(keeper);
    const buckle = mesh('strap_buckle', new THREE.BoxGeometry(W * 0.64, R * 0.05, R * 0.5), MAT.polished);
    buckle.position.y = -LR - tube * 0.2;
    braceletGrp.add(buckle);
  } else {
    const seg = 46, integrated = spec.strap === 'integrated';
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const deg = ((a * 180) / Math.PI + 360) % 360;
      if (deg > 62 && deg < 118) continue;
      const taper = 1 - 0.18 * Math.abs(Math.sin(a));
      const row = new THREE.Group();
      row.position.set(0, Math.sin(a) * LR, Math.cos(a) * LR);
      row.rotation.x = -a;
      const linkD = (Math.PI * 2 * LR) / seg * 0.94;
      row.add(mesh(`link_center_${i}`, new THREE.BoxGeometry(R * (integrated ? 0.5 : 0.58) * taper, R * 0.055, linkD), MAT.polished));
      [-1, 1].forEach((s, j) => {
        const side = mesh(`link_side_${i}_${j}`, new THREE.BoxGeometry(R * (integrated ? 0.34 : 0.26) * taper, R * 0.05, linkD), MAT.brushed);
        side.position.x = s * R * (integrated ? 0.40 : 0.42) * taper;
        row.add(side);
      });
      braceletGrp.add(row);
    }
    const clasp = mesh('clasp', new THREE.BoxGeometry(R * 0.98, R * 0.06, R * 0.85), MAT.brushed);
    clasp.position.y = -LR - R * 0.015;
    braceletGrp.add(clasp);
  }

  watch.userData.glint = glint;
  watch.userData.caseHeight = H;
  watch.userData.bottom = braceletGrp.position.y - LR - R * 0.1;
  return watch;
}
