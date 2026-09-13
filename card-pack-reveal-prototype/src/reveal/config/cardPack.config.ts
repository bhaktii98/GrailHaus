import type { CategoryPersonality } from './types';

// The "Trading Cards" personality — GrailHaus violet/gold identity, final
// state reached across the Claude Design chat (chats/chat1.md). Numbers
// (SIZE, SEAM_FRAC, FLAP_FRAC) are carried over unchanged from
// project/rip-pack.js and project/pack-art.js so the geometry and art
// layers below reproduce the approved design rather than reinterpreting it.
export const cardPackPersonality: CategoryPersonality = {
  id: 'trading-cards',
  size: {
    width: 0.068,
    height: 0.068 * (1200 / 800),
    thickness: 0.016,
  },
  seamFrac: 0.205,
  flapFrac: 0.062,
  palette: {
    ink: '#0a0418',
    gold: '#d8a93f',
    goldHi: '#ffe9ac',
    goldDark: '#8a621d',
    bone: '#f6eeda',
    violet: '#4a2a86',
    violetDeep: '#180a2c',
  },
  copy: {
    wordmark: 'GRAILHAUS',
    subline: 'COLLECTOR CARD GAME',
    sealedWord: 'Sealed',
    codeBadge: 'S·1a',
    footer: 'THEMED BOOSTER PACK',
    backHeaderLine1: 'GRAILHAUS · SERIES I',
    backHeaderLine2: 'OPEN FROM EITHER SIDE',
    backBullets: [
      'CONTENTS: 5 COLLECTOR CARDS',
      'ONE FOIL CARD GUARANTEED',
      'SERIES I · SEALED AT SOURCE',
      'NOT A TOY · KEEP SEALED UNTIL PLAY',
    ],
    kicker: 'Sealed · Series I',
    title: 'GrailHaus ',
    titleEmphasis: 'Booster',
    meta: ['5 CARDS', '1 GUARANTEED FOIL'],
  },
  cardFace: {
    rarityRibbon: 'GRAIL · 1 OF 25',
    name: 'Prism Wraith',
    category: 'TRADING CARDS · SERIES I · HOLO',
    heldSince: 'HELD SINCE 08 SEP · PAID $1,390.00',
    estValueLabel: 'EST. VALUE',
    estValue: '$1,480.00',
    changeLabel: '24H',
    changePct: '▲ 6.4%',
    footerLeft: 'GRAILHAUS',
    footerRight: 'GH-0014-PW',
  },
  timing: {
    peelEnd: 0.8,
    gapeStart: 0.22,
    riseStart: 0.45,
    fanStart: 0.8,
    releaseStart: 0.86,
  },
  haptics: {
    tickCount: 14,
    giveAt: 0.06,
    completeAt: 0.97,
  },
  cardCount: 3,
};
