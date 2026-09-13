// Shared canvas drawing helpers for GrailHaus pack + card artwork.
// Tier art modules (pack-art.js = Street Rip, vault-art.js = Vault Break)
// build on these so tiers differ by configuration, not by forked code.

export function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Letter-spaced text with optional stroke/shadow. Returns the run width.
export function T(ctx, text, x, y, o = {}) {
  const {
    size = 40, family = '"Cormorant Garamond", Georgia, serif', weight = 600,
    italic = false, ls = 0, fill = '#f4ece0', align = 'center',
    stroke = null, strokeW = 0, shadow = null, alpha = 1,
  } = o;
  ctx.save();
  ctx.globalAlpha *= alpha;
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

export function measure(ctx, text, o = {}) {
  const { size = 40, family = '"Cormorant Garamond", Georgia, serif', weight = 600, ls = 0 } = o;
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  const chars = [...text];
  const w = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + ls * (chars.length - 1);
  ctx.restore();
  return w;
}

// Embossed type: a dark bed below, a lit rim above, then the metal face.
// Reads as pressed into the substrate rather than printed on it.
export function embossText(ctx, text, x, y, o = {}) {
  const d = o.depth || Math.max(2, (o.size || 40) * 0.045);
  T(ctx, text, x + d, y + d * 1.15, { ...o, fill: o.bed || 'rgba(0,0,0,0.72)', stroke: null, shadow: null });
  T(ctx, text, x - d * 0.6, y - d * 0.7, { ...o, fill: o.rim || 'rgba(255,244,214,0.30)', stroke: null, shadow: null });
  return T(ctx, text, x, y, o);
}

// Brushed metal fill: a multi-stop vertical gradient. `cols` overrides the
// default champagne ramp so the same helper serves gold, plum, graphite.
export function metalFill(ctx, y0, y1, cols) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  const ramp = cols || [
    [0, '#7d6635'], [0.14, '#e8d3a2'], [0.32, '#fbf0d4'],
    [0.5, '#b99b57'], [0.66, '#e9d5a6'], [0.86, '#8d7440'], [1, '#4a3a1a'],
  ];
  ramp.forEach(([p, c]) => g.addColorStop(p, c));
  return g;
}

// Micro-engraved hairlines. Very low contrast on purpose: at pack scale this
// reads as a satin machine finish, not as stripes.
export function hairlines(ctx, x, y, w, h, o = {}) {
  const { step = 6, angle = -0.42, alpha = 0.05, light = '#ffffff', dark = '#000000' } = o;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  const R = Math.hypot(w, h);
  ctx.globalAlpha = alpha;
  for (let i = -R; i < R; i += step) {
    ctx.fillStyle = light; ctx.fillRect(i, -R, 1, R * 2);
    ctx.fillStyle = dark; ctx.fillRect(i + step / 2, -R, 1, R * 2);
  }
  ctx.restore();
}

// Debossed line: pressed groove (dark) with a lit lower lip.
export function grooveLine(ctx, x0, y0, x1, y1, o = {}) {
  const { w = 3, dark = 'rgba(0,0,0,0.6)', lit = 'rgba(255,238,200,0.22)' } = o;
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = dark; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = lit; ctx.lineWidth = Math.max(1, w * 0.4);
  ctx.beginPath(); ctx.moveTo(x0, y0 + w * 0.7); ctx.lineTo(x1, y1 + w * 0.7); ctx.stroke();
  ctx.restore();
}

// Guilloche rosette — the interference pattern used on banknotes and
// certificates. Pure linework, so it stays quiet at small sizes.
export function guilloche(ctx, cx, cy, o = {}) {
  const {
    r = 200, lobes = 11, ripple = 0.16, turns = 5, lines = 34,
    stroke = 'rgba(232,207,162,0.34)', width = 1,
  } = o;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = stroke; ctx.lineWidth = width;
  for (let l = 0; l < lines; l++) {
    const ph = (l / lines) * Math.PI * 2;
    ctx.beginPath();
    for (let i = 0; i <= 220; i++) {
      const a = (i / 220) * Math.PI * 2 * turns;
      const rad = r * (1 - ripple + ripple * Math.cos(a * lobes / turns + ph)) * (0.55 + 0.45 * Math.cos(a / turns / 2 + ph) ** 2);
      const x = Math.cos(a / turns + ph) * rad, y = Math.sin(a / turns + ph) * rad;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

// Column of tiny legal/authentication type — texture, not reading matter.
export function microBlock(ctx, x, y, w, rows, o = {}) {
  const { rowH = 7, alpha = 0.3, fill = '#e8cf9a' } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  for (let r = 0; r < rows; r++) {
    let cx = x;
    while (cx < x + w) {
      const wd = 6 + ((r * 13 + cx) % 5) * 4;
      if (cx + wd > x + w) break;
      ctx.fillRect(cx, y + r * rowH, wd, 2);
      cx += wd + 4;
    }
  }
  ctx.restore();
}

export function barcode(ctx, x, y, w, h, o = {}) {
  const { bg = '#f4ece0', ink = '#0a0413', seed = 7 } = o;
  ctx.fillStyle = bg; ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  let cx = x, s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  while (cx < x + w) {
    const bw = 2 + Math.floor(rnd() * 4);
    ctx.fillStyle = ink;
    ctx.fillRect(cx, y, Math.min(bw, x + w - cx), h);
    cx += bw + 2 + Math.floor(rnd() * 3);
  }
}

// Multi-octave 1D noise, shared by the tear edge and the crumple maps.
export function noise1(x) {
  let v = 0, amp = 1, f = 1;
  for (let o = 0; o < 5; o++) {
    v += amp * Math.sin(x * f * 137.13 + o * 2.7) * Math.cos(x * f * 61.7 + o * 1.3);
    amp *= 0.52; f *= 2.13;
  }
  return v * 0.5;
}
