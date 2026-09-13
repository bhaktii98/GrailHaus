import type { VaultBreakPersonality } from './types';

// Numbers carried over unchanged from the Claude Design handoff
// (project/tiers.js's 'vault-break' entry + project/card-art.js's
// vaultBreakDeck()) so the geometry/art/timing layers below reproduce the
// approved design rather than reinterpreting it. See README's "Vault
// Break" section for what did change (texture resolution, font, gesture
// reinterpretation for touch).
const BASE_W = 0.068;

export const vaultBreakPersonality: VaultBreakPersonality = {
  id: 'vault-break',
  size: { width: BASE_W * 1.03, height: BASE_W * 1.03 * (1200 / 800), thickness: 0.0185 },
  seamFrac: 0.222,
  flapFrac: 0.074,
  palette: {
    violet: '#3a1a6e',
    plum: '#1b0a33',
    ink: '#0a0413',
    champagne: '#e8cf9a',
    champagneHi: '#fbf0d4',
    champagneMid: '#b99b57',
    champagneDark: '#6f5a2c',
    graphite: '#3a3742',
    ivory: '#f4ece0',
  },
  copy: {
    kicker: 'Tier II · Sealed',
    title: 'Vault ',
    titleEmphasis: 'Break',
    meta: ['6 CARDS', '1 PRIME OR ABOVE', 'SERIES I · S·1a'],
    hintDrag: 'Drag along the seam',
    hintInspect: 'Tap a card to inspect',
  },
  material: { roughness: 0.19, metalness: 0.62, peel: 0.46 },
  tear: { stretch: 0.05, releaseFrac: 0.84, springK: 40, damping: 0.72, glint: 0.72 },
  liner: { enabled: true, metalness: 0.95, roughness: 0.22 },
  riseY: 0.045,
  fan: {
    stepX: 0.0285, angle: 0.155, arcDrop: 0.0045, liftY: 0.024,
    heroZ: 0.026, heroScale: 1.16, grailZ: 0.018,
  },
  reveal: {
    stack: 1.0, hold: 0.6, rise: 0.85, separate: 1.6, settle: 0.8,
    notice: 2.3, approach: 1.7, reveal: 1.5, present: 1.9,
  },
  haptics: { tickCount: 16, giveAt: 0.05, completeAt: 0.97 },
  deck: [
    { name: 'Atrium Cipher', rarity: 'CORE', edition: '1 OF 2,400', finish: 'MATTE',
      value: '$182.00', delta: 2.1, tint: '#1d1030', glowRGB: '120,80,200', seed: 11,
      serial: 'GH-0451-AC', held: 'HELD SINCE 04 MAR · PAID $164.00',
      spark: [150, 152, 149, 156, 161, 158, 166, 170, 176, 182] },
    { name: 'Ledger Sentinel', rarity: 'CORE', edition: '1 OF 2,400', finish: 'MATTE',
      value: '$204.50', delta: -1.4, tint: '#1a1230', glowRGB: '100,90,210', seed: 23,
      serial: 'GH-0452-LS', held: 'HELD SINCE 19 APR · PAID $198.00',
      spark: [214, 219, 216, 210, 208, 212, 206, 202, 205, 204] },
    { name: 'Assay Warden', rarity: 'CORE', edition: '1 OF 2,400', finish: 'SATIN',
      value: '$248.00', delta: 3.6, tint: '#221037', glowRGB: '140,90,220', seed: 37,
      serial: 'GH-0453-AW', held: 'HELD SINCE 27 MAY · PAID $221.00',
      spark: [206, 212, 218, 224, 221, 230, 236, 240, 244, 248] },
    { name: 'Bullion Rite', rarity: 'PRIME', edition: '1 OF 480', finish: 'FOIL',
      value: '$640.00', delta: 5.2, tint: '#2a1442', glowRGB: '180,140,255', seed: 53,
      serial: 'GH-0454-BR', held: 'HELD SINCE 11 JUN · PAID $560.00',
      spark: [520, 534, 548, 552, 566, 580, 596, 612, 626, 640] },
    { name: 'Vault Regent', rarity: 'PRIME', edition: '1 OF 480', finish: 'FOIL',
      value: '$715.00', delta: 4.4, tint: '#2d1546', glowRGB: '190,150,255', seed: 71,
      serial: 'GH-0455-VR', held: 'HELD SINCE 02 JUL · PAID $648.00',
      spark: [612, 620, 634, 648, 656, 668, 682, 694, 706, 715] },
    { name: 'The Keyholder', rarity: 'GRAIL', edition: '1 OF 25', finish: 'PRISM FOIL',
      value: '$4,180.00', delta: 8.9, tint: '#35184f', glowRGB: '232,207,162', seed: 97,
      serial: 'GH-0456-KH', held: 'HELD SINCE 08 SEP · PAID $3,640.00',
      spark: [3320, 3390, 3460, 3520, 3660, 3740, 3880, 3980, 4090, 4180] },
  ],
};
