// The tap-to-open, strictly-one-card-at-a-time reveal mechanic — shared by all three card tiers'
// post-tear reveal screens (vaultReveal/VaultCardFanReveal.tsx, blackLabelReveal/
// BlackLabelFanReveal.tsx, reveal/CardPackFanReveal.tsx). Replaces each tier's previous
// automatic, timer-staggered "card N flips on its own cue" reveal with a deliberate per-card
// gesture: tap the top sealed card to open it, tap it again to set it down, then the next card
// becomes tappable.
//
// Earlier versions of this hook gave PRIME/GRAIL cards a press-and-hold charge gesture (the rarer
// the card, the longer/harder the hold) while CORE cards opened on a plain tap — a per-tier
// difference in what the user's hand actually had to do. Per explicit user feedback, the human
// action is now identical for every card regardless of rarity: tap to open, tap to set aside.
// Rarity is communicated entirely through the reveal's own animation (HoldToOpenFanReveal.tsx's
// flip choreography and OpenFlourish's rings/motes), never through gesture timing.
import { useCallback, useMemo, useRef, useState } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { playSfx } from "../../../../lib/sfx";
import type { CardRarity } from "../../vaultReveal/config/types";

export type CardOpenStatus = "sealed" | "open" | "pulled";

interface RarityTuning {
  /** How many rings/motes worth of flourish this rarity earns on open — consumed by
   * HoldToOpenFanReveal, not used inside this hook itself. */
  rings: number;
  motes: number;
  dim: number;
}

export const TUNING: Record<CardRarity, RarityTuning> = {
  // CORE still gets a light mote sparkle on open (no ring) — every reveal should feel like
  // something happened, not just the rarer ones.
  CORE: { rings: 0, motes: 6, dim: 0 },
  PRIME: { rings: 1, motes: 12, dim: 0.42 },
  GRAIL: { rings: 2, motes: 22, dim: 0.74 },
};

export interface HoldToOpenDeck {
  status: CardOpenStatus[];
  /** Index sitting open/flipped, waiting to be tapped closed into the tray, or null. */
  openIndex: number | null;
  /** True only for the single card a tap is currently allowed to open (top of the sealed
   * stack) — every other sealed card is inert until this one is dealt with. */
  isGrabbable: (i: number) => boolean;
  /** Ramps 0->1 the instant a card opens and back to 0 on dock — drives the open/close glow and
   * vignette wash. No longer tied to a hold gesture; it's just an open/closed indicator now. */
  liftSV: SharedValue<number>;
  /** Rarity flavor for whichever card is currently open — for the ring/mote counts. Null when
   * nothing is open. */
  activeTuning: RarityTuning | null;
  revealedCount: number;
  /** Cards fully dock'd (status "pulled") — a strict subset of `revealedCount`, which also
   * counts the one currently "open" (mid-inspection, not yet set aside). This is the number
   * that's actually safe to persist as "resume from here": a card still "open" when the process
   * dies should be shown fresh again on resume, not skipped as if it had been dealt with. */
  pulledCount: number;
  total: number;
  done: boolean;
  grab: (i: number) => void;
  dock: () => void;
  /** Escape hatch for an impatient user — same spirit as the old "tap to reveal faster" link the
   * timer-based reveal had. Instantly settles every remaining card into the tray. */
  revealAll: () => void;
}

export function useHoldToOpenDeck(
  rarities: CardRarity[],
  autoAdvance = false,
  /** Seeds the first N cards straight to "pulled" instead of every card starting "sealed" — how
   * a resumed pack lands on card N+1 (already-grabbable, per `topSealedIndex`) instead of card 1,
   * with cards 0..N-1 shown already-settled rather than replaying flips the user already saw. 0
   * (the default) is the normal fresh-pack case: every card starts sealed, unchanged from before
   * this param existed. */
  initialOpenedCount = 0
): HoldToOpenDeck {
  const total = rarities.length;
  const [status, setStatus] = useState<CardOpenStatus[]>(() =>
    rarities.map((_, i) => (i < initialOpenedCount ? "pulled" : "sealed"))
  );
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const liftSV = useSharedValue(0);

  // A real race, not just a display glitch: RN's Pressable re-reads its onPress prop live at each
  // touch event, not locked in at touch-start. The instant a card opens, its own onPress prop (in
  // HoldToOpenFanReveal.tsx) flips from "grab" to "dock" *before the user's finger has lifted*.
  // Without this guard, the same release that opened the card also immediately docks it — the
  // reveal flashes and is gone before it's seen, which reads as the card flipping open and shut
  // rapidly. dock() below refuses to fire for a brief window right after a card opens, so the
  // user always gets a real look at it before they can dismiss it.
  const dockGuardUntilRef = useRef(0);
  // Comfortably longer than the flip choreography in HoldToOpenFanReveal.tsx's FLIP_CONFIG — the
  // value every existing (single-pack) caller gets, since none of them pass `autoAdvance`.
  //
  // `autoAdvance` (bulk-batch only — see HoldToOpenFanReveal's own prop) auto-docks CORE/PRIME
  // cards on a timer instead of waiting for a tap, and the race this guard exists for (a single
  // real finger-release both opening and immediately docking a card, via a Pressable prop that
  // changed mid-gesture) can only happen from an actual tap — a JS timer never collides with it.
  // So the guard only needs to be short enough not to eat that timer's own call, not to survive a
  // real flip: GRAIL still gets the full duration (it's always manually docked, even mid-batch,
  // and always plays the uncompressed flip), CORE/PRIME get a short one.
  function guardMsFor(rarity: CardRarity, autoAdvance: boolean): number {
    if (!autoAdvance) return 1650;
    return rarity === "GRAIL" ? 1650 : 300;
  }

  const tuning = useMemo(() => rarities.map((r) => TUNING[r]), [rarities]);
  const statusRef = useRef(status);
  statusRef.current = status;

  const topSealedIndex = useCallback(() => statusRef.current.findIndex((s) => s === "sealed"), []);

  const isGrabbable = useCallback((i: number) => status[i] === "sealed" && topSealedIndex() === i, [status, topSealedIndex]);

  const grab = useCallback(
    (i: number) => {
      if (openIndex != null) return;
      if (statusRef.current[i] !== "sealed" || topSealedIndex() !== i) return;
      liftSV.value = 1;
      dockGuardUntilRef.current = Date.now() + guardMsFor(rarities[i], autoAdvance);
      setStatus((prev) => prev.map((s, idx) => (idx === i ? "open" : s === "open" ? "sealed" : s)));
      setOpenIndex(i);
      const rarity = rarities[i];
      const feedback =
        rarity === "GRAIL"
          ? Haptics.NotificationFeedbackType.Success
          : rarity === "PRIME"
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success;
      Haptics.notificationAsync(feedback);
      // Cut off at roughly the flip's own on-screen duration (HoldToOpenFanReveal.tsx's
      // FLIP_CONFIG: 5 × 100ms turns + a 320ms settle ≈ 820ms) — the source clip runs several
      // seconds longer than that, and letting it play out in full reads as "still going after
      // the flip finished" instead of "playing while it flips."
      playSfx("cardOpen", 850);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openIndex, topSealedIndex, rarities, autoAdvance]
  );

  const dock = useCallback(() => {
    if (openIndex == null) return;
    if (Date.now() < dockGuardUntilRef.current) return; // see dockGuardUntilRef's own comment
    liftSV.value = 0;
    setStatus((prev) => prev.map((s) => (s === "open" ? "pulled" : s)));
    setOpenIndex(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openIndex]);

  const revealAll = useCallback(() => {
    liftSV.value = 0;
    setOpenIndex(null);
    setStatus(rarities.map(() => "pulled"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarities]);

  const activeTuning = openIndex != null ? tuning[openIndex] : null;
  const revealedCount = status.filter((s) => s !== "sealed").length;
  const pulledCount = status.filter((s) => s === "pulled").length;
  const done = revealedCount === total && openIndex == null;

  return {
    status, openIndex, isGrabbable,
    liftSV,
    activeTuning, revealedCount, pulledCount, total, done,
    grab, dock, revealAll,
  };
}
