// TIER 2 — VAULT BREAK pack artwork.
// Deep royal violet over plum, satin metallic finish, brushed champagne-gold
// detailing, embossed GrailHaus medallion, debossed architectural geometry.
// Same 800x1200 art space and crimped silhouette contract as Street Rip; the
// difference is material and construction, not decoration count.

import { cv, T, rr, embossText, metalFill, hairlines, grooveLine, guilloche, microBlock, barcode } from './art-util.js';

export const SEAM_FRAC = 0.222;   // deeper seam than Street Rip (0.205)
export const FLAP_FRAC = 0.074;   // heavier crimp flap (0.062)
const W = 800, H = 1200;
const TEETH = 16, TOOTH_D = 34;   // finer, deeper crimp teeth

const IVORY = '#f4ece0';
const CH_HI = '#fbf0d4', CH = '#e8cf9a', CH_MID = '#b99b57', CH_DK = '#6f5a2c';
const PLUM = '#1b0a33', VIOLET = '#3a1a6e', VIOLET_HI = '#5b2ea8', INK = '#0a0413';

const champagne = (ctx, y0, y1) => metalFill(ctx, y0, y1);
const graphite = (ctx, y0, y1) => metalFill(ctx, y0, y1, [
  [0, '#2c2a33'], [0.3, '#6c6874'], [0.52, '#3a3742'], [0.75, '#5e5a68'], [1, '#1d1b22'],
]);

function silhouette(ctx) {
  const p = W / TEETH;
  ctx.beginPath();
  ctx.moveTo(0, TOOTH_D);
  for (let i = 0; i < TEETH; i++) {
    ctx.lineTo(i * p + p / 2, 0);
    ctx.lineTo((i + 1) * p, TOOTH_D);
  }
  ctx.lineTo(W, H - TOOTH_D);
  for (let i = TEETH; i > 0; i--) {
    ctx.lineTo(i * p - p / 2, H);
    ctx.lineTo((i - 1) * p, H - TOOTH_D);
  }
  ctx.closePath();
}

// Satin violet substrate: plum in the shadows, royal violet in the sheen
// band, near-black at both edges. Cross-lit so the pack has a lit side.
function satinBase(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  [[0, '#07030e'], [0.08, '#160828'], [0.22, '#2b1152'], [0.38, VIOLET],
    [0.5, '#31165e'], [0.62, '#3f1d78'], [0.78, '#221040'], [0.92, '#120722'],
    [1, '#05020a']].forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // vertical falloff: light gathers at the shoulders, plum pools at the foot
  const v = ctx.createLinearGradient(0, 0, 0, H);
  [[0, 'rgba(190,150,255,0.10)'], [0.18, 'rgba(0,0,0,0)'], [0.62, 'rgba(0,0,0,0.18)'],
    [1, 'rgba(0,0,0,0.62)']].forEach(([p, c]) => v.addColorStop(p, c));
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  // micro-engraved satin finish
  hairlines(ctx, 0, 0, W, H, { step: 5, angle: -0.38, alpha: 0.045 });
  hairlines(ctx, 0, 0, W, H, { step: 23, angle: 1.32, alpha: 0.022 });

  // corner shadow regions — dimensional separation from the environment
  [[0, 0], [W, 0], [0, H], [W, H]].forEach(([x, y]) => {
    const r = ctx.createRadialGradient(x, y, 0, x, y, W * 0.52);
    r.addColorStop(0, 'rgba(0,0,0,0.55)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  });
}

// Debossed architectural geometry: a tall pressed panel with chamfered
// corners and stepped inner returns. Structure, not ornament.
function debossedArchitecture(ctx, x, y, w, h) {
  const chamfer = 46;
  const path = (inset) => {
    const a = x + inset, b = y + inset, c = x + w - inset, d = y + h - inset;
    const k = chamfer * (1 - inset / (w * 0.5));
    ctx.beginPath();
    ctx.moveTo(a + k, b); ctx.lineTo(c - k, b); ctx.lineTo(c, b + k);
    ctx.lineTo(c, d - k); ctx.lineTo(c - k, d); ctx.lineTo(a + k, d);
    ctx.lineTo(a, d - k); ctx.lineTo(a, b + k); ctx.closePath();
  };
  ctx.save();
  // pressed field, slightly darker than the body
  path(0);
  ctx.fillStyle = 'rgba(8,3,18,0.42)'; ctx.fill();
  // groove walls
  [0, 14, 30].forEach((i, n) => {
    path(i);
    ctx.strokeStyle = n === 0 ? 'rgba(0,0,0,0.6)' : `rgba(232,207,162,${0.16 - n * 0.045})`;
    ctx.lineWidth = n === 0 ? 5 : 1.4;
    ctx.stroke();
    if (n === 0) {
      ctx.save(); ctx.translate(0, 3);
      path(i);
      ctx.strokeStyle = 'rgba(255,240,205,0.14)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  });
  ctx.restore();
}

// Heavier crimp: taller band, finer knurl, deeper shadow where jaw meets body.
function crimpBand(ctx, y0, y1, top) {
  const h = y1 - y0;
  ctx.save();
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  if (top) {
    [[0, '#a98fd8'], [0.24, '#6b4aa8'], [0.6, '#341a60'], [1, '#0d0420']]
      .forEach(([p, c]) => g.addColorStop(p, c));
  } else {
    [[0, '#0d0420'], [0.4, '#341a60'], [0.76, '#6b4aa8'], [1, '#a98fd8']]
      .forEach(([p, c]) => g.addColorStop(p, c));
  }
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, h);
  // knurled jaw teeth
  for (let x = 0; x < W; x += 9) {
    ctx.fillStyle = 'rgba(255,246,224,0.26)'; ctx.fillRect(x, y0, 3, h);
    ctx.fillStyle = 'rgba(0,0,0,0.58)'; ctx.fillRect(x + 4, y0, 4, h);
  }
  // champagne thread running through the crimp — layered foil construction
  const ty = top ? y1 - h * 0.32 : y0 + h * 0.22;
  ctx.fillStyle = 'rgba(232,207,162,0.5)'; ctx.fillRect(0, ty, W, 2);
  ctx.fillStyle = 'rgba(255,255,255,0.44)';
  ctx.fillRect(0, top ? y0 : y1 - 3, W, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, top ? y1 - 7 : y0, W, 7);
  ctx.restore();
}

// The tear channel. No printed rainbow strip — a debossed groove between two
// champagne threads, with corner ticks. The rip itself supplies the drama.
function tearChannel(ctx, seam) {
  const y = seam - 16;
  ctx.save();
  const band = ctx.createLinearGradient(0, y - 26, 0, y + 18);
  [[0, 'rgba(6,2,14,0)'], [0.4, 'rgba(6,2,14,0.55)'], [1, 'rgba(6,2,14,0)']]
    .forEach(([p, c]) => band.addColorStop(p, c));
  ctx.fillStyle = band; ctx.fillRect(0, y - 26, W, 44);
  grooveLine(ctx, 30, y, W - 30, y, { w: 7, dark: 'rgba(0,0,0,0.72)', lit: 'rgba(255,240,205,0.20)' });
  ctx.setLineDash([5, 9]);
  ctx.strokeStyle = 'rgba(232,207,162,0.42)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(38, y); ctx.lineTo(W - 38, y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(232,207,162,0.28)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(30, y - 11); ctx.lineTo(W - 30, y - 11); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, y + 11); ctx.lineTo(W - 30, y + 11); ctx.stroke();
  ctx.restore();
  [44, W - 44].forEach((x, i) => {
    T(ctx, 'TEAR', x, y - 22, {
      size: 12, weight: 700, ls: 4, family: 'ui-monospace, Menlo, monospace',
      fill: 'rgba(232,207,162,0.66)', align: i ? 'right' : 'left',
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(232,207,162,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(i ? x + 2 : x - 2, y - 6); ctx.lineTo(i ? x - 12 : x + 12, y);
    ctx.lineTo(i ? x + 2 : x - 2, y + 6); ctx.stroke();
    ctx.restore();
  });
}

// Embossed GrailHaus medallion: vault-door rings, chamfered octagon frame,
// bevelled G. Built from bed/rim/face passes so it reads as struck metal.
function medallion(ctx, cx, cy, R, logo) {
  ctx.save();
  ctx.translate(cx, cy);

  // pressed well behind the medallion
  const well = ctx.createRadialGradient(0, -R * 0.2, R * 0.1, 0, 0, R * 1.12);
  well.addColorStop(0, 'rgba(58,26,110,0.85)');
  well.addColorStop(0.62, 'rgba(16,6,32,0.9)');
  well.addColorStop(1, 'rgba(4,1,10,0.95)');
  ctx.beginPath(); ctx.arc(0, 0, R * 1.12, 0, 7);
  ctx.fillStyle = well; ctx.fill();

  // concentric vault rings, each with a lit top edge
  [1.0, 0.86, 0.71].forEach((k, i) => {
    ctx.beginPath(); ctx.arc(0, 0, R * k, 0, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 9 - i * 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * k, Math.PI * 1.06, Math.PI * 1.94);
    ctx.strokeStyle = `rgba(232,207,162,${0.5 - i * 0.1})`; ctx.lineWidth = 3 - i * 0.6; ctx.stroke();
  });
  // bolt heads at the cardinal returns
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * R * 0.93, y = Math.sin(a) * R * 0.93;
    ctx.beginPath(); ctx.arc(x, y, R * 0.032, 0, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x - R * 0.008, y - R * 0.01, R * 0.024, 0, 7);
    ctx.fillStyle = champagne(ctx, y - R * 0.03, y + R * 0.03); ctx.fill();
  }

  // octagon frame
  const oct = (rad) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  oct(R * 0.66);
  ctx.fillStyle = 'rgba(10,4,22,0.72)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 8; ctx.stroke();
  oct(R * 0.66);
  ctx.strokeStyle = champagne(ctx, -R * 0.66, R * 0.66); ctx.lineWidth = 3.4; ctx.stroke();
  oct(R * 0.56);
  ctx.strokeStyle = 'rgba(232,207,162,0.24)'; ctx.lineWidth = 1.2; ctx.stroke();

  // violet inner field, faintly engraved
  oct(R * 0.54);
  ctx.save(); ctx.clip();
  const inner = ctx.createLinearGradient(-R * 0.5, -R * 0.5, R * 0.5, R * 0.5);
  inner.addColorStop(0, '#25104a'); inner.addColorStop(0.5, VIOLET_HI); inner.addColorStop(1, '#150829');
  ctx.fillStyle = inner; ctx.fillRect(-R, -R, R * 2, R * 2);
  hairlines(ctx, -R, -R, R * 2, R * 2, { step: 7, angle: 0.6, alpha: 0.07 });
  ctx.restore();

  if (logo) {
    const s = R * 1.0;
    ctx.save();
    oct(R * 0.54); ctx.clip();
    ctx.globalAlpha = 0.96;
    ctx.drawImage(logo, -s / 2, -s / 2, s, s);
    ctx.restore();
  } else {
    embossText(ctx, 'G', 0, R * 0.29, {
      size: R * 0.92, weight: 700, fill: champagne(ctx, -R * 0.6, R * 0.3),
      depth: R * 0.022, bed: 'rgba(0,0,0,0.8)', rim: 'rgba(255,246,220,0.34)',
    });
  }
  ctx.restore();
}

// Champagne bevelled plate carrying the edition name.
function editionPlate(ctx, cx, cy, w, h, label) {
  const x = cx - w / 2, y = cy - h / 2, k = 22;
  const shape = (inset) => {
    const a = x + inset, b = y + inset, c = x + w - inset, d = y + h - inset;
    ctx.beginPath();
    ctx.moveTo(a + k, b); ctx.lineTo(c - k, b); ctx.lineTo(c, b + k);
    ctx.lineTo(c, d - k); ctx.lineTo(c - k, d); ctx.lineTo(a + k, d);
    ctx.lineTo(a, d - k); ctx.lineTo(a, b + k); ctx.closePath();
  };
  ctx.save();
  shape(-6);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
  shape(0);
  const plate = ctx.createLinearGradient(0, y, 0, y + h);
  plate.addColorStop(0, '#170a2b'); plate.addColorStop(0.5, '#0d0418'); plate.addColorStop(1, '#1a0d31');
  ctx.fillStyle = plate; ctx.fill();
  ctx.save(); shape(0); ctx.clip();
  hairlines(ctx, x, y, w, h, { step: 5, angle: -0.3, alpha: 0.05 });
  ctx.restore();
  shape(0);
  ctx.strokeStyle = champagne(ctx, y, y + h); ctx.lineWidth = 3.2; ctx.stroke();
  shape(9);
  ctx.strokeStyle = 'rgba(232,207,162,0.22)'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
  embossText(ctx, label, cx, cy + h * 0.19, {
    size: h * 0.5, weight: 600, ls: 5, fill: champagne(ctx, cy - h * 0.32, cy + h * 0.24),
    depth: 2.4, bed: 'rgba(0,0,0,0.85)', rim: 'rgba(255,246,220,0.22)',
  });
}

export function drawFront(logo) {
  const c = cv(W, H), ctx = c.getContext('2d');
  ctx.save();
  silhouette(ctx); ctx.clip();
  satinBase(ctx);

  const flap = H * FLAP_FRAC, seam = H * SEAM_FRAC;

  // ---- body architecture (below the seam) -------------------------------
  debossedArchitecture(ctx, 40, seam + 26, W - 80, H - seam - flap - 62);

  // ---- header ----------------------------------------------------------
  embossText(ctx, 'GRAILHAUS', W / 2, 128, {
    size: 56, weight: 600, ls: 7, fill: champagne(ctx, 86, 134),
    depth: 2.6, bed: 'rgba(0,0,0,0.8)', rim: 'rgba(255,246,220,0.26)',
  });
  T(ctx, 'COLLECTOR CARD GAME', W / 2, 158, {
    size: 14, weight: 600, ls: 7, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.7)',
  });
  // series rule
  ctx.save();
  ctx.strokeStyle = 'rgba(232,207,162,0.38)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(W / 2 - 150, 182); ctx.lineTo(W / 2 - 56, 182); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(W / 2 + 56, 182); ctx.lineTo(W / 2 + 150, 182); ctx.stroke();
  ctx.restore();
  T(ctx, 'SERIES I', W / 2, 188, {
    size: 14, weight: 600, ls: 6, family: 'ui-monospace, Menlo, monospace', fill: CH,
  });

  // set badge, top right
  const bw = 96, bh = 38, bx = W - 34 - bw, by = 84;
  ctx.save();
  rr(ctx, bx, by, bw, bh, 6);
  ctx.fillStyle = 'rgba(8,3,18,0.9)'; ctx.fill();
  ctx.strokeStyle = champagne(ctx, by, by + bh); ctx.lineWidth = 2; ctx.stroke();
  rr(ctx, bx + 5, by + 5, bw - 10, bh - 10, 4);
  ctx.strokeStyle = 'rgba(232,207,162,0.22)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  T(ctx, 'S\u00b71a', bx + bw / 2, by + 27, {
    size: 22, weight: 600, ls: 1, fill: champagne(ctx, by + 6, by + 34),
  });

  // side micro type
  ['MORE', 'THAN', 'CARDS'].forEach((l, i) => T(ctx, l, 30, 232 + i * 20, {
    size: 11, weight: 600, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(232,207,162,0.46)', align: 'left',
  }));
  ['A HIGHER', 'REALM', 'AWAITS'].forEach((l, i) => T(ctx, l, W - 30, 232 + i * 20, {
    size: 11, weight: 600, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(232,207,162,0.46)', align: 'right',
  }));

  // ---- medallion -------------------------------------------------------
  medallion(ctx, W / 2, seam + 300, 236, logo);

  // ---- edition plate ---------------------------------------------------
  editionPlate(ctx, W / 2, seam + 596, 500, 92, 'VAULT BREAK');
  T(ctx, 'PREMIUM COLLECTOR PACK', W / 2, seam + 672, {
    size: 15, weight: 600, ls: 7, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.56)',
  });

  // rarity ladder line
  const ly = seam + 716;
  T(ctx, 'CORE', W / 2 - 150, ly, {
    size: 13, weight: 600, ls: 4, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(232,207,162,0.5)',
  });
  T(ctx, 'PRIME', W / 2, ly, {
    size: 13, weight: 600, ls: 4, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(232,207,162,0.66)',
  });
  T(ctx, 'GRAIL', W / 2 + 150, ly, {
    size: 13, weight: 600, ls: 4, family: 'ui-monospace, Menlo, monospace', fill: CH,
  });
  ctx.save();
  ctx.fillStyle = 'rgba(232,207,162,0.3)';
  [-75, 75].forEach((d) => ctx.fillRect(W / 2 + d, ly - 10, 1, 12));
  ctx.restore();

  // ---- foot -----------------------------------------------------------
  T(ctx, '6 CARDS INSIDE', W / 2, H - 118, {
    size: 17, weight: 600, ls: 8, family: 'ui-monospace, Menlo, monospace',
    fill: champagne(ctx, H - 138, H - 110),
  });

  crimpBand(ctx, 0, flap, true);
  crimpBand(ctx, H - flap, H, false);
  tearChannel(ctx, seam);
  ctx.restore();
  return c;
}

export function drawBack() {
  const c = cv(W, H), ctx = c.getContext('2d');
  ctx.save();
  silhouette(ctx); ctx.clip();
  satinBase(ctx);
  const flap = H * FLAP_FRAC, seam = H * SEAM_FRAC;

  // security guilloche, kept faint so the back stays quiet
  ctx.save();
  ctx.globalAlpha = 0.4;
  guilloche(ctx, W / 2, H * 0.44, { r: 250, lobes: 13, lines: 26, ripple: 0.14, stroke: 'rgba(232,207,162,0.22)' });
  guilloche(ctx, W / 2, H * 0.44, { r: 132, lobes: 7, lines: 16, turns: 3, ripple: 0.2, stroke: 'rgba(180,140,255,0.24)' });
  ctx.restore();

  T(ctx, 'GRAILHAUS \u00b7 SERIES I', W / 2, 132, {
    size: 22, weight: 600, ls: 9, family: 'ui-monospace, Menlo, monospace',
    fill: metalFill(ctx, 112, 138),
  });
  T(ctx, 'CERTIFIED COLLECTOR PACKAGING', W / 2, 164, {
    size: 12, weight: 600, ls: 5, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.44)',
  });

  // authentication frame
  const ax = 56, ay = seam + 40, aw = W - 112, ah = H - seam - flap - 96;
  ctx.save();
  rr(ctx, ax, ay, aw, ah, 10);
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 5; ctx.stroke();
  rr(ctx, ax, ay, aw, ah, 10);
  ctx.strokeStyle = 'rgba(232,207,162,0.3)'; ctx.lineWidth = 1.4; ctx.stroke();
  rr(ctx, ax + 10, ay + 10, aw - 20, ah - 20, 6);
  ctx.strokeStyle = 'rgba(232,207,162,0.14)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();

  // metallic linework: a surveyed grid across the middle
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 1; i < 6; i++) {
    const y = ay + (ah * i) / 6;
    ctx.strokeStyle = 'rgba(232,207,162,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax + 18, y); ctx.lineTo(ax + aw - 18, y); ctx.stroke();
  }
  ctx.restore();

  // edition mark
  editionPlate(ctx, W / 2, ay + 108, 420, 74, 'VAULT BREAK');
  T(ctx, 'TIER II \u00b7 COLLECTOR LUXURY', W / 2, ay + 170, {
    size: 13, weight: 600, ls: 6, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(232,207,162,0.52)',
  });

  // authentication data columns
  const cy0 = ay + 226;
  const rows = [
    ['CONTENTS', '6 COLLECTOR CARDS'],
    ['GUARANTEE', '1 PRIME OR ABOVE'],
    ['SEALED', 'AT SOURCE \u00b7 GH ATELIER'],
    ['AUTH', 'VB\u2011S1A\u201100486'],
  ];
  rows.forEach(([k, v], i) => {
    const y = cy0 + i * 40;
    T(ctx, k, ax + 40, y, {
      size: 12, weight: 600, ls: 4, family: 'ui-monospace, Menlo, monospace',
      fill: 'rgba(232,207,162,0.5)', align: 'left',
    });
    T(ctx, v, ax + aw - 40, y, {
      size: 13, weight: 600, ls: 2, family: 'ui-monospace, Menlo, monospace',
      fill: 'rgba(244,236,224,0.72)', align: 'right',
    });
    ctx.save();
    ctx.strokeStyle = 'rgba(232,207,162,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax + 40, y + 12); ctx.lineTo(ax + aw - 40, y + 12); ctx.stroke();
    ctx.restore();
  });

  // micro typography block + collection identifier
  microBlock(ctx, ax + 40, cy0 + 176, aw - 80, 7, { alpha: 0.2 });
  T(ctx, 'COLLECTION \u00b7 THE COLLECTOR\u2019S VAULT', W / 2, cy0 + 258, {
    size: 13, weight: 600, ls: 5, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(232,207,162,0.55)',
  });

  barcode(ctx, W / 2 - 96, H - 176, 192, 54, { bg: 'rgba(244,236,224,0.86)', ink: INK, seed: 41 });
  T(ctx, 'VB \u00b7 S1A \u00b7 006', W / 2, H - 104, {
    size: 12, weight: 600, ls: 5, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.4)',
  });

  crimpBand(ctx, 0, flap, true);
  crimpBand(ctx, H - flap, H, false);
  tearChannel(ctx, seam);
  ctx.restore();
  return c;
}

// The inner liner: brushed champagne metal on a dark web. It is the material
// itself that reads premium, so this is a straight anisotropic metal sheet.
export function drawLiner() {
  const w = 512, h = 512;
  const c = cv(w, h), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, w, 0);
  [[0, '#171021'], [0.14, '#4a3d28'], [0.3, '#a08a5c'], [0.42, '#e2cfa4'],
    [0.5, '#f6ead0'], [0.58, '#cbb37e'], [0.72, '#7a683f'], [0.88, '#2e2618'],
    [1, '#100c14']].forEach(([p, col]) => g.addColorStop(p, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  hairlines(ctx, 0, 0, w, h, { step: 3, angle: Math.PI / 2, alpha: 0.1 });
  const v = ctx.createLinearGradient(0, 0, 0, h);
  v.addColorStop(0, 'rgba(255,255,255,0.14)');
  v.addColorStop(0.4, 'rgba(0,0,0,0.1)');
  v.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  return c;
}

// Controlled specular sweep for the seam while the user pulls. Champagne,
// not rainbow: the metal responds, it does not glow.
export function drawShine() {
  const c = cv(1024, 64), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1024, 0);
  [[0, 'rgba(0,0,0,0)'], [0.36, 'rgba(90,64,20,0.22)'], [0.46, '#d9c08a'],
    [0.5, '#fff6e0'], [0.54, '#cfae72'], [0.64, 'rgba(90,64,20,0.22)'],
    [1, 'rgba(0,0,0,0)']].forEach(([p, col]) => g.addColorStop(p, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 64);
  const f = ctx.createLinearGradient(0, 0, 0, 64);
  [[0, 'rgba(0,0,0,1)'], [0.34, 'rgba(0,0,0,0.3)'], [0.5, 'rgba(0,0,0,0)'],
    [0.66, 'rgba(0,0,0,0.3)'], [1, 'rgba(0,0,0,1)']].forEach(([p, col]) => f.addColorStop(p, col));
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = f; ctx.fillRect(0, 0, 1024, 64);
  return c;
}
