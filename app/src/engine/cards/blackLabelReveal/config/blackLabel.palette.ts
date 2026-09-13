/**
 * Black Label's palette and kicker, split out of `blackLabel.config.ts` as a dependency-free leaf.
 *
 * The config itself re-exports `SEAM_FRAC`/`FLAP_FRAC` from `../art/blackLabelArt`, which pulls in
 * the whole Skia art chain — fine for the app, but it means anything wanting only this tier's
 * *colours* (the bulk run's tierPersonality.ts, and any test touching it) would drag a native
 * graphics module along with them. These are plain strings with no imports at all, so both the
 * config and the bulk run can read them without that cost, and there is still exactly one
 * definition of each value.
 *
 * Values are unchanged from the Claude Design handoff — see blackLabel.config.ts's own header.
 */
export const BLACK_LABEL_PALETTE = {
  violet: "#1c1c24",
  plum: "#0c0c12",
  ink: "#04040a",
  champagne: "#d8b877",
  champagneHi: "#f7e6bd",
  champagneMid: "#a5854a",
  champagneDark: "#57431f",
  graphite: "#28282f",
  ivory: "#f2ece2",
} as const;

export const BLACK_LABEL_KICKER = "Tier III · Sealed";
