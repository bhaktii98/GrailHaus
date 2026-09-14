// Simulated purchase service.
//
// Stands in for the TypeScript backend: contents are decided ONCE, at
// purchase, from a server-side seed, then persisted verbatim. Every later
// read — replay, resume after process death, the summary page — returns the
// same object. Nothing here is ever re-rolled on the client, and the reveal
// engine has no rarity logic at all: it only presents what this returns.
//
// Money is integer cents everywhere. Never floats.

const SCHEMA = 2;
const KEY = (id) => `gh.pack.${id}`;
const PROGRESS = (id) => `gh.reveal.${id}`;
const CURRENT = 'gh.pack.current';

export const PACK_PRICE_CENTS = 2500;   // Street Rip — $25.00

// Published odds (see README/economics). Position 1–2 are always Core so the
// rhythm is established; rarity climbs toward the fifth card.
export const ODDS = [
  { CORE: 1.0 },
  { CORE: 1.0 },
  { CORE: 0.88, PRIME: 0.12 },
  { CORE: 0.815, PRIME: 0.18, GRAIL: 0.005 },
  { CORE: 0.685, PRIME: 0.30, GRAIL: 0.015 },
];

const STOCK = ['#160a2c', '#2a1050', '#0a0418'];
const GLOW = { CORE: '120,110,190', PRIME: '168,85,247', GRAIL: '240,215,156' };
const base = {
  stock: STOCK, accent: '#e8cf9a', accentRGB: '232,207,162', finish: 'MATTE',
  glowRGB: GLOW.CORE,
};

// Seeded catalog — committed data, not generated at runtime.
export const CATALOG = [
  { ...base, key: 'transit-ledger', name: 'Transit Ledger', rarity: 'CORE', cents: 140, delta: 1.4, tint: '#1a0f2e', seed: 11, spark: [128, 131, 129, 133, 136, 134, 137, 139, 138, 140] },
  { ...base, key: 'night-bus', name: 'Night Bus', rarity: 'CORE', cents: 180, delta: -0.9, tint: '#170d29', seed: 17, spark: [190, 188, 186, 183, 181, 184, 182, 179, 181, 180] },
  { ...base, key: 'payphone-static', name: 'Payphone Static', rarity: 'CORE', cents: 120, delta: 2.2, tint: '#140b24', seed: 23, spark: [108, 110, 112, 111, 114, 116, 115, 118, 119, 120] },
  { ...base, key: 'corner-store', name: 'Corner Store', rarity: 'CORE', cents: 210, delta: 0.8, tint: '#1c1033', seed: 29, spark: [200, 202, 204, 203, 206, 205, 208, 209, 208, 210] },
  { ...base, key: 'pavement-king', name: 'Pavement King', rarity: 'CORE', cents: 260, delta: 3.1, tint: '#1f1238', seed: 31, spark: [232, 236, 240, 238, 245, 249, 252, 255, 258, 260] },
  { ...base, key: 'fire-escape', name: 'Fire Escape', rarity: 'CORE', cents: 310, delta: -1.8, tint: '#1d1130', seed: 37, spark: [330, 326, 322, 319, 315, 318, 314, 311, 313, 310] },
  { ...base, key: 'bodega-neon', name: 'Bodega Neon', rarity: 'CORE', cents: 240, delta: 1.1, tint: '#211440', seed: 41, spark: [228, 230, 233, 231, 235, 236, 238, 237, 239, 240] },

  { ...base, key: 'sunset-arcade', name: 'Sunset Arcade', rarity: 'PRIME', finish: 'FOIL', cents: 980, delta: 4.2, tint: '#2a1450', seed: 53, ribbon: ['#2a1245', '#a06fd8', '#2a1245'], spark: [880, 896, 908, 920, 932, 944, 956, 964, 972, 980] },
  { ...base, key: 'chrome-sprint', name: 'Chrome Sprint', rarity: 'PRIME', finish: 'FOIL', cents: 1250, delta: 5.6, tint: '#2d1656', seed: 59, ribbon: ['#2a1245', '#a06fd8', '#2a1245'], spark: [1080, 1104, 1128, 1150, 1172, 1190, 1210, 1226, 1240, 1250] },
  { ...base, key: 'violet-hour', name: 'Violet Hour', rarity: 'PRIME', finish: 'FOIL', cents: 1800, delta: 3.4, tint: '#33195f', seed: 61, ribbon: ['#2a1245', '#a06fd8', '#2a1245'], spark: [1690, 1706, 1722, 1740, 1752, 1766, 1778, 1786, 1794, 1800] },
  { ...base, key: 'rooftop-signal', name: 'Rooftop Signal', rarity: 'PRIME', finish: 'FOIL', cents: 2150, delta: 6.1, tint: '#361b66', seed: 67, ribbon: ['#2a1245', '#a06fd8', '#2a1245'], spark: [1880, 1920, 1962, 1998, 2032, 2064, 2094, 2118, 2136, 2150] },

  { ...base, key: 'first-rip', name: 'The First Rip', rarity: 'GRAIL', finish: 'PRISM FOIL', cents: 34000, delta: 8.4, tint: '#3b1d6d', seed: 89, ribbon: ['#4a2f0c', '#f0d79c', '#4a2f0c'], tagline: 'Everyone remembers their first', traits: ['Origin', 'Scarcity'], spark: [28800, 29600, 30400, 31200, 31900, 32500, 33100, 33500, 33800, 34000] },
  { ...base, key: 'midnight-haus', name: 'Midnight Haus', rarity: 'GRAIL', finish: 'PRISM FOIL', cents: 45500, delta: 9.7, tint: '#42207a', seed: 97, ribbon: ['#4a2f0c', '#f0d79c', '#4a2f0c'], tagline: 'Own what moves you', traits: ['Origin', 'Ascension'], spark: [37600, 38800, 40100, 41200, 42200, 43000, 43800, 44500, 45100, 45500] },
];

export const money = (cents) => `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

// --- deterministic RNG (server-side; the client never calls this) ----------
const hash = (str) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};
const rng = (seed) => {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};

const pickRarity = (r, table) => {
  let acc = 0; const x = r();
  for (const [rar, p] of Object.entries(table)) { acc += p; if (x < acc) return rar; }
  return 'CORE';
};

function generate(purchaseId) {
  const r = rng(hash(`grailhaus:street-rip:${purchaseId}`));
  const used = new Set();
  const cards = ODDS.map((table, slot) => {
    const rarity = pickRarity(r, table);
    const pool = CATALOG.filter((c) => c.rarity === rarity);
    let pick = pool[Math.floor(r() * pool.length)];
    let guard = 0;
    while (used.has(pick.key) && guard++ < pool.length) {
      pick = pool[Math.floor(r() * pool.length)];
    }
    used.add(pick.key);
    const drift = Math.round(pick.cents * (r() * 0.06 - 0.03));   // bounded
    const cents = pick.cents + drift;
    return {
      ...pick,
      slot,
      cents,
      glowRGB: GLOW[rarity] || GLOW.CORE,
      value: money(cents),
      edition: rarity === 'GRAIL' ? '1 OF 25' : rarity === 'PRIME' ? '1 OF 480' : '1 OF 2,400',
      serial: `GH\u2011${String(1000 + (hash(purchaseId + pick.key) % 8999))}`,
      held: `PULLED ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}`,
      collection: 'Street Rip · Series I',
    };
  });
  return {
    purchaseId,
    tierId: 'street-rip',
    v: SCHEMA,
    priceCents: PACK_PRICE_CENTS,
    cards,
    createdAt: Date.now(),
    // committed at purchase; a real build would publish the hash before the
    // rip and the seed after, so the pull is verifiable
    commit: hash(`commit:${purchaseId}`).toString(16),
  };
}

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } };

/** Idempotent: the same purchaseId always yields the identical stored pack. */
export function purchasePack(purchaseId) {
  const existing = read(KEY(purchaseId));
  if (existing && existing.v === SCHEMA) return existing;
  const pack = generate(purchaseId);
  write(KEY(purchaseId), pack);
  return pack;
}

export const loadPack = (purchaseId) => read(KEY(purchaseId));

export function newPurchaseId() {
  const id = `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
  write(CURRENT, id);
  return id;
}
export const currentPurchaseId = () => read(CURRENT);

/** Reveal progress. Cursor = number of cards already presented and docked. */
export const loadProgress = (id) => read(PROGRESS(id)) || { cursor: 0, torn: false, done: false };
export const saveProgress = (id, patch) => {
  const next = { ...loadProgress(id), ...patch };
  write(PROGRESS(id), next);
  return next;
};

export const packTotals = (pack) => {
  const total = pack.cards.reduce((s, c) => s + c.cents, 0);
  return { total, paid: pack.priceCents, delta: total - pack.priceCents };
};
export const bestPull = (pack) => pack.cards.reduce((a, b) => (b.cents > a.cents ? b : a));
