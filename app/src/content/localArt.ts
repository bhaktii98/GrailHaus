/**
 * Bundled photographic art (not per-item catalog photos) standing in for the flat gradients on
 * the Home hero and the cards/watches doors into Explore — see PackFace/CardFace/WatchDial's own
 * `imageUrl` prop, which already exists for exactly this "real photo instead of gradient" swap.
 */
export const heroArt = require("../../assets/hero-art.jpg");
export const cardsArt = require("../../assets/trading-cards-art.jpg");
export const watchesArt = require("../../assets/watches-art.jpg");

/**
 * One real pack/box render per tier (GrailhausPacks.js's own reference renders) — a genuine
 * upgrade from `cardsArt`/`watchesArt` above, which stand in for a whole *category* with one
 * shared photo. Keyed by the real `PackSku.tier` slug, same keys as PackTile's own
 * `TIER_LABEL`/`ART_GRADIENT` records, so a tier with no render here (a category added later,
 * e.g. handbags) falls back cleanly to the flat gradient instead of crashing on a missing key.
 */
export const PACK_RENDER: Partial<Record<string, ReturnType<typeof require>>> = {
  street_rip: require("../../assets/pack-street-rip.png"),
  vault_break: require("../../assets/pack-vault-break.png"),
  black_label: require("../../assets/pack-black-label.png"),
  reserve: require("../../assets/pack-reserve.png"),
  archive: require("../../assets/pack-archive.png"),
  obsidian_vault: require("../../assets/pack-obsidian-vault.png"),
};
