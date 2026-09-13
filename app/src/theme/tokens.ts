/**
 * App-shell design tokens: dark-luxury, matched to GrailHaus-Mockups-standalone.html
 * and the app's own mark (deep violet-black, gold crest, violet gem). Two accent
 * "registers" exist because the mockup treats Cards and Watches as different rooms,
 * not just a different badge color — "the whole screen changes register": Cards get
 * violet + burst energy, Watches get gold + a calmer plate. `accent` picks between
 * them; components default to the neutral gold register when no category applies.
 *
 * Every text style and chrome color used anywhere in the app lives in this file —
 * `typography.*` for font/size/spacing/line-height, `ink`/`colors`/`accent*` for
 * color. Components read from here rather than restating "Outfit_800ExtraBold" or
 * a raw hex/rgba string inline; that's what makes a palette or type change a
 * one-file edit instead of a grep-and-replace across every screen. The only
 * literals that stay inline are one-off content data (a specific pack's artwork
 * gradient stops, a page's illustration palette) — those aren't design decisions,
 * they're per-item data, the same way you wouldn't tokenize a product photo's
 * dominant color.
 *
 * The reveal engine's own per-category configs (engine/categories/*.config.tsx)
 * intentionally keep their own darker, more theatrical palette and do NOT read from
 * these tokens — that separation is deliberate, see the comment there.
 */

export const colors = {
  bg: "#0B0716",
  bgElevated: "#150C24",
  surface: "#1B1230",
  surfaceElevated: "#241A3A",
  outline: "#33254D",
  outlineSoft: "#2A1F42",
  textPrimary: "#F5F1FA",
  textSecondary: "#B6ABC9",
  textMuted: "#786D8F",

  violetTop: "#B14BFF",
  violetBottom: "#5B1FD6",
  violetGlow: "rgba(177,75,255,0.46)",

  /** The watches *category* register — muted warm gold on near-black. Distinct
   * from `goldTop`/`goldBottom` below, which is the bright "money" gold used
   * for the balance pill and coin icons in both categories alike. Conflating
   * the two used to make every watches accent read as the balance-pill color
   * instead of the mockup's quieter `#F2C46B`. */
  watchesTop: "#F2C46B",
  watchesBottom: "#8A6520",
  watchesGlow: "rgba(242,196,107,0.4)",

  goldTop: "#FFD75E",
  goldBottom: "#E0A016",
  goldGlow: "rgba(224,160,22,0.4)",

  success: "#3FCB7E",
  danger: "#F0554A",
} as const;

export const accents = {
  cards: { top: colors.violetTop, bottom: colors.violetBottom, glow: colors.violetGlow },
  watches: { top: colors.watchesTop, bottom: colors.watchesBottom, glow: colors.watchesGlow },
} as const;

export type AccentRegister = keyof typeof accents;

/**
 * The rn/ reference implementation's full accent set (rn/src/theme.js) — c1/c2
 * for a gradient plus a bare "r,g,b" glow string (used directly inside an
 * rgba(...) string, unlike `accents` above which pre-builds an rgba glow).
 * Onboarding (ported from that reference) reads from here; older screens
 * built from the HTML mockup keep using `accents`/`colors` above.
 */
export const accent = {
  cards: { c1: "#B14BFF", c2: "#5B1FD6", glow: "177,75,255" },
  watches: { c1: "#F2C46B", c2: "#8A6520", glow: "242,196,107" },
  warn: { c1: "#FF7A2F", c2: "#C42410", glow: "255,122,47" },
  ok: { c1: "#63E85C", c2: "#12864A", glow: "99,232,92" },
  danger: { c1: "#FF5C7A", c2: "#B01634", glow: "255,92,122" },
  gold: { c1: "#FFD75E", c2: "#E08A16", glow: "255,215,94" },
} as const;

/** Grounds and text-on-dark tones (rn/src/theme.js, plus a couple of added
 * intermediate opacities that were previously being re-approximated slightly
 * differently — 0.5 vs 0.52, 0.6 vs 0.62 — in different files). Every "white
 * at N% opacity" text color in the app should be one of these five. */
export const ink = {
  ground: "#0A0614",
  groundDeep: "#04010A",
  // Opaque enough to stay legible as a floating surface over arbitrary photo/gradient content
  // behind it (the pill tab bar) — a translucent white tint here used to read as "invisible"
  // once it started overlaying busy card art instead of a flat page background.
  card: "rgba(18,12,30,0.94)",
  cardBorder: "rgba(255,255,255,0.18)",
  text: "#FFFFFF",
  textBright: "rgba(255,255,255,0.9)",
  textSoft: "rgba(255,255,255,0.66)",
  textMeta: "rgba(255,255,255,0.62)",
  textMuted: "rgba(255,255,255,0.5)",

  /** Watches never sit on plain white text — the mockup's whole watches
   * register runs on a warmer cream instead, per its "opposite room" rule. */
  textOnWatches: "#F6F3EC",
  textOnWatchesSoft: "rgba(246,243,236,0.66)",
  textOnWatchesMuted: "rgba(246,243,236,0.5)",
} as const;

export const buttonShadow = (glow: string) => ({
  shadowColor: `rgb(${glow})`,
  shadowOpacity: 0.46,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 10 },
  elevation: 10,
});

/** Cards use overshoot; watches never do — the reference's whole tonal split. */
export const spring = {
  cards: { damping: 13, stiffness: 190, mass: 0.9 },
  watches: { damping: 26, stiffness: 90, mass: 1.3 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 10,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

/** Every loaded Outfit weight, named by its actual number — see App.tsx's
 * useFonts call. Nothing outside this file should spell out "Outfit_..." . */
export const fonts = {
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
  extrabold: "Outfit_800ExtraBold",
  black: "Outfit_900Black",
} as const;

/** Every distinct text role in the app, named by what it's for rather than
 * where it's used — e.g. `beatTitle` is "a step's title," used on every
 * onboarding page, not "onboarding page 1's title." */
export const typography = {
  // Original app-shell scale (Shelf/Auth/Reveal-adjacent chrome).
  display: { fontFamily: fonts.black, fontSize: 30, letterSpacing: -0.3 },
  title: { fontFamily: fonts.extrabold, fontSize: 20 },
  body: { fontFamily: fonts.bold, fontSize: 15 },
  caption: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 0.4 },
  price: { fontFamily: fonts.black, fontSize: 16, fontVariant: ["tabular-nums" as const] },
  buttonLabel: { fontFamily: fonts.black, fontSize: 16, letterSpacing: 0.9 },

  // Header brand wordmark ("GRAILHAUS" next to the small logo chip).
  navBrand: { fontFamily: fonts.extrabold, fontSize: 16, color: ink.text },

  // Big hero text.
  heroWordmark: { fontFamily: fonts.black, fontSize: 40, letterSpacing: 0.4, color: ink.text },
  pageHeading: { fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -0.9, lineHeight: 32, color: ink.text },
  carouselTitle: { fontFamily: fonts.extrabold, fontSize: 33, letterSpacing: -0.9, lineHeight: 36, color: ink.text },

  // Section labels and sub-headings.
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 3, color: ink.textMeta },
  sectionSub: { fontFamily: fonts.medium, fontSize: 12.5, color: ink.textMuted },

  // Paragraph body copy.
  paragraph: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 22, color: ink.textSoft },

  // The onboarding "beats" list (a numbered/symbol key + a short step).
  beatKey: { fontFamily: fonts.extrabold, fontSize: 12 },
  beatTitle: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 17, color: ink.text },
  beatBody: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: ink.textMeta },

  // Pack tiles and pack faces.
  tierPill: { fontFamily: fonts.extrabold, fontSize: 8.5, letterSpacing: 1.36, color: "rgba(255,255,255,0.8)" },
  packName: { fontFamily: fonts.black, fontSize: 18, letterSpacing: -0.18, lineHeight: 19, color: ink.text },
  packNameHero: { fontFamily: fonts.black, fontSize: 24, letterSpacing: -0.18, lineHeight: 25, color: ink.text },
  packSub: { fontFamily: fonts.medium, fontSize: 11.5, color: ink.textMuted },
  ripLabel: { fontFamily: fonts.black, fontSize: 13.5, letterSpacing: 0.81, color: ink.text },

  /**
   * Watches' opposite typographic register for the same tile roles above —
   * light Outfit weights instead of heavy ones, cream instead of white. Cards
   * shout (900/800 weight, tight tracking); watches speak quietly (400/600,
   * open tracking). Every screen this pass touches picks between the pair
   * above and this pair by `sku.category` rather than varying weight inline.
   */
  tierPillWatches: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 2.4, color: "rgba(242,196,107,0.75)" },
  packNameWatches: { fontFamily: fonts.regular, fontSize: 21, letterSpacing: 0, lineHeight: 25, color: ink.textOnWatches },
  packSubWatches: { fontFamily: fonts.regular, fontSize: 11.5, color: ink.textOnWatchesSoft },
  priceWatches: { fontFamily: fonts.semibold, fontSize: 17, color: ink.textOnWatches, fontVariant: ["tabular-nums" as const] },
  quietButtonLabel: { fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 1.4, color: ink.textOnWatches },

  // Small chrome text.
  metaLine: { fontFamily: fonts.semibold, fontSize: 12.5, color: ink.textMeta },
  footNote: { fontFamily: fonts.medium, fontSize: 11, color: ink.textMeta },
  linkMuted: { fontFamily: fonts.semibold, fontSize: 13, color: ink.textMuted },
  countMain: { fontFamily: fonts.extrabold, fontSize: 14, color: ink.text },
  tabLabel: { fontFamily: fonts.extrabold, fontSize: 12, color: ink.text },
  chipLabel: { fontFamily: fonts.extrabold, fontSize: 13, color: ink.text },
  switchLabel: { fontFamily: fonts.extrabold, fontSize: 13.5, letterSpacing: 0.68 },
  chunkyButtonLabel: { fontFamily: fonts.black, fontSize: 16, letterSpacing: 1.4, color: ink.text },
  cardLabel: { fontFamily: fonts.black, fontSize: 16, letterSpacing: 0.2, color: ink.text },

  // A label on a light/gold plate — always dark text, never ink.*.
  plateLabel: { fontFamily: fonts.extrabold, fontSize: 12, letterSpacing: 2.9, color: "#2A1706" },

  // The pulsing "TAP TO START" call to action.
  pulseCta: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: 2.2, color: ink.textBright },

  errorText: { fontFamily: fonts.bold, fontSize: 12, color: colors.danger },
};

export const shadow = {
  tile: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  }),
  /** Watches' button/plinth shadow: a soft cast glow only, no hard offset —
   * the mockup never gives a watches surface the cards' bevelled "sink" edge. */
  softGlow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  }),
};
