// Carnage-style pouch artwork: matte black foil, blood-red woodcut art, a
// chrome wordmark band across the middle, TEAR marks + dashed perforation at
// the top seam, barcode and fine print at the foot.

export const SEAM_FRAC = 0.205;   // tear line, from the top
export const FLAP_FRAC = 0.062;   // crimp flap depth
const W = 800, H = 1200;
const TEETH = 13, TOOTH_D = 30;

const GOLD_HI = '#ffe9ac', GOLD = '#d8a93f', GOLD_DK = '#8a621d';
const RED = GOLD, RED_DK = GOLD_DK, RED_HI = GOLD_HI;
const BONE = '#f6eeda';
const VIOLET = '#4a2a86';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function T(ctx, text, x, y, o = {}) {
  const {
    size = 40, family = '"Cormorant Garamond", Georgia, serif', weight = 600,
    italic = false, ls = 0, fill = BONE, align = 'center',
    stroke = null, strokeW = 0, shadow = null,
  } = o;
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = size * 0.4; }
  chars.forEach((ch, i) => {
    if (stroke) {
      ctx.lineWidth = strokeW || size * 0.12;
      ctx.strokeStyle = stroke; ctx.lineJoin = 'round';
      ctx.strokeText(ch, cx, y);
    }
    ctx.fillStyle = fill; ctx.fillText(ch, cx, y);
    cx += widths[i] + ls;
  });
  ctx.restore();
  return total;
}

function goldFill(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, GOLD_HI); g.addColorStop(0.34, GOLD);
  g.addColorStop(0.52, '#b9832c'); g.addColorStop(0.68, GOLD);
  g.addColorStop(1, GOLD_HI);
  return g;
}

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

// matte black base with a cool side sheen; the pouch reads as dark metal
function blackBase(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#0d0618');
  g.addColorStop(0.12, '#1c0e33');
  g.addColorStop(0.3, '#2e1854');
  g.addColorStop(0.5, '#241143');
  g.addColorStop(0.72, '#301a58');
  g.addColorStop(0.9, '#170b2a');
  g.addColorStop(1, '#080310');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const v = ctx.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, 'rgba(255,255,255,0.05)');
  v.addColorStop(0.5, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

function crimpBand(ctx, y0, y1, top) {
  const h = y1 - y0;
  ctx.save();
  // lighter pressed band so the crimp separates from the black body
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  if (top) {
    g.addColorStop(0, '#8a6fc4'); g.addColorStop(0.5, '#4a2f80'); g.addColorStop(1, '#180a2c');
  } else {
    g.addColorStop(0, '#180a2c'); g.addColorStop(0.5, '#4a2f80'); g.addColorStop(1, '#8a6fc4');
  }
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, h);
  // knurled teeth of the sealing jaw
  for (let x = 0; x < W; x += 11) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y0, 4, h);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 5, y0, 4, h);
  }
  // lit edge along the tooth tips, dark shadow where the crimp meets the body
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.fillRect(0, top ? y0 : y1 - 3, W, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, top ? y1 - 5 : y0, W, 5);
  ctx.restore();
}

// TEAR marks in both corners + dashed perforation and the colour strip
function headerBand(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#6b46b0'); g.addColorStop(0.5, '#57389a'); g.addColorStop(1, '#3d2470');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
  const fl = ctx.createLinearGradient(0, y0, W * 0.8, y1);
  fl.addColorStop(0, 'rgba(255,255,255,0)');
  fl.addColorStop(0.36, 'rgba(255,255,255,0.3)');
  fl.addColorStop(0.46, 'rgba(255,255,255,0.05)');
  fl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fl; ctx.fillRect(0, y0, W, y1 - y0);
  ctx.fillStyle = 'rgba(16,6,32,0.5)'; ctx.fillRect(0, y1 - 6, W, 6);
}

function tearZone(ctx, seam) {

  T(ctx, 'TEAR', 58, seam - 22, {
    size: 17, weight: 700, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(255,233,172,0.9)', align: 'left',
  });
  T(ctx, 'TEAR', W - 58, seam - 22, {
    size: 17, weight: 700, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(255,233,172,0.9)', align: 'right',
  });
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 4; ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(246,238,218,0.75)';
  ctx.beginPath(); ctx.moveTo(38, seam - 14); ctx.lineTo(W - 38, seam - 14); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = 'rgba(255,214,130,0.9)'; ctx.shadowBlur = 14;
  const hg = ctx.createLinearGradient(38, 0, W - 38, 0);
  hg.addColorStop(0, '#8a621d'); hg.addColorStop(0.5, '#ffe9ac'); hg.addColorStop(1, '#8a621d');
  ctx.fillStyle = hg;
  ctx.fillRect(38, seam - 1, W - 76, 4);
  ctx.restore();
}

// Woodcut-style claw burst — bold red shapes, no fine detail, so it reads at
// pack scale. Placeholder for real artwork.
function clawMark(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  // ragged red field behind the claws
  ctx.beginPath();
  for (let i = 0; i <= 46; i++) {
    const a = (i / 46) * Math.PI * 2;
    const r = 250 + Math.sin(a * 5) * 42 + Math.sin(a * 11 + 1.2) * 26;
    const x = Math.cos(a) * r, y = Math.sin(a) * r * 1.06;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  const fg = ctx.createRadialGradient(0, -40, 20, 0, 0, 300);
  fg.addColorStop(0, RED_HI); fg.addColorStop(0.55, RED); fg.addColorStop(1, RED_DK);
  ctx.fillStyle = fg; ctx.fill();

  // four slashes cut out of it
  ctx.globalCompositeOperation = 'destination-out';
  for (let k = -1.5; k <= 1.5; k++) {
    ctx.save();
    ctx.rotate(-0.32);
    ctx.beginPath();
    ctx.moveTo(k * 96 - 26, -300);
    ctx.quadraticCurveTo(k * 96 + 44, 0, k * 96 - 10, 300);
    ctx.quadraticCurveTo(k * 96 + 12, 0, k * 96 - 26, -300);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';

  // spatter
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + 0.4;
    const r = 270 + (i % 5) * 34;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, Math.sin(a) * r * 1.1, 3 + (i % 4) * 3.5, 0, 7);
    ctx.fillStyle = i % 3 ? RED : RED_DK; ctx.fill();
  }
  ctx.restore();
}

// brushed chrome band with the wordmark
function chromeBand(ctx, y, h, text) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#7a5a1c');
  g.addColorStop(0.18, '#ffe9ac');
  g.addColorStop(0.36, '#fff6d8');
  g.addColorStop(0.52, '#c9962f');
  g.addColorStop(0.66, '#ffe093');
  g.addColorStop(0.86, '#8a621d');
  g.addColorStop(1, '#3d2a08');
  ctx.fillStyle = g; ctx.fillRect(0, y, W, h);
  // brush streaks
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let x = 0; x < W; x += 5) {
    ctx.fillStyle = x % 10 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 2, h);
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, y, W, 3); ctx.fillRect(0, y + h - 3, W, 3);
  T(ctx, text, W / 2, y + h * 0.72, {
    size: h * 0.62, weight: 600, ls: 3, fill: '#241043', shadow: 'rgba(255,240,200,0.5)',
  });
}

function barcode(ctx, x, y, w, h) {
  ctx.fillStyle = BONE; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  let cx = x;
  while (cx < x + w) {
    const bw = 2 + Math.floor(Math.random() * 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(cx, y, bw, h);
    cx += bw + 2 + Math.floor(Math.random() * 3);
  }
}

export function drawFront(logo) {
  const c = cv(W, H), ctx = c.getContext('2d');
  ctx.save();
  silhouette(ctx); ctx.clip();
  blackBase(ctx);

  const flap = H * FLAP_FRAC, seam = H * SEAM_FRAC;
  headerBand(ctx, 0, seam - 30);
  crimpBand(ctx, 0, flap, true);
  crimpBand(ctx, H - flap, H, false);
  tearZone(ctx, seam);

  // header type
  T(ctx, 'GRAILHAUS', W / 2, 132, {
    size: 58, weight: 700, ls: 3, fill: goldFill(ctx, 92, 136), stroke: '#22103f', strokeW: 8,
  });
  T(ctx, 'COLLECTOR CARD GAME', W / 2, 162, {
    size: 17, weight: 700, ls: 6, fill: '#f0e4ff', stroke: '#22103f', strokeW: 4,
  });
  T(ctx, 'Sealed', W / 2, 198, {
    size: 32, weight: 600, italic: true, fill: '#ffe9ac', stroke: '#22103f', strokeW: 5,
  });
  // set badge
  const bw = 100, bh = 40, bx = W - 30 - bw, by = 86;
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 14); else ctx.rect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(18,7,34,0.85)'; ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  T(ctx, 'S\u00b71a', bx + bw / 2, by + 29, {
    size: 25, weight: 700, ls: 1, fill: goldFill(ctx, by + 6, by + 36),
  });

  // --- art panel: logo inside a rounded gold frame ----------------------
  const px = 56, py = seam + 46, pw = W - 112, ph = pw * 0.98;
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 56); else ctx.rect(px, py, pw, ph);
  ctx.clip();
  const pg = ctx.createLinearGradient(px, py, px, py + ph);
  pg.addColorStop(0, '#160a2c'); pg.addColorStop(1, '#0a0418');
  ctx.fillStyle = pg; ctx.fillRect(px, py, pw, ph);
  if (logo) {
    const s = Math.min(pw, ph) * 1.0;
    ctx.drawImage(logo, px + (pw - s) / 2, py + (ph - s) / 2, s, s);
  } else {
    clawMark(ctx, px + pw / 2, py + ph / 2, 0.8);
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 56); else ctx.rect(px, py, pw, ph);
  ctx.strokeStyle = 'rgba(255,233,172,0.18)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();

  const fy = H - 104;
  const plate = ctx.createLinearGradient(0, fy - 46, 0, fy + 22);
  plate.addColorStop(0, 'rgba(12,4,26,0)');
  plate.addColorStop(0.4, 'rgba(12,4,26,0.72)');
  plate.addColorStop(1, 'rgba(12,4,26,0)');
  ctx.fillStyle = plate; ctx.fillRect(0, fy - 46, W, 68);
  T(ctx, 'THEMED BOOSTER PACK', W / 2, fy, {
    size: 44, weight: 700, ls: 4, fill: goldFill(ctx, fy - 42, fy + 4),
    stroke: '#170826', strokeW: 9, shadow: 'rgba(0,0,0,0.65)',
  });
  ctx.restore();
  return c;
}

export function drawBack() {
  const c = cv(W, H), ctx = c.getContext('2d');
  ctx.save();
  silhouette(ctx); ctx.clip();
  blackBase(ctx);
  const flap = H * FLAP_FRAC, seam = H * SEAM_FRAC;
  crimpBand(ctx, 0, flap, true);
  crimpBand(ctx, H - flap, H, false);
  tearZone(ctx, seam);

  headerBand(ctx, 0, seam - 30);
  T(ctx, 'GRAILHAUS \u00b7 SERIES I', W / 2, 140, {
    size: 24, weight: 700, ls: 8, family: 'ui-monospace, Menlo, monospace',
    fill: goldFill(ctx, 118, 146),
  });
  T(ctx, 'OPEN FROM EITHER SIDE', W / 2, 178, {
    size: 16, weight: 700, ls: 5, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(246,238,218,0.62)',
  });

  // emblem watermark: gold rings + diamond, readable against the violet
  ctx.save();
  ctx.translate(W / 2, H * 0.42);
  ctx.globalAlpha = 0.62;
  [1, 0.78, 0.56].forEach((k) => {
    ctx.beginPath(); ctx.arc(0, 0, 190 * k, 0, 7);
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4 * k; ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(0, -150); ctx.lineTo(96, 0); ctx.lineTo(0, 150); ctx.lineTo(-96, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12,5,26,0.55)'; ctx.fill();
  ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = 0.85;
  T(ctx, 'G', 0, 56, { size: 138, weight: 700, fill: goldFill(ctx, -80, 60) });
  ctx.restore();

  chromeBand(ctx, H * 0.585, 58, 'GRAILHAUS');

  ['CONTENTS: 5 COLLECTOR CARDS', 'ONE FOIL CARD GUARANTEED',
    'SERIES I \u00b7 SEALED AT SOURCE', 'NOT A TOY \u00b7 KEEP SEALED UNTIL PLAY',
  ].forEach((l, i) => T(ctx, l, W / 2, H * 0.71 + i * 38, {
    size: 20, ls: 4, weight: 500, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(240,228,255,0.62)',
  }));

  barcode(ctx, W / 2 - 110, H - 150, 220, 66);
  ctx.restore();
  return c;
}

// Prismatic art: a monolith splitting a beam. Abstract, holo, no mascot.
function prismArt(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, 12); else ctx.rect(x, y, w, h);
  ctx.clip();

  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#07070c'); bg.addColorStop(0.55, '#160b1e'); bg.addColorStop(1, '#04040a');
  ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);

  const cx = x + w / 2, cy = y + h * 0.52;

  // star field
  for (let i = 0; i < 90; i++) {
    const px = x + ((i * 97) % w), py = y + ((i * 191) % h);
    ctx.globalAlpha = 0.15 + ((i * 37) % 60) / 140;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px, py, 1 + (i % 3 === 0 ? 1 : 0), 1 + (i % 3 === 0 ? 1 : 0));
  }
  ctx.globalAlpha = 1;

  // concentric arcs behind the monolith
  for (let i = 5; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.06, i * w * 0.09, Math.PI, 0);
    ctx.strokeStyle = `rgba(216,169,63,${0.06 + i * 0.05})`;
    ctx.lineWidth = 2 + i * 0.6;
    ctx.stroke();
  }

  // incoming beam
  const beam = ctx.createLinearGradient(x, cy - h * 0.18, cx, cy);
  beam.addColorStop(0, 'rgba(255,255,255,0)');
  beam.addColorStop(1, 'rgba(255,255,255,0.75)');
  ctx.strokeStyle = beam; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x, cy - h * 0.18); ctx.lineTo(cx - 4, cy - h * 0.02); ctx.stroke();

  // refracted fan on the far side
  const fan = ['#ff2a3c', '#ff8a1e', '#ffe14d', '#4ce08a', '#4da6ff', '#a45cff'];
  fan.forEach((col, i) => {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = col; ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx + 4, cy - h * 0.01);
    ctx.lineTo(x + w, cy + h * (-0.02 + i * 0.055));
    ctx.stroke();
    ctx.restore();
  });

  // the monolith itself: tall triangle, chrome-edged
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.3);
  ctx.lineTo(cx + w * 0.15, cy + h * 0.22);
  ctx.lineTo(cx - w * 0.15, cy + h * 0.22);
  ctx.closePath();
  const face = ctx.createLinearGradient(cx - w * 0.15, cy, cx + w * 0.15, cy);
  face.addColorStop(0, 'rgba(255,255,255,0.14)');
  face.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  face.addColorStop(0.55, 'rgba(190,190,210,0.3)');
  face.addColorStop(1, 'rgba(255,255,255,0.1)');
  ctx.fillStyle = face; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();

  // ground glow
  const gl = ctx.createRadialGradient(cx, cy + h * 0.24, 0, cx, cy + h * 0.24, w * 0.5);
  gl.addColorStop(0, 'rgba(150,90,255,0.45)');
  gl.addColorStop(1, 'rgba(150,90,255,0)');
  ctx.fillStyle = gl; ctx.fillRect(x, cy, w, h);

  // holo diagonal sweep over the whole window
  const holo = ctx.createLinearGradient(x, y + h, x + w, y);
  holo.addColorStop(0.28, 'rgba(255,255,255,0)');
  holo.addColorStop(0.4, 'rgba(180,140,255,0.14)');
  holo.addColorStop(0.48, 'rgba(255,240,200,0.1)');
  holo.addColorStop(0.6, 'rgba(255,255,255,0)');
  ctx.fillStyle = holo; ctx.fillRect(x, y, w, h);
  ctx.restore();
}

export function drawCardBack() {
  const w = 620, h = 868;
  const c = cv(w, h), ctx = c.getContext('2d');

  // card stock: dark lacquer
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#180c30'); g.addColorStop(0.5, '#28154a'); g.addColorStop(1, '#0e0620');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

  // edge: red foil band with a chrome hairline inside
  ctx.strokeStyle = RED_DK; ctx.lineWidth = 12;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.strokeStyle = 'rgba(244,239,230,0.3)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(22, 22, w - 44, h - 44);

  // --- rarity ribbon ----------------------------------------------------
  const rx = 40, ry = 42, rw = w - 80, rh = 40;
  const rg = ctx.createLinearGradient(rx, 0, rx + rw, 0);
  rg.addColorStop(0, '#5b3a12'); rg.addColorStop(0.5, '#d8a93f'); rg.addColorStop(1, '#5b3a12');
  ctx.fillStyle = rg; ctx.fillRect(rx, ry, rw, rh);
  T(ctx, 'GRAIL \u00b7 1 OF 25', rx + rw / 2, ry + 28, {
    size: 19, weight: 700, ls: 7, family: 'ui-monospace, Menlo, monospace', fill: '#1e0f38',
  });

  // --- name -------------------------------------------------------------
  T(ctx, 'Prism Wraith', w / 2, ry + 96, {
    size: 46, weight: 600, ls: 1, fill: BONE, shadow: 'rgba(0,0,0,0.6)',
  });
  T(ctx, 'TRADING CARDS \u00b7 SERIES I \u00b7 HOLO', w / 2, ry + 126, {
    size: 16, weight: 700, ls: 5, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,239,230,0.5)',
  });

  // --- art window -------------------------------------------------------
  const ax = 48, ay = 216, aw = w - 96, ah = 384;
  prismArt(ctx, ax, ay, aw, ah);
  ctx.strokeStyle = 'rgba(244,239,230,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(ax, ay, aw, ah, 10); else ctx.rect(ax, ay, aw, ah);
  ctx.stroke();

  // --- valuation block --------------------------------------------------
  const vy = ay + ah + 34;
  ctx.fillStyle = 'rgba(6,6,10,0.7)';
  ctx.fillRect(48, vy, w - 96, 142);
  ctx.strokeStyle = 'rgba(246,238,218,0.18)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(48, vy, w - 96, 142);
  T(ctx, 'HELD SINCE 08 SEP \u00b7 PAID $1,390.00', 70, vy + 118, {
    size: 15, weight: 700, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(246,238,218,0.42)', align: 'left',
  });

  T(ctx, 'EST. VALUE', 70, vy + 32, {
    size: 15, weight: 700, ls: 4, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,239,230,0.45)', align: 'left',
  });
  T(ctx, '$1,480.00', 70, vy + 76, {
    size: 44, weight: 600, ls: 0, fill: BONE, align: 'left',
  });
  T(ctx, '\u25B2 6.4%', w - 70, vy + 44, {
    size: 26, weight: 700, ls: 1, fill: '#3ddc84', align: 'right',
  });
  T(ctx, '24H', w - 70, vy + 72, {
    size: 14, weight: 700, ls: 4, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,239,230,0.4)', align: 'right',
  });

  // --- footer: authentication -------------------------------------------
  const fy = h - 52;
  ctx.strokeStyle = 'rgba(244,239,230,0.16)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(48, fy - 26); ctx.lineTo(w - 48, fy - 26); ctx.stroke();
  T(ctx, 'GRAILHAUS', 48, fy, {
    size: 20, weight: 700, ls: 4, fill: 'rgba(244,239,230,0.8)', align: 'left',
  });
  T(ctx, 'GH\u20110014\u2011PW', w - 48, fy, {
    size: 15, weight: 700, ls: 3, family: 'ui-monospace, Menlo, monospace',
    fill: 'rgba(244,239,230,0.45)', align: 'right',
  });
  // authenticated seal
  ctx.beginPath();
  ctx.arc(w / 2, fy - 6, 15, 0, 7);
  ctx.strokeStyle = RED; ctx.lineWidth = 2.5; ctx.stroke();
  T(ctx, '\u2713', w / 2, fy + 1, { size: 18, weight: 700, fill: RED });
  return c;
}

// glint that runs along the tear line while pulling
export function drawShine() {
  const c = cv(1024, 64), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1024, 0);
  [[0, 'rgba(0,0,0,0)'], [0.34, 'rgba(120,30,0,0.3)'], [0.46, '#ffd08a'],
    [0.5, '#ffffff'], [0.54, '#ffb060'], [0.66, 'rgba(120,30,0,0.3)'],
    [1, 'rgba(0,0,0,0)']].forEach(([p, col]) => g.addColorStop(p, col));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 64);
  const f = ctx.createLinearGradient(0, 0, 0, 64);
  f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(0.32, 'rgba(0,0,0,0.25)');
  f.addColorStop(0.5, 'rgba(0,0,0,0)'); f.addColorStop(0.68, 'rgba(0,0,0,0.25)');
  f.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = f; ctx.fillRect(0, 0, 1024, 64);
  return c;
}
