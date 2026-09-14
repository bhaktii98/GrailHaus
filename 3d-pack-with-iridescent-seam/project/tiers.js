// Tier configuration. The engine (rip-pack.js + reveal.js) is shared; tiers
// differ only by the values below. Black Label is deliberately left as a stub
// so there is headroom above Vault Break.

import * as streetArt from './pack-art.js';
import * as vaultArt from './vault-art.js';
import { vaultBreakDeck, drawCardFace, drawCardVerso } from './card-art.js';

const BASE_W = 0.068;

export const TIERS = {
  // TIER 1 — accessible luxury. Existing, shipped behaviour.
  'street-rip': {
    id: 'street-rip',
    name: 'Street Rip',
    tier: 'I',
    cardCount: 5,
    size: { W: BASE_W, H: BASE_W * (1200 / 800), T: 0.016 },
    seamFrac: streetArt.SEAM_FRAC,
    flapFrac: streetArt.FLAP_FRAC,
    art: {
      front: streetArt.drawFront,
      back: streetArt.drawBack,
      shine: streetArt.drawShine,
      cardBack: streetArt.drawCardBack,
    },
    material: { roughness: 0.26, metalness: 0.45, peel: 0.4 },
    tear: { stretch: 0, releaseFrac: 0.88, springK: 46, damping: 0.62, glint: 1 },
    liner: { enabled: false },
    revealProfile: 'immediate',
    riseY: 0.042,
  },

  // TIER 2 — collector luxury. Deeper violet, satin metal, heavier seal,
  // metallic inner liner, six cards, staged reveal with a rarity moment.
  'vault-break': {
    id: 'vault-break',
    name: 'Vault Break',
    tier: 'II',
    cardCount: 6,
    size: { W: BASE_W * 1.03, H: BASE_W * 1.03 * (1200 / 800), T: 0.0185 },
    seamFrac: vaultArt.SEAM_FRAC,
    flapFrac: vaultArt.FLAP_FRAC,
    art: {
      front: vaultArt.drawFront,
      back: vaultArt.drawBack,
      shine: vaultArt.drawShine,
      liner: vaultArt.drawLiner,
    },
    // thicker, denser foil: lower roughness, higher metalness, wider peel
    // front so the sheet gathers rather than flaps
    material: { roughness: 0.19, metalness: 0.62, peel: 0.46 },
    // "substance" comes from a short stretch before the tear starts and a
    // firmer settle — not from making the drag harder to complete
    tear: { stretch: 0.05, releaseFrac: 0.84, springK: 40, damping: 0.72, glint: 0.72 },
    liner: { enabled: true, metalness: 0.95, roughness: 0.22 },
    revealProfile: 'premium',
    riseY: 0.045,
    fan: {
      stepX: 0.0285, angle: 0.155, arcDrop: 0.0045, liftY: 0.024,
      heroZ: 0.026, heroScale: 1.16, grailZ: 0.018,
    },
    reveal: {
      stack: 1.0, hold: 0.6, rise: 0.85, separate: 1.6, settle: 0.8,
      notice: 2.3, approach: 1.7, reveal: 1.5, present: 1.9,
    },
    deck: () => vaultBreakDeck(),
    cardArt: { face: drawCardFace, verso: drawCardVerso },
    palette: {
      violet: '#3a1a6e', plum: '#1b0a33', ink: '#0a0413',
      champagne: '#e8cf9a', champagneHi: '#fbf0d4',
      graphite: '#3a3742', ivory: '#f4ece0',
    },
  },

  // TIER 3 — reserved. Intentionally unimplemented.
  'black-label': null,
};

export const tier = (id) => TIERS[id] || TIERS['street-rip'];
