// Reveal profiles — the whole personality of a reveal as data.
//
// The sequence engine (sequence-reveal.js) reads one of these and nothing
// else. Everything a tier can differ by lives here: card count comes from the
// server result, and reveal order, timing curves, camera moves, lighting,
// rarity presentation, haptic track and bulk pacing are configuration.
//
// Adding Vault Break / Black Label (or a third category) is a new entry in
// this file plus its art — not a second engine. The stubs at the bottom show
// the shape; they are deliberately not wired into a page yet.

// --- easing library -------------------------------------------------------
// Named so profiles read as intent ("slowBurn"), not as magic numbers.
export const EASE = {
  linear: (t) => t,
  // entry-tier snap: most of the distance in the first third
  snap: (t) => 1 - Math.pow(1 - t, 5),
  quick: (t) => 1 - Math.pow(1 - t, 3.2),
  smooth: (t) => t * t * t * (t * (t * 6 - 15) + 10),
  // pulls back a hair before committing — reads as weight
  anticipate: (t) => (t < 0.22
    ? -0.10 * Math.sin((t / 0.22) * Math.PI)
    : -0.10 * 0 + (1 - Math.pow(1 - (t - 0.22) / 0.78, 3))),
  // grail: creeps, stalls at two-thirds, then releases
  slowBurn: (t) => (t < 0.34 ? 0.30 * Math.pow(t / 0.34, 1.9)
    : t < 0.56 ? 0.30 + 0.06 * ((t - 0.34) / 0.22)
      : 0.36 + 0.64 * (1 - Math.pow(1 - (t - 0.56) / 0.44, 2.6))),
  // the withheld card: turns to exactly edge-on and holds there — you can
  // see it is foil, you cannot see what it is — then completes
  withhold: (t) => (t < 0.30 ? 0.5 * (1 - Math.pow(1 - t / 0.30, 2.4))
    : t < 0.62 ? 0.5
      : 0.5 + 0.5 * (1 - Math.pow(1 - (t - 0.62) / 0.38, 2.8))),
};

// --- haptic tracks: [pulseMs, gapMs] ---------------------------------------
const HAPTICS = {
  seamTick: [[5, 0]],
  tearFree: [[26, 40], [14, 0]],
  // a card leaving the stack
  cardMove: [[7, 0]],
  // it clears the stack lip — the moment it becomes "yours"
  cardClear: [[16, 0]],
  faceCore: [[12, 0]],
  // prime: two-stage, heavier landing
  chargePrime: [[9, 90], [12, 70], [16, 50]],
  facePrime: [[22, 46], [34, 0]],
  // grail: escalation, hold, then the strongest impact in the app
  chargeGrail: [[6, 150], [8, 120], [10, 96], [13, 76], [17, 58],
    [22, 44], [28, 32], [36, 24], [46, 18]],
  faceGrail: [[70, 60], [110, 0]],
  dock: [[6, 0]],
  complete: [[18, 60], [18, 60], [46, 0]],
};

// --- Tier I — Street Rip ---------------------------------------------------
// Fast, energetic, addictive. Cores are over in about a second; the contrast
// is what makes card 5 land.
export const STREET_RIP = {
  id: 'street-rip',
  cardCount: 5,
  // 'server' = reveal in the exact order the server persisted. Never sorted
  // on the client — the client must not imply anything about the result.
  order: 'server',

  pacing: {
    // beats between the tear finishing and card 1 leaving the stack
    settle: 0.45,
    stackRise: 0.55,
    // 'manual' = the user taps to move on once a card has had its minimum
    // hold. Bulk pacing flips this to 'auto'.
    advance: 'manual',
    // holding the card longer the deeper into the pack you get: position 5
    // is the tension point regardless of what it turns out to be
    positionBias: [1, 1, 1.08, 1.18, 1.34],
    // an extra charge beat on the last card, whatever its rarity
    finalCardCharge: 0.28,
    // The tell is withheld: during the charge the light is colourless, so a
    // build-up is a maybe rather than an announcement. Rarity colour and the
    // rarity word arrive with the face.
    tell: 'late',
    tellColour: 0xc3d2ff,
    // every charge looks the same while it is building; only the flip says
    // which one it was
    buildLevel: { dim: 0.55, glow: 1.15 },
    // False peak: one common in the middle of the pack gets a short charge
    // that resolves to nothing. Chosen from the card's own seed, so it is
    // identical on resume and never re-rolled.
    falsePeak: { slots: [2, 3], charge: 0.34 },
  },

  camera: {
    // distance from the presented card, per step
    idle: { dist: 0.218, y: 0.006, speed: 2.6 },
    stack: { dist: 0.196, y: 0.030, speed: 2.4 },
    present: { dist: 0.150, y: 0.044, speed: 3.0 },
    charge: { dist: 0.138, y: 0.044, speed: 1.2 },
    hold: { dist: 0.152, y: 0.044, speed: 2.2 },
  },

  rarity: {
    CORE: {
      timing: { draw: 0.26, clear: 0.20, charge: 0, flip: 0.30, hold: 0.42, dock: 0.30 },
      ease: { draw: 'snap', clear: 'snap', flip: 'quick', dock: 'quick' },
      light: { key: 1.9, rim: 0.10, glow: 0.10, dim: 0.10, colour: 0x9aa4c4 },
      haptics: { charge: null, face: 'faceCore' },
      autoHold: 0.35,     // used when pacing.advance === 'auto'
      word: null,          // no rarity callout for commons
    },
    PRIME: {
      timing: { draw: 0.28, clear: 0.24, charge: 0.55, flip: 0.42, hold: 0.85, dock: 0.34 },
      ease: { draw: 'quick', clear: 'smooth', flip: 'anticipate', dock: 'smooth' },
      light: { key: 1.5, rim: 0.85, glow: 0.9, dim: 0.42, colour: 0xa855f7 },
      haptics: { charge: 'chargePrime', face: 'facePrime' },
      autoHold: 0.7,
      word: 'PRIME',
    },
    GRAIL: {
      timing: { draw: 0.32, clear: 0.30, charge: 1.55, flip: 0.92, hold: 1.5, dock: 0.4 },
      ease: { draw: 'smooth', clear: 'smooth', flip: 'withhold', dock: 'smooth' },
      light: { key: 1.15, rim: 1.9, glow: 2.0, dim: 0.72, colour: 0xffb347 },
      haptics: { charge: 'chargeGrail', face: 'faceGrail' },
      autoHold: 1.2,
      word: 'GRAIL',
    },
  },

  // card positions in pack space (metres, same scale as rip-pack.js)
  layout: {
    stackY: 0.008, queueGap: 0.0009, queueDrop: 0.0016,
    lipY: 0.040, presentY: 0.050, presentZ: 0.030, presentScale: 1.34,
    chargeLift: 0.004, dockScale: 0.42, dockDrop: 0.052, dockX: -0.030,
    sway: 0.018,
  },

  haptics: HAPTICS,
};

// --- bulk pacing ------------------------------------------------------------
// Bulk is a pacing overlay on the same profile, never a second engine:
// `withPacing(STREET_RIP, BULK_10)`.
export const BULK_10 = {
  advance: 'auto',
  settle: 0.2,
  stackRise: 0.34,
  // commons compress hard; rares keep their beat so the batch still has peaks
  rarityScale: { CORE: 0.45, PRIME: 0.8, GRAIL: 1 },
  positionBias: [1, 1, 1, 1.05, 1.15],
  finalCardCharge: 0.15,
};

export const withPacing = (profile, pacing = {}) => {
  const scale = pacing.rarityScale || {};
  const rarity = {};
  Object.entries(profile.rarity).forEach(([k, v]) => {
    const s = scale[k] ?? 1;
    rarity[k] = {
      ...v,
      timing: Object.fromEntries(Object.entries(v.timing).map(([n, d]) => [n, d * s])),
      autoHold: v.autoHold * s,
    };
  });
  return {
    ...profile,
    rarity,
    pacing: { ...profile.pacing, ...pacing },
  };
};

// --- Tier II / III stubs ----------------------------------------------------
// Kept intentionally minimal: they inherit Street Rip's structure and only
// state what differs. Not wired to a page yet — Tier II still ships the fan
// reveal in reveal.js.
export const VAULT_BREAK_DRAFT = {
  ...STREET_RIP,
  id: 'vault-break',
  cardCount: 6,
  pacing: { ...STREET_RIP.pacing, settle: 0.7, stackRise: 0.8, positionBias: [1, 1, 1.1, 1.2, 1.3, 1.45] },
};

export const BLACK_LABEL_DRAFT = {
  ...STREET_RIP,
  id: 'black-label',
  cardCount: 6,
  pacing: { ...STREET_RIP.pacing, settle: 0.9, stackRise: 1.0 },
};

export const PROFILES = {
  'street-rip': STREET_RIP,
  'vault-break': VAULT_BREAK_DRAFT,
  'black-label': BLACK_LABEL_DRAFT,
};
