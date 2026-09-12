import * as THREE from 'three';

const stage = document.querySelector('three-d-stage');
await stage.ready;

const scene = stage._scene;
const camera = stage._camera;
const controls = stage._controls;

/* ---------- materials (curated, shared) ---------- */
const mat = (name, o) => Object.assign(new THREE.MeshStandardMaterial(o), { name });

const lacquer   = mat('piano_black_lacquer', { color: 0x0b0c0e, roughness: 0.10, metalness: 0.42 });
const forged    = mat('forged_carbon',       { color: 0x15181d, roughness: 0.46, metalness: 0.55 });
const titanium  = mat('brushed_titanium',    { color: 0x9ea2a8, roughness: 0.36, metalness: 0.95 });
const gunmetal  = mat('polished_gunmetal',   { color: 0x565c64, roughness: 0.22, metalness: 0.95 });
const alcantara = mat('charcoal_alcantara',  { color: 0x1a1c20, roughness: 0.97, metalness: 0.0 });
const steel     = mat('polished_steel',      { color: 0xd9dde2, roughness: 0.07, metalness: 1.0 });
const dialMat   = mat('dial_slate',          { color: 0x05070a, roughness: 0.82, metalness: 0.06 });
const appliedMat = mat('applied_index',      { color: 0xc6cad0, roughness: 0.24, metalness: 0.9, emissive: 0x8e959e, emissiveIntensity: 0.16 });
const sapphire  = mat('sapphire_crystal',    { color: 0x0b1015, roughness: 0.06, metalness: 0.10, transparent: true, opacity: 0.035 });
const goldAcc   = mat('champagne_gold',      { color: 0xc9a96b, roughness: 0.16, metalness: 1.0 });
const emblemMat = mat('emblem_light',        { color: 0x14171b, roughness: 0.3, metalness: 0.6, emissive: 0xe6d9bd, emissiveIntensity: 0.0 });
const seamMat   = mat('seam_light',          { color: 0x05060a, roughness: 0.9, metalness: 0.0, emissive: 0xcfe0f2, emissiveIntensity: 0.0 });
const stripMat  = mat('interior_light',      { color: 0x0a0c10, roughness: 0.9, metalness: 0.0, emissive: 0xf0e9dc, emissiveIntensity: 0.0 });

let uid = 0;
function put(parent, geo, material, name, pos, rot) {
  const m = new THREE.Mesh(geo, material);
  m.name = name || 'part_' + (uid++);
  if (pos) m.position.set(pos[0], pos[1], pos[2]);
  if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
  parent.add(m);
  return m;
}
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cyl = (r1, r2, h, s = 48, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open);

/* ---------- dimensions (meters) ---------- */
const W = 0.260, D = 0.200;      // exterior footprint
const WALL = 0.017;
const BODY_H = 0.070, PLINTH_H = 0.010;
const SEAM_Y = PLINTH_H + BODY_H;  // 0.080
const LID_H = 0.052;

const model = new THREE.Group();
model.name = 'grailhaus_vault';

/* ---------- vault body ---------- */
const body = new THREE.Group();
body.name = 'vault_body';
model.add(body);

put(body, box(W - 0.010, PLINTH_H, D - 0.010), gunmetal, 'machined_plinth', [0, PLINTH_H / 2, 0]);
put(body, box(W - 0.030, 0.004, D - 0.030), forged, 'plinth_recess', [0, PLINTH_H + 0.0005, 0]);

// hollow shell: four walls + floor
const wy = PLINTH_H + BODY_H / 2;
put(body, box(W, BODY_H, WALL), lacquer, 'shell_wall_front', [0, wy, D / 2 - WALL / 2]);
put(body, box(W, BODY_H, WALL), lacquer, 'shell_wall_back', [0, wy, -D / 2 + WALL / 2]);
put(body, box(WALL, BODY_H, D - WALL * 2), lacquer, 'shell_wall_right', [W / 2 - WALL / 2, wy, 0]);
put(body, box(WALL, BODY_H, D - WALL * 2), lacquer, 'shell_wall_left', [-W / 2 + WALL / 2, wy, 0]);
put(body, box(W - WALL * 2, 0.010, D - WALL * 2), lacquer, 'shell_floor', [0, PLINTH_H + 0.005, 0]);

// forged composite inlays, recessed into the outer faces
put(body, box(W - 0.072, BODY_H - 0.024, 0.0022), forged, 'inlay_front', [0, wy, D / 2 + 0.0002]);
put(body, box(W - 0.072, BODY_H - 0.024, 0.0022), forged, 'inlay_back', [0, wy, -D / 2 - 0.0002]);
put(body, box(0.0022, BODY_H - 0.024, D - 0.072), forged, 'inlay_right', [W / 2 + 0.0002, wy, 0]);
put(body, box(0.0022, BODY_H - 0.024, D - 0.072), forged, 'inlay_left', [-W / 2 - 0.0002, wy, 0]);

// titanium rim frame at the seam
const rimY = SEAM_Y - 0.0035;
put(body, box(W + 0.0015, 0.007, 0.012), titanium, 'rim_front', [0, rimY, D / 2 - 0.006]);
put(body, box(W + 0.0015, 0.007, 0.012), titanium, 'rim_back', [0, rimY, -D / 2 + 0.006]);
put(body, box(0.012, 0.007, D - 0.024), titanium, 'rim_right', [W / 2 - 0.006, rimY, 0]);
put(body, box(0.012, 0.007, D - 0.024), titanium, 'rim_left', [-W / 2 + 0.006, rimY, 0]);

// seam light — thin emissive frame just under the lid
const sy = SEAM_Y + 0.0008;
put(body, box(W - 0.004, 0.0016, 0.003), seamMat, 'seam_light_front', [0, sy, D / 2 - 0.004]);
put(body, box(W - 0.004, 0.0016, 0.003), seamMat, 'seam_light_back', [0, sy, -D / 2 + 0.004]);
put(body, box(0.003, 0.0016, D - 0.012), seamMat, 'seam_light_right', [W / 2 - 0.004, sy, 0]);
put(body, box(0.003, 0.0016, D - 0.012), seamMat, 'seam_light_left', [-W / 2 + 0.004, sy, 0]);

// alcantara interior lining
put(body, box(W - 0.046, 0.004, D - 0.046), alcantara, 'interior_floor_pad', [0, PLINTH_H + 0.012, 0]);
put(body, box(W - 0.046, 0.044, 0.003), alcantara, 'liner_front', [0, PLINTH_H + 0.036, D / 2 - WALL - 0.002]);
put(body, box(W - 0.046, 0.044, 0.003), alcantara, 'liner_back', [0, PLINTH_H + 0.036, -D / 2 + WALL + 0.002]);
put(body, box(0.003, 0.044, D - 0.052), alcantara, 'liner_right', [W / 2 - WALL - 0.002, PLINTH_H + 0.036, 0]);
put(body, box(0.003, 0.044, D - 0.052), alcantara, 'liner_left', [-W / 2 + WALL + 0.002, PLINTH_H + 0.036, 0]);

// machined interior architecture: two buttresses either side of the platform well
[-1, 1].forEach((s, i) => {
  put(body, box(0.030, 0.030, D - 0.060), gunmetal, 'interior_buttress_' + (i ? 'r' : 'l'),
    [s * 0.086, PLINTH_H + 0.029, 0]);
  put(body, box(0.022, 0.0025, D - 0.076), forged, 'buttress_cap_' + (i ? 'r' : 'l'),
    [s * 0.086, PLINTH_H + 0.0445, 0]);
  // interior illumination strips, aimed inward
  put(body, box(0.0025, 0.006, D - 0.090), stripMat, 'interior_strip_' + (i ? 'r' : 'l'),
    [s * 0.0705, PLINTH_H + 0.040, 0]);
});

/* ---------- lock bolts (four, machined, in the seam) ---------- */
const boltGroups = [];
const boltPins = [];
[[1, 0.058], [1, -0.058], [-1, 0.058], [-1, -0.058]].forEach(([sx, z], i) => {
  const g = new THREE.Group();
  g.name = 'lock_bolt_' + i;
  g.position.set(sx * (W / 2 - 0.004), SEAM_Y - 0.0035, z);
  g.rotation.z = sx > 0 ? -Math.PI / 2 : Math.PI / 2;
  const pin = new THREE.Mesh(cyl(0.0042, 0.0042, 0.012, 24), titanium);
  pin.name = 'lock_pin_' + i;
  pin.position.y = 0.0045;
  g.add(pin);
  const key = new THREE.Mesh(box(0.0095, 0.0022, 0.0022), gunmetal);
  key.name = 'lock_key_' + i;
  key.position.y = 0.0035;
  pin.add(key);
  put(g, cyl(0.0062, 0.0062, 0.0025, 24), gunmetal, 'lock_flange_' + i, [0, 0.0005, 0]);
  body.add(g);
  boltGroups.push(g);
  boltPins.push(pin);
});

/* ---------- lid (pivots at the rear edge) ---------- */
const lid = new THREE.Group();
lid.name = 'lid_assembly';
lid.position.set(0, SEAM_Y, -D / 2);
model.add(lid);
const lz = D / 2;   // local z of lid centre

put(lid, box(W, LID_H, D), lacquer, 'lid_shell', [0, LID_H / 2, lz]);
put(lid, box(W - 0.026, 0.0035, D - 0.026), forged, 'lid_top_panel', [0, LID_H + 0.0005, lz]);
put(lid, box(W - 0.062, 0.0018, D - 0.062), forged, 'lid_top_recess', [0, LID_H + 0.0026, lz]);
// titanium chamfer frame on the lid crown
put(lid, box(W - 0.006, 0.0035, 0.013), titanium, 'lid_chamfer_front', [0, LID_H - 0.0008, lz + D / 2 - 0.0075]);
put(lid, box(W - 0.006, 0.0035, 0.013), titanium, 'lid_chamfer_back', [0, LID_H - 0.0008, lz - D / 2 + 0.0075]);
put(lid, box(0.013, 0.0035, D - 0.032), titanium, 'lid_chamfer_right', [W / 2 - 0.0075, LID_H - 0.0008, lz]);
put(lid, box(0.013, 0.0035, D - 0.032), titanium, 'lid_chamfer_left', [-W / 2 + 0.0075, LID_H - 0.0008, lz]);
// lid skirt + bolt sockets
put(lid, box(W - 0.036, 0.005, D - 0.036), alcantara, 'lid_liner', [0, 0.0064, lz]);
boltGroups.forEach((g, i) => {
  put(lid, cyl(0.0068, 0.0068, 0.006, 20), gunmetal, 'lock_socket_' + i,
    [g.position.x, 0.004, lz + g.position.z, ], [0, 0, g.position.x > 0 ? -Math.PI / 2 : Math.PI / 2]);
});
// illuminated emblem
const emblem = new THREE.Group();
emblem.name = 'grailhaus_emblem';
emblem.position.set(0, LID_H + 0.0036, lz);
lid.add(emblem);
put(emblem, new THREE.TorusGeometry(0.0195, 0.0011, 12, 64), emblemMat, 'emblem_ring', [0, 0, 0], [Math.PI / 2, 0, 0]);
put(emblem, new THREE.TorusGeometry(0.0128, 0.0007, 10, 48), emblemMat, 'emblem_ring_inner', [0, 0, 0], [Math.PI / 2, 0, 0]);
put(emblem, box(0.0085, 0.0012, 0.0085), emblemMat, 'emblem_keystone', [0, 0, 0], [0, Math.PI / 4, 0]);
put(emblem, box(0.0016, 0.0012, 0.026), titanium, 'emblem_axis', [0, -0.0002, 0]);

/* ---------- elevating platform ---------- */
const platform = new THREE.Group();
platform.name = 'watch_platform';
platform.position.set(0, 0.018, 0);
model.add(platform);
put(platform, cyl(0.056, 0.060, 0.013, 64), gunmetal, 'platform_disc', [0, 0, 0]);
put(platform, new THREE.TorusGeometry(0.0575, 0.0016, 12, 72), titanium, 'platform_ring', [0, 0.0068, 0], [Math.PI / 2, 0, 0]);
put(platform, cyl(0.0525, 0.0525, 0.0035, 64), alcantara, 'platform_pad', [0, 0.0080, 0]);
put(platform, cyl(0.0125, 0.0142, 0.042, 48), alcantara, 'presentation_post', [0, 0.0308, 0]);
put(platform, cyl(0.0148, 0.0148, 0.0022, 48), titanium, 'post_collar', [0, 0.0518, 0]);
// telescoping column beneath, revealed as it rises
put(platform, cyl(0.024, 0.024, 0.070, 32), gunmetal, 'lift_column_outer', [0, -0.042, 0]);
put(platform, cyl(0.014, 0.014, 0.090, 24), titanium, 'lift_column_inner', [0, -0.060, 0]);

/* ---------- archetype materials ---------- */
const dlc         = mat('blackened_dlc',        { color: 0x1b1e22, roughness: 0.34, metalness: 0.92 });
const roseGold    = mat('rose_gold',            { color: 0xc2825f, roughness: 0.13, metalness: 1.0 });
const platinum    = mat('polished_platinum',    { color: 0xdfe2e6, roughness: 0.09, metalness: 1.0 });
const satinTi     = mat('satin_titanium',       { color: 0x8d9299, roughness: 0.48, metalness: 0.92 });
const rubberMat   = mat('vulcanised_rubber',    { color: 0x101215, roughness: 0.90, metalness: 0.0 });
const leatherMat  = mat('cordovan_leather',     { color: 0x241512, roughness: 0.74, metalness: 0.02 });
const lumeMat     = mat('lume_teal',            { color: 0xbfe8dc, roughness: 0.42, metalness: 0.0, emissive: 0x35c6a6, emissiveIntensity: 0.55 });
const dialSilver  = mat('dial_silver_grain',    { color: 0xb9bec6, roughness: 0.44, metalness: 0.40 });
const dialBlue    = mat('dial_midnight_blue',   { color: 0x0d1a30, roughness: 0.46, metalness: 0.34 });
const dialSkel    = mat('dial_openwork',        { color: 0x1c2025, roughness: 0.40, metalness: 0.72 });
const insertMat   = mat('bezel_insert_matte',   { color: 0x0a0c0f, roughness: 0.66, metalness: 0.14, side: THREE.DoubleSide });
const ringMat     = mat('chapter_ring',         { color: 0x9fa5ad, roughness: 0.34, metalness: 0.86, side: THREE.DoubleSide });
const goldRingMat = mat('champagne_gold_ring',  { color: 0xc9a96b, roughness: 0.16, metalness: 1.0, side: THREE.DoubleSide });
const dialRingMat = mat('dial_slate_ring',      { color: 0x05070a, roughness: 0.82, metalness: 0.06, side: THREE.DoubleSide });

/* ---------- the watch: five Icon-tier archetypes ---------- */
const watch = new THREE.Group();
watch.name = 'watch_icon';
model.add(watch);

const v2 = (x, y) => new THREE.Vector2(x, y);
const ring = (ri, ro, s = 72) => new THREE.RingGeometry(ri, ro, s);
const FLAT = [-Math.PI / 2, 0, 0];

const ARCHETYPES = [
  {
    id: 'monolith', numeral: 'I', name: 'Monolith', ref: 'GH·V07', edition: '04 / 12',
    line: 'Integrated steel · fluted gunmetal bezel', swatch: '#c9a96b',
    caseMat: steel, linkMat: gunmetal, bezelMat: gunmetal, accentMat: goldAcc, dialMat,
    bezel: 'fluted', markers: 'applied', hands: 'baton', crown: 'guarded', strap: 'bracelet',
    caseR: 0.0205, bandH: 0.0086, strapW: 0.0182, exhibition: true,
  },
  {
    id: 'abyss', numeral: 'II', name: 'Abyss', ref: 'GH·V11', edition: '02 / 08',
    line: 'Blackened DLC · 300m dive bezel · lume', swatch: '#35c6a6',
    caseMat: dlc, linkMat: gunmetal, bezelMat: dlc, accentMat: lumeMat, dialMat,
    bezel: 'dive', markers: 'lume', hands: 'sword', crown: 'oversize', strap: 'rubber',
    caseR: 0.0222, bandH: 0.0104, strapW: 0.0196, exhibition: false,
  },
  {
    id: 'aurum', numeral: 'III', name: 'Aurum', ref: 'GH·V02', edition: '01 / 05',
    line: 'Rose gold dress · grained silver dial', swatch: '#c2825f',
    caseMat: roseGold, linkMat: roseGold, bezelMat: roseGold, accentMat: roseGold, dialMat: dialSilver,
    bezel: 'thin', markers: 'baton_slim', hands: 'leaf', crown: 'slim', strap: 'leather',
    caseR: 0.0188, bandH: 0.0062, strapW: 0.0166, exhibition: true,
  },
  {
    id: 'cathedral', numeral: 'IV', name: 'Cathedral', ref: 'GH·V19', edition: '01 / 03',
    line: 'Platinum openwork · flying tourbillon', swatch: '#dfe2e6',
    caseMat: platinum, linkMat: platinum, bezelMat: platinum, accentMat: goldAcc, dialMat: dialSkel,
    bezel: 'sapphire_ring', markers: 'skeleton', hands: 'skeleton', crown: 'slim', strap: 'leather',
    caseR: 0.0200, bandH: 0.0094, strapW: 0.0172, exhibition: true, openDial: true,
  },
  {
    id: 'meridian', numeral: 'V', name: 'Meridian', ref: 'GH·V14', edition: '06 / 20',
    line: 'Satin titanium chronograph · tachymètre', swatch: '#0d1a30',
    caseMat: satinTi, linkMat: titanium, bezelMat: gunmetal, accentMat: appliedMat, dialMat: dialBlue,
    bezel: 'tachy', markers: 'chrono', hands: 'chrono', crown: 'pushers', strap: 'bracelet',
    caseR: 0.0215, bandH: 0.0098, strapW: 0.0188, exhibition: true,
  },
];

let spec = ARCHETYPES[0];
let hands, glint;

function buildBezel(top, R) {
  const { bezelMat: bm, accentMat: ac } = spec;
  if (spec.bezel === 'fluted') {
    put(watch, new THREE.LatheGeometry([
      v2(R - 0.0029, top - 0.0003), v2(R - 0.0029, top + 0.0031), v2(R - 0.0009, top + 0.0033),
      v2(R + 0.0011, top + 0.0015), v2(R + 0.0011, top - 0.0005), v2(R - 0.0029, top - 0.0003),
    ], 72), bm, 'bezel');
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      put(watch, box(0.0008, 0.0024, 0.0012), titanium, 'bezel_flute_' + i,
        [Math.sin(a) * (R + 0.0004), top + 0.0016, Math.cos(a) * (R + 0.0004)], [0, a, 0]);
    }
  } else if (spec.bezel === 'dive') {
    put(watch, cyl(R + 0.0010, R + 0.0010, 0.0038, 72, true), bm, 'dive_bezel_ring', [0, top + 0.0019, 0]);
    put(watch, ring(R - 0.0032, R + 0.0010), insertMat, 'dive_bezel_insert', [0, top + 0.0038, 0], FLAT);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      put(watch, box(0.0013, 0.0040, 0.0020), bm, 'bezel_grip_' + i,
        [Math.sin(a) * (R + 0.0014), top + 0.0019, Math.cos(a) * (R + 0.0014)], [0, a, 0]);
    }
    for (let i = 1; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      put(watch, box(0.0011, 0.0006, 0.0030), ac, 'bezel_minute_' + i,
        [Math.sin(a) * (R - 0.0012), top + 0.0040, Math.cos(a) * (R - 0.0012)], [0, a, 0]);
    }
    put(watch, cyl(0.0026, 0.0026, 0.0012, 24), ac, 'bezel_lume_pip', [0, top + 0.0042, R - 0.0012]);
    put(watch, new THREE.TorusGeometry(0.0026, 0.0004, 8, 24), bm, 'pip_surround', [0, top + 0.0042, R - 0.0012], FLAT);
  } else if (spec.bezel === 'thin') {
    put(watch, new THREE.LatheGeometry([
      v2(R - 0.0022, top + 0.0000), v2(R - 0.0022, top + 0.0016), v2(R - 0.0004, top + 0.0020),
      v2(R + 0.0008, top + 0.0010), v2(R + 0.0008, top - 0.0004), v2(R - 0.0022, top + 0.0000),
    ], 72), bm, 'bezel');
  } else if (spec.bezel === 'sapphire_ring') {
    put(watch, new THREE.LatheGeometry([
      v2(R - 0.0026, top + 0.0002), v2(R - 0.0026, top + 0.0026), v2(R + 0.0006, top + 0.0026),
      v2(R + 0.0010, top + 0.0008), v2(R + 0.0010, top - 0.0004), v2(R - 0.0026, top + 0.0002),
    ], 72), bm, 'bezel');
    put(watch, new THREE.TorusGeometry(R - 0.0018, 0.0006, 10, 64), spec.accentMat, 'bezel_gold_fillet', [0, top + 0.0028, 0], FLAT);
  } else { // tachy
    put(watch, cyl(R + 0.0008, R + 0.0008, 0.0026, 72, true), bm, 'tachy_bezel_ring', [0, top + 0.0013, 0]);
    put(watch, ring(R - 0.0034, R + 0.0008), insertMat, 'tachymetre_insert', [0, top + 0.0026, 0], FLAT);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      put(watch, box(i % 2 ? 0.0008 : 0.0011, 0.0005, i % 2 ? 0.0020 : 0.0032), i % 6 === 0 ? goldAcc : ringMat,
        'tachy_tick_' + i, [Math.sin(a) * (R - 0.0016), top + 0.0028, Math.cos(a) * (R - 0.0016)], [0, a, 0]);
    }
  }
}

function buildDial(top, R) {
  const dm = spec.dialMat, ac = spec.accentMat, dR = R - 0.0029;
  if (spec.openDial) {
    put(watch, ring(dR - 0.0086, dR), dialRingMat, 'dial_chapter_plate', [0, top + 0.0005, 0], FLAT);
    put(watch, ring(dR - 0.0098, dR - 0.0090), goldRingMat, 'dial_inner_fillet', [0, top + 0.0005, 0], FLAT);
    // open-worked movement, read from the dial side
    put(watch, box(0.0026, 0.0011, dR * 1.62), dm, 'openwork_bridge_main', [0, top - 0.0006, 0], [0, 0.42, 0]);
    put(watch, box(0.0022, 0.0011, dR * 1.30), dm, 'openwork_bridge_cross', [0, top - 0.0008, 0], [0, -1.16, 0]);
    [[0.0062, 0.0042, 0.0058], [-0.0058, 0.0034, -0.0046], [0.0006, 0.0030, -0.0078]].forEach((g, i) => {
      put(watch, cyl(g[1], g[1], 0.0009, 28), goldAcc, 'openwork_gear_' + i, [g[0], top - 0.0009, g[2]]);
      put(watch, new THREE.TorusGeometry(g[1] * 0.44, 0.0004, 8, 20), dm, 'gear_hub_' + i, [g[0], top - 0.0004, g[2]], FLAT);
    });
    put(watch, new THREE.TorusGeometry(0.0052, 0.0009, 10, 40), platinum, 'tourbillon_cage', [-0.0004, top - 0.0002, -0.0062], FLAT);
    put(watch, box(0.0010, 0.0008, 0.0100), platinum, 'tourbillon_bridge', [-0.0004, top + 0.0003, -0.0062], [0, 0.8, 0]);
  } else {
    put(watch, cyl(dR, dR, 0.0009, 64), dm, 'dial', [0, top + 0.0005, 0]);
  }
  put(watch, new THREE.TorusGeometry(dR - 0.0018, 0.0006, 8, 64), titanium, 'dial_flange', [0, top + 0.0010, 0], FLAT);

  const my = top + 0.0013;
  if (spec.markers === 'applied') {
    put(watch, new THREE.TorusGeometry(0.0092, 0.0004, 8, 48), ac, 'dial_inner_ring', [0, top + 0.0010, 0], FLAT);
    put(watch, box(0.0030, 0.0009, 0.0030), ac, 'dial_emblem', [0, top + 0.0012, 0.0092], [0, Math.PI / 4, 0]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = dR - 0.0038, twelve = i === 0;
      put(watch, box(twelve ? 0.0028 : 0.0016, 0.0009, twelve ? 0.0048 : 0.0042),
        i % 3 === 0 ? appliedMat : ac, 'hour_marker_' + i, [Math.sin(a) * r, my, Math.cos(a) * r], [0, a, 0]);
    }
  } else if (spec.markers === 'lume') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = dR - 0.0042;
      if (i === 0) {
        put(watch, new THREE.CylinderGeometry(0, 0.0038, 0.0011, 3), ac, 'lume_triangle_12', [0, my, r], [0, Math.PI, 0]);
      } else if (i === 3 || i === 6 || i === 9) {
        put(watch, box(0.0022, 0.0011, 0.0068), ac, 'lume_bar_' + i, [Math.sin(a) * r, my, Math.cos(a) * r], [0, a, 0]);
      } else {
        put(watch, cyl(0.0016, 0.0016, 0.0011, 24), ac, 'lume_dot_' + i, [Math.sin(a) * r, my, Math.cos(a) * r]);
        put(watch, new THREE.TorusGeometry(0.0019, 0.0003, 8, 20), steel, 'marker_surround_' + i,
          [Math.sin(a) * r, my - 0.0002, Math.cos(a) * r], FLAT);
      }
    }
    put(watch, box(0.0060, 0.0008, 0.0026), gunmetal, 'date_frame', [dR - 0.0058, my, 0], [0, Math.PI / 2, 0]);
  } else if (spec.markers === 'baton_slim') {
    put(watch, ring(dR - 0.0016, dR - 0.0008), goldRingMat, 'minute_track', [0, top + 0.0011, 0], FLAT);
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const a = (i / 60) * Math.PI * 2;
      put(watch, box(0.0004, 0.0004, 0.0014), ac, 'minute_tick_' + i,
        [Math.sin(a) * (dR - 0.0024), top + 0.0011, Math.cos(a) * (dR - 0.0024)], [0, a, 0]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = dR - 0.0046;
      put(watch, box(i % 3 === 0 ? 0.0012 : 0.0008, 0.0008, i % 3 === 0 ? 0.0058 : 0.0044), ac,
        'applied_baton_' + i, [Math.sin(a) * r, my, Math.cos(a) * r], [0, a, 0]);
    }
    put(watch, new THREE.TorusGeometry(0.0060, 0.0004, 8, 40), ac, 'subsidiary_seconds_ring', [0, top + 0.0011, -0.0074], FLAT);
  } else if (spec.markers === 'skeleton') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = dR - 0.0042;
      put(watch, box(i % 3 === 0 ? 0.0013 : 0.0008, 0.0009, i % 3 === 0 ? 0.0044 : 0.0030), ac,
        'chapter_index_' + i, [Math.sin(a) * r, my, Math.cos(a) * r], [0, a, 0]);
    }
  } else { // chrono
    put(watch, ring(dR - 0.0014, dR - 0.0006), ringMat, 'minute_track', [0, top + 0.0011, 0], FLAT);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, r = dR - 0.0044;
      put(watch, box(i === 0 ? 0.0026 : 0.0015, 0.0009, i === 0 ? 0.0046 : 0.0040),
        i % 3 === 0 ? appliedMat : ringMat, 'hour_marker_' + i, [Math.sin(a) * r, my, Math.cos(a) * r], [0, a, 0]);
    }
    [[-0.0086, 0], [0.0086, 0], [0, -0.0092]].forEach((c, i) => {
      put(watch, ring(0, 0.0050), insertMat, 'counter_recess_' + i, [c[0], top + 0.0011, c[1]], FLAT);
      put(watch, new THREE.TorusGeometry(0.0050, 0.0005, 8, 40), i === 2 ? goldAcc : ringMat, 'counter_ring_' + i,
        [c[0], top + 0.0013, c[1]], FLAT);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        put(watch, box(0.0004, 0.0004, 0.0010), ringMat, 'counter_tick_' + i + '_' + k,
          [c[0] + Math.sin(a) * 0.0040, top + 0.0014, c[1] + Math.cos(a) * 0.0040], [0, a, 0]);
      }
      put(watch, box(0.0005, 0.0005, 0.0036), i === 2 ? goldAcc : appliedMat, 'counter_hand_' + i,
        [c[0], top + 0.0017, c[1]], [0, 0.7 + i * 1.6, 0]);
      put(watch, cyl(0.0007, 0.0007, 0.0012, 16), ringMat, 'counter_pinion_' + i, [c[0], top + 0.0017, c[1]]);
    });
  }
}

function buildHands(top) {
  hands = new THREE.Group();
  hands.name = 'hand_stack';
  hands.position.set(0, top + 0.0016, 0);
  watch.add(hands);
  const ac = spec.accentMat;
  if (spec.hands === 'sword') {
    put(hands, box(0.0028, 0.0009, 0.0092), ac, 'hour_hand', [0, 0, 0.0032], [0, 0.62, 0]);
    put(hands, box(0.0024, 0.0009, 0.0132), ac, 'minute_hand', [0, 0.0010, 0.0050], [0, -1.9, 0]);
    put(hands, box(0.0008, 0.0007, 0.0152), steel, 'seconds_hand', [0, 0.0019, 0.0044], [0, 2.7, 0]);
    put(hands, cyl(0.0028, 0.0028, 0.0026, 20), ac, 'seconds_lollipop', [0, 0.0019, 0.0106], [0, 2.7, 0]);
    put(hands, cyl(0.0020, 0.0020, 0.0028, 20), gunmetal, 'hand_pinion', [0, 0.0012, 0]);
  } else if (spec.hands === 'leaf') {
    put(hands, box(0.0013, 0.0006, 0.0094), ac, 'hour_hand', [0, 0, 0.0034], [0, 0.62, 0]);
    put(hands, box(0.0010, 0.0006, 0.0138), ac, 'minute_hand', [0, 0.0008, 0.0054], [0, -1.9, 0]);
    put(hands, cyl(0.0014, 0.0014, 0.0022, 20), ac, 'hand_pinion', [0, 0.0009, 0]);
  } else if (spec.hands === 'skeleton') {
    [-1, 1].forEach((s, i) => {
      put(hands, box(0.0004, 0.0006, 0.0090), ac, 'hour_hand_rail_' + i, [s * 0.0007, 0, 0.0032], [0, 0.62, 0]);
      put(hands, box(0.0004, 0.0006, 0.0132), ac, 'minute_hand_rail_' + i, [s * 0.0006, 0.0009, 0.0052], [0, -1.9, 0]);
    });
    put(hands, box(0.0018, 0.0006, 0.0009), ac, 'hour_hand_tip', [0, 0, 0.0074], [0, 0.62, 0]);
    put(hands, box(0.0016, 0.0006, 0.0009), ac, 'minute_hand_tip', [0, 0.0009, 0.0114], [0, -1.9, 0]);
    put(hands, cyl(0.0016, 0.0016, 0.0024, 20), platinum, 'hand_pinion', [0, 0.0010, 0]);
  } else if (spec.hands === 'chrono') {
    put(hands, box(0.0019, 0.0007, 0.0086), appliedMat, 'hour_hand', [0, 0, 0.0030], [0, 0.62, 0]);
    put(hands, box(0.0016, 0.0007, 0.0126), appliedMat, 'minute_hand', [0, 0.0009, 0.0048], [0, -1.9, 0]);
    put(hands, box(0.0007, 0.0006, 0.0150), goldAcc, 'chrono_seconds_hand', [0, 0.0018, 0.0046], [0, 2.35, 0]);
    put(hands, box(0.0009, 0.0006, 0.0030), goldAcc, 'chrono_counterweight', [0, 0.0018, -0.0030], [0, 2.35, 0]);
    put(hands, cyl(0.0018, 0.0018, 0.0026, 20), goldAcc, 'hand_pinion', [0, 0.0011, 0]);
  } else {
    put(hands, box(0.0018, 0.0007, 0.0098), appliedMat, 'hour_hand', [0, 0, 0.0034], [0, 0.62, 0]);
    put(hands, box(0.0015, 0.0007, 0.0136), appliedMat, 'minute_hand', [0, 0.0009, 0.0052], [0, -1.9, 0]);
    put(hands, box(0.0007, 0.0006, 0.0150), goldAcc, 'seconds_hand', [0, 0.0017, 0.0046], [0, 2.7, 0]);
    put(hands, cyl(0.0018, 0.0018, 0.0026, 20), goldAcc, 'hand_pinion', [0, 0.0010, 0]);
  }
}

function buildCrown(R) {
  const cm = spec.caseMat;
  if (spec.crown === 'oversize') {
    put(watch, cyl(0.0050, 0.0050, 0.0058, 32), cm, 'crown', [R + 0.0026, 0, 0], [0, 0, Math.PI / 2]);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      put(watch, box(0.0058, 0.0010, 0.0010), gunmetal, 'crown_knurl_' + i,
        [R + 0.0026, Math.sin(a) * 0.0050, Math.cos(a) * 0.0050], [a, 0, 0]);
    }
    put(watch, cyl(0.0034, 0.0034, 0.0018, 24), titanium, 'crown_cap', [R + 0.0062, 0, 0], [0, 0, Math.PI / 2]);
    [-1, 1].forEach((s, i) => put(watch, box(0.0060, 0.0044, 0.0062), cm, 'crown_guard_' + i, [R - 0.0006, 0, s * 0.0064]));
  } else if (spec.crown === 'slim') {
    put(watch, cyl(0.0030, 0.0030, 0.0034, 28), cm, 'crown', [R + 0.0014, 0, 0], [0, 0, Math.PI / 2]);
    put(watch, cyl(0.0022, 0.0022, 0.0012, 20), spec.accentMat, 'crown_cap', [R + 0.0034, 0, 0], [0, 0, Math.PI / 2]);
  } else if (spec.crown === 'pushers') {
    put(watch, cyl(0.0038, 0.0038, 0.0042, 32), gunmetal, 'crown', [R + 0.0018, 0, 0], [0, 0, Math.PI / 2]);
    put(watch, cyl(0.0028, 0.0028, 0.0016, 24), titanium, 'crown_cap', [R + 0.0042, 0, 0], [0, 0, Math.PI / 2]);
    [[1, 0.0092], [-1, 0.0092]].forEach(([s, off], i) => {
      put(watch, cyl(0.0026, 0.0026, 0.0044, 24), gunmetal, 'chrono_pusher_' + i,
        [R * 0.86 + 0.0012, 0, s * off], [0, 0, Math.PI / 2]);
      put(watch, cyl(0.0030, 0.0030, 0.0016, 24), spec.caseMat, 'pusher_shoulder_' + i,
        [R * 0.82, 0, s * off], [0, 0, Math.PI / 2]);
    });
  } else {
    put(watch, cyl(0.0038, 0.0038, 0.0042, 32), gunmetal, 'crown', [R + 0.0018, 0, 0], [0, 0, Math.PI / 2]);
    put(watch, cyl(0.0028, 0.0028, 0.0016, 24), titanium, 'crown_cap', [R + 0.0042, 0, 0], [0, 0, Math.PI / 2]);
    [-1, 1].forEach((s, i) => put(watch, box(0.0044, 0.0030, 0.0052), spec.caseMat, 'crown_guard_' + i, [R - 0.0004, 0, s * 0.0056]));
  }
}

function buildBack(top, R) {
  const cm = spec.caseMat, bR = R - 0.0029;
  put(watch, new THREE.TorusGeometry(bR, 0.0018, 12, 64), cm, 'case_back_ring', [0, -top - 0.0007, 0], FLAT);
  if (spec.exhibition) {
    put(watch, cyl(bR - 0.0006, bR - 0.0006, 0.0014, 64), sapphire, 'case_back_crystal', [0, -top - 0.0009, 0]);
    put(watch, cyl(bR - 0.0018, bR - 0.0018, 0.0012, 64), titanium, 'movement_plate', [0, -top + 0.0013, 0]);
    put(watch, new THREE.TorusGeometry(0.0112, 0.0016, 10, 48, Math.PI), goldAcc, 'movement_rotor', [0, -top + 0.0001, 0], [Math.PI / 2, 0, 0.5]);
    put(watch, new THREE.CylinderGeometry(0.0112, 0.0112, 0.0012, 40, 1, false, 0.4, Math.PI), gunmetal, 'rotor_web', [0, -top + 0.0001, 0]);
    [[0.0070, 0.0050, 0.0082], [-0.0062, 0.0038, -0.0050], [0.0014, 0.0034, -0.0088]].forEach((g, i) => {
      put(watch, cyl(g[1], g[1], 0.0010, 28), goldAcc, 'movement_gear_' + i, [g[0], -top - 0.0001, g[2]]);
    });
    put(watch, box(0.0024, 0.0010, 0.0180), titanium, 'movement_bridge', [-0.0028, -top + 0.0003, 0], [0, 0.5, 0]);
  } else {
    put(watch, cyl(bR - 0.0006, bR - 0.0006, 0.0016, 64), cm, 'screw_down_caseback', [0, -top - 0.0009, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      put(watch, box(0.0030, 0.0014, 0.0012), gunmetal, 'caseback_notch_' + i,
        [Math.sin(a) * (bR - 0.0016), -top - 0.0014, Math.cos(a) * (bR - 0.0016)], [0, a, 0]);
    }
    put(watch, new THREE.TorusGeometry(0.0086, 0.0005, 8, 48), titanium, 'caseback_engraving', [0, -top - 0.0018, 0], FLAT);
  }
}

function buildStrap() {
  const kind = spec.strap;
  const group = new THREE.Group();
  group.name = kind === 'bracelet' ? 'bracelet' : 'strap';
  watch.add(group);
  const cY = -0.0205, rY = 0.0260, rZ = 0.0168, GAP = 0.62, N = 24;
  for (let i = 0; i < N; i++) {
    const th = GAP + (i / (N - 1)) * (Math.PI * 2 - GAP * 2);
    const y = cY + rY * Math.cos(th);
    const z = rZ * Math.sin(th);
    const a = Math.atan2(rY * Math.sin(th), rZ * Math.cos(th));
    const t = Math.abs(Math.cos(th * 0.5));
    const w = spec.strapW - 0.0030 * (1 - t);
    const centre = Math.abs(th - Math.PI) < 0.18;
    const link = new THREE.Group();
    link.name = (kind === 'bracelet' ? 'bracelet_link_' : 'strap_segment_') + i;
    link.position.set(0, y, z);
    link.rotation.x = a;
    group.add(link);
    if (kind === 'bracelet') {
      put(link, box(w, 0.0030, 0.0062), i % 2 ? spec.caseMat : spec.linkMat, 'link_plate_' + i);
      put(link, box(w * 0.42, 0.0034, 0.0044), i % 2 ? spec.linkMat : spec.caseMat, 'link_centre_' + i, [0, 0.0004, 0]);
      if (centre) put(link, box(w * 1.06, 0.0018, 0.0100), titanium, 'clasp_cover', [0, -0.0022, 0]);
    } else if (kind === 'leather') {
      put(link, box(w, 0.0024, 0.0076), leatherMat, 'leather_section_' + i);
      [-1, 1].forEach((s, k) => put(link, box(0.0005, 0.0006, 0.0068), spec.accentMat, 'stitch_' + i + '_' + k,
        [s * (w / 2 - 0.0018), 0.0013, 0]));
      if (centre) {
        put(link, box(w * 1.12, 0.0022, 0.0128), spec.caseMat, 'deployant_buckle', [0, -0.0024, 0]);
        put(link, box(w * 0.52, 0.0014, 0.0060), spec.accentMat, 'buckle_plate', [0, -0.0038, 0]);
      }
    } else {
      put(link, box(w, 0.0034, 0.0074), rubberMat, 'rubber_section_' + i);
      put(link, box(w * 0.88, 0.0012, 0.0028), rubberMat, 'rubber_rib_' + i, [0, 0.0021, 0]);
      if (centre) {
        put(link, box(w * 1.08, 0.0024, 0.0120), spec.caseMat, 'rubber_clasp', [0, -0.0028, 0]);
        put(link, box(w * 0.46, 0.0016, 0.0056), gunmetal, 'clasp_release', [0, -0.0042, 0]);
      }
    }
  }
}

function buildWatch(index) {
  spec = ARCHETYPES[index];
  watch.clear();
  const R = spec.caseR, top = spec.bandH / 2, cm = spec.caseMat;

  put(watch, cyl(R, R, spec.bandH, 64, true), cm, 'case_band');
  put(watch, new THREE.TorusGeometry(R - 0.0006, 0.0011, 10, 64), cm, 'case_chamfer_top', [0, top, 0], FLAT);
  put(watch, new THREE.TorusGeometry(R - 0.0006, 0.0011, 10, 64), cm, 'case_chamfer_bottom', [0, -top, 0], FLAT);

  buildBezel(top, R);
  put(watch, cyl(R - 0.0027, R - 0.0027, 0.0024, 64), sapphire, 'crystal', [0, top + 0.0025, 0]);
  buildDial(top, R);
  buildHands(top);
  buildCrown(R);
  buildBack(top, R);

  // lugs
  [-1, 1].forEach((s, i) => {
    put(watch, box(R * 0.88, 0.0048, 0.0086), cm, 'lug_' + i, [0, -0.0014, s * (R * 0.81)], [s * 0.30, 0, 0]);
    put(watch, cyl(0.0011, 0.0011, R * 0.95, 16), titanium, 'spring_bar_' + i, [0, -0.0038, s * (R * 0.96)], [0, 0, Math.PI / 2]);
  });

  buildStrap();

  glint = new THREE.Mesh(
    new THREE.PlaneGeometry(0.0042, 0.020),
    new THREE.MeshBasicMaterial({ color: 0xfff6e6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  glint.name = 'crystal_reflection';
  glint.material.name = 'crystal_reflection_mat';
  glint.rotation.x = -Math.PI / 2;
  glint.rotation.z = 0.42;
  glint.position.y = top + 0.0039;
  glint.castShadow = false;
  watch.add(glint);

  watch.traverse((o) => { if (o.isMesh && (o.material === sapphire || o.material.name === 'crystal_reflection_mat')) o.castShadow = false; });
}
buildWatch(0);

/* ---------- choreography ---------- */
// bracelet's lowest link rests on the platform pad (local y 0.0098)
const WATCH_REST_Y = () => platform.position.y + 0.0563;
const PLAT_Y0 = 0.018, PLAT_LIFT = 0.078;

const clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const eio = (u) => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const eos = (u) => 1 - Math.pow(1 - u, 4);
const lerp = (a, b, u) => a + (b - a) * u;

const TOTAL = 12.6;
const PHASES = [
  ['01 · Vault Closed', 0, 0.16],
  ['02 · Lock Disengage', 0.16, 1.35],
  ['03 · Lid Opening', 1.35, 4.10],
  ['04 · Interior Activation', 4.10, 5.70],
  ['05 · Platform Elevation', 5.70, 8.10],
  ['06 · Watch Presentation', 8.10, 10.30],
  ['07 · Icon Rarity Moment', 10.30, TOTAL],
];

/** Pure geometric pose at absolute time t — the single source of truth for
 *  both the live sequence and the exported animation clips. */
function pose(t) {
  const twist = eio(seg(t, 0.16, 0.90)) * (Math.PI / 2);
  const draw = eio(seg(t, 0.55, 1.35));
  boltGroups.forEach((g, i) => {
    const sx = Math.sign(g.position.x || 1) * (g.rotation.z < 0 ? 1 : -1);
    g.position.x = sx * (W / 2 - 0.004 - 0.0155 * draw);
    boltPins[i].rotation.y = twist;
  });

  const lift = eos(seg(t, 1.35, 2.20));
  const tilt = eio(seg(t, 1.95, 4.10));
  lid.position.y = SEAM_Y + 0.0215 * lift;
  lid.position.z = -D / 2 - 0.0035 * lift;
  lid.rotation.x = -1.235 * tilt;

  const rise = eio(seg(t, 5.70, 8.10));
  platform.position.y = PLAT_Y0 + PLAT_LIFT * rise;

  const float = eio(seg(t, 8.15, 10.20));
  const settle = eio(seg(t, 10.30, TOTAL));
  watch.position.set(0, WATCH_REST_Y() + 0.048 * float + 0.004 * settle, 0.052 * float);
  watch.rotation.set(1.02 * float, 0.40 * float + 0.30 * settle, 0);
}

/* extra lights: one primary spot, one cool rim */
const spot = new THREE.SpotLight(0xfff4e4, 0, 3.2, 0.46, 0.78, 1.6);
spot.name = 'vault_key_spot';
spot.position.set(0.045, 0.62, 0.16);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0004;
scene.add(spot, spot.target);

const rim = new THREE.SpotLight(0x9dbdf0, 0, 3.0, 0.7, 0.9, 1.4);
rim.name = 'vault_rim_light';
rim.position.set(-0.34, 0.20, -0.30);
scene.add(rim, rim.target);

// inspection headlight — rides the camera so finishing stays readable
// once the vault hands the piece over to the collector
const inspectLight = new THREE.DirectionalLight(0xf4eee2, 0);
inspectLight.name = 'inspection_fill';
scene.add(inspectLight);
// front presentation light — keeps the piece readable once it floats free
const presLight = new THREE.SpotLight(0xffeedd, 0, 1.4, 0.55, 0.9, 1.5);
presLight.name = 'presentation_light';
scene.add(presLight, presLight.target);

const hemi = scene.children.find((o) => o.isHemisphereLight);
const vig = document.getElementById('vig');

function lights(t) {
  const on = eio(seg(t, 4.10, 5.70));
  const icon = eio(seg(t, 10.30, TOTAL));
  seamMat.emissiveIntensity = 0.85 * eio(seg(t, 0.05, 0.80)) * (1 - 0.55 * seg(t, 3.0, 4.4));
  emblemMat.emissiveIntensity = 1.4 * eio(seg(t, 0.3, 1.1)) * (1 - 0.7 * seg(t, 2.4, 4.0)) + 0.5 * icon;
  stripMat.emissiveIntensity = 1.4 * on * (1 - 0.35 * icon);

  spot.intensity = lerp(0, 1.5, on) * lerp(1, 1.5, icon);
  spot.angle = lerp(0.46, 0.255, icon);
  spot.penumbra = lerp(0.78, 0.62, icon);
  const ty = watch.position.y;
  spot.target.position.set(0, ty, watch.position.z * 0.6);
  spot.position.set(0.045 + 0.02 * icon, 0.62, 0.16 - 0.03 * icon);

  rim.intensity = lerp(0, 0.7, eio(seg(t, 4.6, 6.4))) * lerp(1, 0.55, icon);
  rim.target.position.set(0, ty, 0);
  presLight.intensity = lerp(0, 0.55, eio(seg(t, 8.2, 10.4))) * lerp(1, 1.45, icon);
  presLight.position.set(0.16, ty + 0.10, 0.30);
  presLight.target.position.set(0, ty, watch.position.z);

  if (hemi) hemi.intensity = lerp(0.62, 0.12, Math.max(on * 0.6, icon));
  scene.environmentIntensity = lerp(0.78, 0.24, Math.max(on * 0.5, icon));

  // reflection sweeping across the crystal
  const sw = seg(t, 8.6, 10.6);
  const sw2 = seg(t, 10.6, TOTAL);
  const p = sw < 1 ? sw : sw2;
  glint.material.opacity = (sw < 1 ? 0.20 : 0.15) * Math.sin(clamp01(p) * Math.PI) * (t > 8.4 ? 1 : 0);
  glint.position.x = lerp(-0.019, 0.019, clamp01(p));

  vig.style.opacity = String(lerp(0.55, 0.94, icon));
  stage.style.setProperty('--stage-bg', icon > 0.5 ? '#030405' : '#08090b');
}

/* camera: scripted through the sequence, free during inspection */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CAM_KEYS = [
  [0.00, V(0.305, 0.205, 0.365), V(0, 0.072, 0)],
  [4.10, V(0.290, 0.225, 0.340), V(0, 0.082, 0)],
  [8.10, V(0.250, 0.230, 0.310), V(0, 0.112, 0)],
  [10.30, V(0.190, 0.250, 0.258), V(-0.015, 0.190, 0.026)],
  [TOTAL, V(0.148, 0.243, 0.212), V(-0.030, 0.205, 0.040)],
];
const _p = new THREE.Vector3(), _t = new THREE.Vector3();
function scriptCamera(t, k = 0.12) {
  let i = 0;
  while (i < CAM_KEYS.length - 2 && t > CAM_KEYS[i + 1][0]) i++;
  const [t0, p0, g0] = CAM_KEYS[i], [t1, p1, g1] = CAM_KEYS[i + 1];
  const u = eio(clamp01((t - t0) / (t1 - t0)));
  _p.lerpVectors(p0, p1, u);
  _t.lerpVectors(g0, g1, u);
  camera.position.lerp(_p, k);
  controls.target.lerp(_t, k);
}

/* inspection framing */
// offsets in the WATCH's own frame (dial +y, crown +x, bracelet -y),
// so every preset stays true to the presented orientation
const VIEWS = {
  hero:     [V(0.052, 0.108, 0.115), V(0, -0.004, 0)],
  dial:     [V(0.030, 0.078, 0.024), V(0, 0.004, 0)],
  case:     [V(0.104, 0.020, 0.032), V(0, 0, 0)],
  crown:    [V(0.082, 0.016, 0.008), V(0.020, 0, 0)],
  bracelet: [V(0.082, -0.040, 0.074), V(0, -0.026, 0)],
  movement: [V(0.058, -0.094, 0.010), V(0, -0.018, 0)],
};

let mode = 'closed';      // closed | dragging | playing | inspect
let T = 0;
let tween = null;
let sweptIcon = false;

const elPhase = document.querySelector('#phase b');
const elHint = document.getElementById('hint');
const elRarity = document.getElementById('rarity');
const elSweep = document.getElementById('sweep');
const elInspect = document.getElementById('inspect');
const note = stage.shadowRoot.querySelector('.note');

function setPhaseLabel() {
  if (mode === 'inspect') { elPhase.textContent = '08 · Inspection Mode'; return; }
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (T >= PHASES[i][1] || i === 0) { elPhase.textContent = PHASES[i][0]; return; }
  }
}

function enterInspect() {
  mode = 'inspect';
  controls.enabled = true;
  controls.minDistance = 0.055;
  controls.maxDistance = 0.62;
  controls.target.copy(watch.position);
  elHint.style.opacity = '0';
  elRarity.classList.remove('show');
  document.getElementById('tier').style.opacity = '1';
  elInspect.classList.add('show');
  elInspect.style.pointerEvents = 'auto';
  note.textContent = 'Drag to orbit · scroll to zoom in on the finishing';
  setPhaseLabel();
  goToView('hero');
}

function goToView(key) {
  if (key === 'reseal') return reseal();
  const [off, tg] = VIEWS[key];
  const to = off.clone().applyQuaternion(watch.quaternion).add(watch.position);
  const target = tg.clone().applyQuaternion(watch.quaternion).add(watch.position);
  tween = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo: target, u: 0, dur: 1.15 };
  document.querySelectorAll('#inspect button').forEach((b) => b.classList.toggle('on', b.dataset.view === key));
}

function reseal() {
  mode = 'closed';
  T = 0;
  tween = null;
  sweptIcon = false;
  controls.enabled = false;
  elRarity.classList.remove('show');
  document.getElementById('tier').style.opacity = '0';
  elSweep.classList.remove('go');
  elInspect.classList.remove('show');
  elInspect.style.pointerEvents = 'none';
  elHint.style.opacity = '1';
  note.textContent = '';
  pose(0); lights(0); setPhaseLabel();
}

elInspect.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => goToView(b.dataset.view)));

/* drag-to-unseal: the lid answers the hand until the mechanism takes over */
let drag = null;
const DRAG_SPAN = 260;          // px of pull that covers lock + lid
stage.addEventListener('pointerdown', (e) => {
  if (mode !== 'closed') return;
  drag = { y: e.clientY, t0: T, moved: 0 };
  mode = 'dragging';
  stage.setPointerCapture?.(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging' || !drag) return;
  const dy = drag.y - e.clientY;
  drag.moved = Math.max(drag.moved, Math.abs(dy));
  T = Math.min(4.10, Math.max(0, drag.t0 + (dy / DRAG_SPAN) * 4.10));
  elHint.style.opacity = String(Math.max(0, 1 - T / 1.2));
});
function release() {
  if (mode !== 'dragging') return;
  const tapped = drag && drag.moved < 8;
  if (T > 2.35 || tapped) { mode = 'playing'; elHint.style.opacity = '0'; }
  else { mode = 'closed'; springBack = true; }
  drag = null;
}
let springBack = false;
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (mode === 'closed')) { mode = 'playing'; elHint.style.opacity = '0'; }
});

/* ---------- exported animation states ---------- */
const animNodes = [lid, platform, watch, ...boltGroups, ...boltPins];
function sampleClip(name, t0, t1, n) {
  const times = [];
  const data = animNodes.map(() => ({ p: [], q: [] }));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1);
    pose(t0 + (t1 - t0) * u);
    times.push((t1 - t0) * u);
    animNodes.forEach((o, k) => {
      data[k].p.push(o.position.x, o.position.y, o.position.z);
      data[k].q.push(o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w);
    });
  }
  const tracks = [];
  animNodes.forEach((o, k) => {
    tracks.push(new THREE.VectorKeyframeTrack(o.name + '.position', times, data[k].p));
    tracks.push(new THREE.QuaternionKeyframeTrack(o.name + '.quaternion', times, data[k].q));
  });
  return new THREE.AnimationClip(name, Math.max(t1 - t0, 0.5), tracks);
}
const clips = PHASES.map(([label, a, b], i) =>
  sampleClip(label.replace(/^\d+ · /, (i + 1 < 10 ? '0' + (i + 1) : i + 1) + '_').replace(/\s/g, '_'), a, b, b - a < 0.3 ? 2 : 26)
);
// 08 — turntable inspection: the presented watch rotates a full circle
pose(TOTAL);
{
  const times = [], q = [], p = [];
  const base = watch.rotation.y, e = new THREE.Euler(watch.rotation.x, 0, 0), qq = new THREE.Quaternion();
  for (let i = 0; i <= 32; i++) {
    const u = i / 32;
    times.push(u * 8);
    e.set(watch.rotation.x, base + u * Math.PI * 2, 0);
    qq.setFromEuler(e);
    q.push(qq.x, qq.y, qq.z, qq.w);
    p.push(watch.position.x, watch.position.y, watch.position.z);
  }
  clips.push(new THREE.AnimationClip('08_Interactive_360_Inspection', 8, [
    new THREE.QuaternionKeyframeTrack('watch_icon.quaternion', times, q),
    new THREE.VectorKeyframeTrack('watch_icon.position', times, p),
  ]));
}
model.animations = clips;

/* ---------- go live ---------- */
stage.setObject(model);
camera.near = 0.004;
camera.far = 60;
camera.updateProjectionMatrix();
controls.enabled = false;
controls.enableDamping = true;
controls.dampingFactor = 0.06;
sapphire.side = THREE.DoubleSide;
glint.castShadow = false;
watch.traverse((o) => { if (o.isMesh && o.material === sapphire) o.castShadow = false; });
reseal();
camera.position.copy(CAM_KEYS[0][1]);
controls.target.copy(CAM_KEYS[0][2]);

window.__vault = {
  seek(t) { mode = 'playing'; springBack = false; elHint.style.opacity = '0'; T = Math.min(TOTAL, t); pose(T); lights(T); scriptCamera(T, 1); },
  inspect() { T = TOTAL; pose(T); enterInspect(); tween && (tween.u = 1); },
  view: (k) => goToView(k),
  reseal,
};

/* ---------- archetype switcher ---------- */
const elArch = document.querySelector('#arch .btns');
const elRef = document.getElementById('ref');
const elEd = document.getElementById('ed');
const elRName = document.getElementById('rname');
const elREd = document.getElementById('red');

function selectArchetype(i) {
  buildWatch(i);
  const s = ARCHETYPES[i];
  elRef.textContent = s.ref;
  elEd.textContent = s.edition;
  elRName.textContent = s.name;
  elREd.textContent = s.edition;
  stage.setAttribute('name', 'grailhaus-icon-' + s.id);
  elArch.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i));
  pose(T);
  if (mode === 'inspect') {
    const cur = document.querySelector('#inspect button.on');
    goToView(cur ? cur.dataset.view : 'hero');
  }
}

ARCHETYPES.forEach((s, i) => {
  const b = document.createElement('button');
  b.innerHTML = '<span class="sw" style="color:' + s.swatch + ';background:' + s.swatch + '"></span>'
    + '<span class="nm">' + s.name + '</span><span class="rm">' + s.numeral + '</span>';
  b.title = s.line;
  b.addEventListener('click', () => selectArchetype(i));
  elArch.appendChild(b);
});
selectArchetype(0);
window.__vault.archetype = selectArchetype;

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (mode === 'playing') {
    T = Math.min(TOTAL, T + dt);
    if (T >= TOTAL) enterInspect();
  } else if (mode === 'closed' && springBack) {
    T = Math.max(0, T - dt * 3.2);
    if (T === 0) springBack = false;
    elHint.style.opacity = String(Math.max(0, 1 - T / 1.2));
  }

  if (mode !== 'inspect') {
    pose(T);
    scriptCamera(T);
    setPhaseLabel();
    if (T > 10.55 && !sweptIcon) { sweptIcon = true; elSweep.classList.add('go'); }
    elRarity.classList.toggle('show', T > 11.35);
  } else {
    lights(TOTAL);
    // off-axis so polished surfaces don't flash a mirror back at the lens
    _p.copy(camera.position).sub(watch.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
    inspectLight.position.copy(watch.position).add(_p.multiplyScalar(1.4));
    inspectLight.position.y += _p.length() * 0.5;
    inspectLight.target.position.copy(watch.position);
    inspectLight.target.updateMatrixWorld();
    inspectLight.intensity = Math.min(0.32, inspectLight.intensity + dt * 0.5);
    // museum inspection: a slow reflection continues to travel the crystal
    const u = (now / 5200) % 1;
    glint.material.opacity = 0.14 * Math.sin(u * Math.PI);
    glint.position.x = lerp(-0.019, 0.019, u);
  }
  if (mode !== 'inspect') { lights(T); inspectLight.intensity = 0; }

  if (tween) {
    tween.u = Math.min(1, tween.u + dt / tween.dur);
    const u = eio(tween.u);
    camera.position.lerpVectors(tween.from, tween.to, u);
    controls.target.lerpVectors(tween.tFrom, tween.tTo, u);
    if (tween.u >= 1) tween = null;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
