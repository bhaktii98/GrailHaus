// Shelf inventory. Two categories, three tiers each, per the brief.

export const PACKS = {
  cards: [
    { id: 'glacier', name: 'GLACIER SEAL', tier: 'CASUAL', priceCents: 1000,
      sub: '5 cards - no guarantee', stock: 812, cap: 1000,
      art: ['#E4FBFF', '#59D8FF', '#1668D8', '#062E68'], hero: false, bulk: true },
    { id: 'prism', name: 'PRISM CORE', tier: 'MID', priceCents: 4500,
      sub: '10 cards - 1 holo guaranteed', stock: 128, cap: 500,
      art: ['#FFB3F0', '#C64BFF', '#6420C8', '#2E0B63'], hero: true, bulk: true },
    { id: 'obsidian', name: 'OBSIDIAN KEY', tier: 'HIGH-STAKES', priceCents: 18000,
      sub: '1 graded slab - PSA 8 floor', stock: 22, cap: 120,
      art: ['#FFF0CC', '#E2B45C', '#5C4520', '#120D07'], hero: false, bulk: false },
  ],
  watches: [
    { id: 'steel', name: 'THE STEEL CASE', tier: 'ENTRY', priceCents: 50000,
      sub: '1 watch - Tudor / Omega tier', stock: 40, cap: 200,
      art: ['#F4EFE4', '#9C9184', '#3A342B', '#14110C'], hero: false, bulk: false },
    { id: 'lacquer', name: 'THE LACQUER BOX', tier: 'SIGNATURE', priceCents: 200000,
      sub: '1 watch - Submariner floor', stock: 14, cap: 60,
      art: ['#FFF3D6', '#D8B26A', '#6B4E1E', '#1A1206'], hero: true, bulk: false },
    { id: 'grail', name: 'THE GRAIL VAULT', tier: 'GRAIL', priceCents: 500000,
      sub: '1 watch - Daytona ceiling', stock: 4, cap: 24,
      art: ['#FFF8E4', '#EBC87E', '#7A5A22', '#120C04'], hero: false, bulk: false },
  ],
};

// A ripped pack's contents, commons first, chase last. Server decides this
// at purchase; the client only plays it back.
export const PULL = [
  { name: 'TIDECALLER', tier: 'COMMON', valueCents: 600, rarity: 0,
    art: ['#C9DCE8', '#6C8AA3', '#33455C'] },
  { name: 'CINDERLING', tier: 'COMMON', valueCents: 900, rarity: 0,
    art: ['#F2CDA8', '#B87A4E', '#5E3722'] },
  { name: 'THORNWAKE', tier: 'UNCOMMON', valueCents: 2400, rarity: 0.3,
    art: ['#D6F5B4', '#6FB758', '#2C5A2A'] },
  { name: 'STORMBIND', tier: 'RARE HOLO', valueCents: 91000, rarity: 0.62,
    art: ['#DCE8FF', '#6C8BF5', '#2B2F86'] },
  { name: 'ARCHIVIST', tier: 'CHASE', valueCents: 412000, rarity: 1,
    art: ['#FFF6D8', '#FFC94A', '#E0761A', '#7A2C06'] },
];

export const ODDS = {
  cards: {
    label: 'PRISM CORE - $45',
    rows: [
      { tier: 'Common', pct: 62.0 }, { tier: 'Uncommon', pct: 25.0 },
      { tier: 'Rare', pct: 9.4 }, { tier: 'Holo', pct: 3.2 },
      { tier: 'Chase', pct: 0.4 },
    ],
    evCents: 3190, priceCents: 4500, edge: '29.1%',
  },
  watches: {
    label: 'THE LACQUER BOX - $2,000',
    rows: [
      { tier: 'Entry', pct: 58.0 }, { tier: 'Signature', pct: 31.0 },
      { tier: 'Rare ref.', pct: 9.0 }, { tier: 'Grail', pct: 2.0 },
    ],
    evCents: 148600, priceCents: 200000, edge: '25.7%',
  },
};
