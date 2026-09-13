// Design tokens. Every screen reads from here — nothing hard-codes a hex.

export const ink = {
  ground: '#0A0614',
  groundDeep: '#04010A',
  card: 'rgba(255,255,255,0.07)',
  cardBorder: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF',
  textSoft: 'rgba(255,255,255,0.66)',
  textMeta: 'rgba(255,255,255,0.62)', // floor for AA on ground
};

// Category accents. Same lightness so neither outranks the other.
export const accent = {
  cards:   { c1: '#B14BFF', c2: '#5B1FD6', glow: '177,75,255' },
  watches: { c1: '#F2C46B', c2: '#8A6520', glow: '242,196,107' },
  warn:    { c1: '#FF7A2F', c2: '#C42410', glow: '255,122,47' },
  ok:      { c1: '#63E85C', c2: '#12864A', glow: '99,232,92' },
  danger:  { c1: '#FF5C7A', c2: '#B01634', glow: '255,92,122' },
  gold:    { c1: '#FFD75E', c2: '#E08A16', glow: '255,215,94' },
};

export const gain = '#8BF285';
export const loss = '#FF8DA1';

// Outfit is the display face. Load it with expo-font, or swap to System.
export const font = {
  black: 'Outfit_900Black',
  bold: 'Outfit_800ExtraBold',
  semi: 'Outfit_700Bold',
  med: 'Outfit_600SemiBold',
  reg: 'Outfit_400Regular',
};

// Fallback so the project runs before fonts are wired up.
export const f = (weight) => ({ fontWeight: weight });

export const radius = { pill: 999, card: 20, tile: 16, chip: 9 };

// Chunky game button: coloured fill + hard bottom shadow + coloured cast glow.
export const buttonShadow = (glow) => ({
  shadowColor: 'rgb(' + glow + ')',
  shadowOpacity: 0.46,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
});

// Cards use overshoot. Watches never do. This is the whole tonal split.
export const spring = {
  cards: { damping: 13, stiffness: 190, mass: 0.9 },
  watches: { damping: 26, stiffness: 90, mass: 1.3 },
};

export const timing = {
  cardBeat: 420,
  watchBeat: 1100,
  watchRise: 2400,
};
