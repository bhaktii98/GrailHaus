// GrailHaus collector card faces. Portfolio objects: rarity ribbon, valuation
// block with live sparkline, authentication seal, serial, collector line.
// Artwork is abstract and swappable — the reveal engine never depends on a
// particular card, so real art can drop into `art` per entry.

import { cv, T, rr, metalFill, hairlines, guilloche, microBlock } from './art-util.js';

const CW = 620, CH = 868;
const IVORY = '#f4ece0';
const CH_C = '#e8cf9a';

export const RARITY = {
  CORE:  { label: 'CORE',  ink: '#c9c3d6', ribbon: ['#2a2733', '#6d6879', '#2a2733'], glow: 0.0,  metal: 0.22 },
  PRIME: { label: 'PRIME', ink: '#f4ece0', ribbon: ['#33280f', '#b99b57', '#33280f'], glow: 0.35, metal: 0.42 },
  GRAIL: { label: 'GRAIL', ink: '#fff6e0', ribbon: ['#4a2f0c', '#f0d79c', '#4a2f0c'], glow: 1.0,  metal: 0.62 },
};

// Deterministic pseudo-random so a card looks the same every time it is drawn.
const rng = (seed) => {
  let s = seed * 2654435761 % 2147483647;
  return () => ((s = (s * 48271) % 2147483647) / 2147483647);
};

// Abstract vault-geometry artwork. Replaceable: pass `art` on a card entry.
function vaultArt(ctx, x, y, w, h, card) {
  const r = rng(card.seed);
  ctx.save();
  rr(ctx, x, y, w, h, 8); ctx.clip();

  const bg = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  bg.addColorStop(0, '#0d0620'); bg.addColorStop(0.5, card.tint); bg.addColorStop(1, '#050310');
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);

  const cx = x + w / 2, cy = y + h * 0.5;

  // depth haze
  const haze = ctx.createRadialGradient(cx, cy - h * 0.1, 0, cx, cy, w * 0.75);
  haze.addColorStop(0, 'rgba(180,140,255,0.24)');
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = haze; ctx.fillRect(x, y, w, h);

  // architectural arcs receding into the frame
  for (let i = 6; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.22, i * w * 0.1, Math.PI, 0);
    ctx.strokeStyle = `rgba(232,207,162,${0.05 + i * 0.035})`;
    ctx.lineWidth = 1.4 + i * 0.5;
    ctx.stroke();
  }

  // faint guilloche as a security watermark inside the art
  ctx.save();
  ctx.globalAlpha = 0.3;
  guilloche(ctx, cx, cy, { r: w * 0.42, lobes: 9, lines: 14, turns: 4, stroke: 'rgba(232,207,162,0.2)' });
  ctx.restore();

  // the subject: a chamfered monolith form, champagne-edged
  const mw = w * 0.3, mh = h * 0.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - mh * 0.62);
  ctx.lineTo(cx + mw * 0.5, cy - mh * 0.3);
  ctx.lineTo(cx + mw * 0.5, cy + mh * 0.42);
  ctx.lineTo(cx, cy + mh * 0.6);
  ctx.lineTo(cx - mw * 0.5, cy + mh * 0.42);
  ctx.lineTo(cx - mw * 0.5, cy - mh * 0.3);
  ctx.closePath();
  const face = ctx.createLinearGradient(cx - mw * 0.5, cy, cx + mw * 0.5, cy);
  face.addColorStop(0, 'rgba(255,255,255,0.08)');
  face.addColorStop(0.4, 'rgba(255,246,224,0.42)');
  face.addColorStop(0.52, 'rgba(150,140,170,0.22)');
  face.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = face; ctx.fill();
  ctx.strokeStyle = 'rgba(232,207,162,0.8)'; ctx.lineWidth = 2; ctx.stroke();

  // scattered highlights
  for (let i = 0; i < 46; i++) {
    const px = x + r() * w, py = y + r() * h;
    ctx.globalAlpha = 0.1 + r() * 0.4;
    ctx.fillStyle = i % 5 ? '#fff' : CH_C;
    ctx.fillRect(px, py, 1 + (i % 4 === 0 ? 1 : 0), 1);
  }
  ctx.globalAlpha = 1;

  // contact glow at the base
  const gl = ctx.createRadialGradient(cx, cy + h * 0.3, 0, cx, cy + h * 0.3, w * 0.46);
  gl.addColorStop(0, `rgba(${card.glowRGB},0.4)`);
  gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, cy, w, h);

  hairlines(ctx, x, y, w, h, { step: 4, angle: -0.5, alpha: 0.03 });
  ctx.restore();
}

function sparkline(ctx, x, y, w, h, series, up) {
  const min = Math.min(...series), max = Math.max(...series);
  const sx = (i) => x + (i / (series.length - 1)) * w;
  const sy = (v) => y + h - ((v - min) / Math.max(1e-6, max - min)) * h;
  ctx.save();
  // fill under the curve
  ctx.beginPath();
  ctx.moveTo(sx(0), sy(series[0]));
  series.forEach((v, i) => ctx.lineTo(sx(i), sy(v)));
  ctx.lineTo(sx(series.length - 1), y + h);
  ctx.lineTo(sx(0), y + h);
  ctx.closePath();
  const f = ctx.createLinearGradient(0, y, 0, y + h);
  f.addColorStop(0, up ? 'rgba(126,214,164,0.32)' : 'rgba(214,126,140,0.3)');
  f.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = f; ctx.fill();
  // the curve
  ctx.beginPath();
  series.forEach((v, i) => (i ? ctx.lineTo(sx(i), sy(v)) : ctx.moveTo(sx(i), sy(v))));
  ctx.strokeStyle = up ? '#7ed6a4' : '#d67e8c';
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  // head dot
  ctx.beginPath();
  ctx.arc(sx(series.length - 1), sy(series[series.length - 1]), 3.2, 0, 7);
  ctx.fillStyle = up ? '#a8ecc6' : '#eca8b4'; ctx.fill();
  ctx.restore();
}

export function drawCardFace(card) {
  const c = cv(CW, CH), ctx = c.getContext('2d');
  const rar = RARITY[card.rarity];

  // card stock
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  g.addColorStop(0, '#150a28'); g.addColorStop(0.5, '#241041'); g.addColorStop(1, '#0b0518');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  hairlines(ctx, 0, 0, CW, CH, { step: 6, angle: -0.4, alpha: 0.035 });

  // foil edge band, weight tied to rarity
  ctx.strokeStyle = rar.ribbon[1]; ctx.lineWidth = 10 + rar.glow * 4;
  ctx.strokeRect(6, 6, CW - 12, CH - 12);
  ctx.strokeStyle = 'rgba(244,236,224,0.26)'; ctx.lineWidth = 1.4;
  ctx.strokeRect(22, 22, CW - 44, CH - 44);

  // ---- rarity ribbon ---------------------------------------------------
  const rx = 40, ry = 42, rw = CW - 80, rh = 38;
  const rg = ctx.createLinearGradient(rx, 0, rx + rw, 0);
  rg.addColorStop(0, rar.ribbon[0]); rg.addColorStop(0.5, rar.ribbon[1]); rg.addColorStop(1, rar.ribbon[2]);
  ctx.fillStyle = rg; ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(rx, ry, rw, rh);
  T(ctx, `${rar.label} \u00b7 ${card.edition}`, rx + rw / 2, ry + 26, {
    size: 17, weight: 700, ls: 7, family: 'ui-monospace, Menlo, monospace',
    fill: rar.glow > 0.5 ? '#1a0f2e' : '#f0ece4',
  });

  // ---- name ------------------------------------------------------------
  T(ctx, card.name, CW / 2, ry + 96, {
    size: 44, weight: 600, ls: 1, fill: IVORY, shadow: 'rgba(0,0,0,0.6)',
  });
  T(ctx, `GRAILHAUS \u00b7 SERIES I \u00b7 ${card.finish}`, CW / 2, ry + 124, {
    size: 14, weight: 600, ls: 5, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.48)',
  });

  // ---- art window ------------------------------------------------------
  const ax = 48, ay = 212, aw = CW - 96, ah = 372;
  (card.art || vaultArt)(ctx, ax, ay, aw, ah, card);
  rr(ctx, ax, ay, aw, ah, 8);
  ctx.strokeStyle = 'rgba(232,207,162,0.5)'; ctx.lineWidth = 2; ctx.stroke();

  // ---- valuation block -------------------------------------------------
  const vy = ay + ah + 30;
  const vh = 148;
  ctx.fillStyle = 'rgba(5,3,12,0.72)'; ctx.fillRect(48, vy, CW - 96, vh);
  ctx.strokeStyle = 'rgba(232,207,162,0.18)'; ctx.lineWidth = 1.4;
  ctx.strokeRect(48, vy, CW - 96, vh);

  T(ctx, 'EST. VALUE', 70, vy + 30, {
    size: 13, weight: 600, ls: 4, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.44)', align: 'left',
  });
  T(ctx, card.value, 70, vy + 74, { size: 40, weight: 600, fill: IVORY, align: 'left' });
  const up = card.delta >= 0;
  T(ctx, `${up ? '\u25B2' : '\u25BC'} ${Math.abs(card.delta).toFixed(1)}%`, CW - 70, vy + 36, {
    size: 22, weight: 700, ls: 1, fill: up ? '#7ed6a4' : '#d67e8c', align: 'right',
  });
  T(ctx, '30D', CW - 70, vy + 60, {
    size: 12, weight: 600, ls: 4, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.38)', align: 'right',
  });
  sparkline(ctx, CW - 250, vy + 70, 180, 40, card.spark, up);
  T(ctx, card.held, 70, vy + 128, {
    size: 13, weight: 600, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.38)', align: 'left',
  });

  // ---- footer: authentication ------------------------------------------
  const fy = CH - 50;
  ctx.strokeStyle = 'rgba(232,207,162,0.16)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(48, fy - 26); ctx.lineTo(CW - 48, fy - 26); ctx.stroke();
  T(ctx, 'GRAILHAUS', 48, fy, {
    size: 19, weight: 600, ls: 5, fill: 'rgba(244,236,224,0.78)', align: 'left',
  });
  T(ctx, card.serial, CW - 48, fy, {
    size: 14, weight: 600, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.44)', align: 'right',
  });
  // authentication seal
  ctx.save();
  ctx.beginPath(); ctx.arc(CW / 2, fy - 7, 15, 0, 7);
  ctx.strokeStyle = CH_C; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(CW / 2, fy - 7, 11, 0, 7);
  ctx.strokeStyle = 'rgba(232,207,162,0.34)'; ctx.lineWidth = 1; ctx.stroke();
  T(ctx, '\u2713', CW / 2, fy - 1, { size: 15, weight: 700, fill: CH_C });
  ctx.restore();
  return c;
}

// Shared card verso — collector artifact, no per-card data.
export function drawCardVerso() {
  const c = cv(CW, CH), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, CW, CH);
  g.addColorStop(0, '#100722'); g.addColorStop(0.5, '#1f0f3a'); g.addColorStop(1, '#08040f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  hairlines(ctx, 0, 0, CW, CH, { step: 5, angle: 0.42, alpha: 0.04 });

  ctx.strokeStyle = '#6f5a2c'; ctx.lineWidth = 10;
  ctx.strokeRect(6, 6, CW - 12, CH - 12);
  ctx.strokeStyle = 'rgba(232,207,162,0.2)'; ctx.lineWidth = 1.2;
  ctx.strokeRect(24, 24, CW - 48, CH - 48);

  ctx.save();
  ctx.globalAlpha = 0.55;
  guilloche(ctx, CW / 2, CH * 0.46, { r: 214, lobes: 12, lines: 24, stroke: 'rgba(232,207,162,0.2)' });
  guilloche(ctx, CW / 2, CH * 0.46, { r: 112, lobes: 6, lines: 14, turns: 3, stroke: 'rgba(170,132,246,0.22)' });
  ctx.restore();

  ctx.save();
  ctx.translate(CW / 2, CH * 0.46);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    i ? ctx.lineTo(Math.cos(a) * 96, Math.sin(a) * 96) : ctx.moveTo(Math.cos(a) * 96, Math.sin(a) * 96);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,4,18,0.72)'; ctx.fill();
  ctx.strokeStyle = metalFill(ctx, -96, 96); ctx.lineWidth = 3; ctx.stroke();
  T(ctx, 'G', 0, 44, { size: 122, weight: 700, fill: metalFill(ctx, -70, 50) });
  ctx.restore();

  T(ctx, 'GRAILHAUS', CW / 2, 128, {
    size: 30, weight: 600, ls: 8, fill: metalFill(ctx, 100, 134),
  });
  T(ctx, 'COLLECTOR CARD GAME', CW / 2, 158, {
    size: 13, weight: 600, ls: 6, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.5)',
  });
  T(ctx, 'VAULT BREAK \u00b7 SERIES I', CW / 2, CH - 148, {
    size: 15, weight: 600, ls: 7, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(232,207,162,0.62)',
  });
  microBlock(ctx, CW / 2 - 120, CH - 122, 240, 4, { alpha: 0.18 });
  T(ctx, 'THE COLLECTOR\u2019S VAULT', CW / 2, CH - 58, {
    size: 12, weight: 600, ls: 5, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,236,224,0.34)',
  });
  return c;
}

// The Vault Break deck: 6 cards, one Grail. Data only — swap freely.
export function vaultBreakDeck() {
  const d = [
    { name: 'Atrium Cipher', rarity: 'CORE', edition: '1 OF 2,400', finish: 'MATTE',
      value: '$182.00', delta: 2.1, tint: '#1d1030', glowRGB: '120,80,200', seed: 11,
      serial: 'GH\u20110451\u2011AC', held: 'HELD SINCE 04 MAR \u00b7 PAID $164.00',
      spark: [150, 152, 149, 156, 161, 158, 166, 170, 176, 182] },
    { name: 'Ledger Sentinel', rarity: 'CORE', edition: '1 OF 2,400', finish: 'MATTE',
      value: '$204.50', delta: -1.4, tint: '#1a1230', glowRGB: '100,90,210', seed: 23,
      serial: 'GH\u20110452\u2011LS', held: 'HELD SINCE 19 APR \u00b7 PAID $198.00',
      spark: [214, 219, 216, 210, 208, 212, 206, 202, 205, 204] },
    { name: 'Assay Warden', rarity: 'CORE', edition: '1 OF 2,400', finish: 'SATIN',
      value: '$248.00', delta: 3.6, tint: '#221037', glowRGB: '140,90,220', seed: 37,
      serial: 'GH\u20110453\u2011AW', held: 'HELD SINCE 27 MAY \u00b7 PAID $221.00',
      spark: [206, 212, 218, 224, 221, 230, 236, 240, 244, 248] },
    { name: 'Bullion Rite', rarity: 'PRIME', edition: '1 OF 480', finish: 'FOIL',
      value: '$640.00', delta: 5.2, tint: '#2a1442', glowRGB: '180,140,255', seed: 53,
      serial: 'GH\u20110454\u2011BR', held: 'HELD SINCE 11 JUN \u00b7 PAID $560.00',
      spark: [520, 534, 548, 552, 566, 580, 596, 612, 626, 640] },
    { name: 'Vault Regent', rarity: 'PRIME', edition: '1 OF 480', finish: 'FOIL',
      value: '$715.00', delta: 4.4, tint: '#2d1546', glowRGB: '190,150,255', seed: 71,
      serial: 'GH\u20110455\u2011VR', held: 'HELD SINCE 02 JUL \u00b7 PAID $648.00',
      spark: [612, 620, 634, 648, 656, 668, 682, 694, 706, 715] },
    { name: 'The Keyholder', rarity: 'GRAIL', edition: '1 OF 25', finish: 'PRISM FOIL',
      value: '$4,180.00', delta: 8.9, tint: '#35184f', glowRGB: '232,207,162', seed: 97,
      serial: 'GH\u20110456\u2011KH', held: 'HELD SINCE 08 SEP \u00b7 PAID $3,640.00',
      spark: [3320, 3390, 3460, 3520, 3660, 3740, 3880, 3980, 4090, 4180] },
  ];
  return d;
}
