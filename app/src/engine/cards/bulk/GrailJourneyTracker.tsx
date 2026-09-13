import { StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import type { TierRevealIdentity } from "./tierPersonality";
import { fonts } from "../../../theme/tokens";
import { bulkRun as copy } from "../../../content/copy";

/**
 * The Grail Hunt's journey tracker — "GRAIL 3 OF 7", plus a pip per grail showing what's done,
 * what's live, and what's still to come.
 *
 * This is a deliberate reversal of an earlier decision. The hunt originally hid the grail total on
 * the reasoning that disclosing it spoils the suspense. In practice it did the opposite: a user
 * partway through a run had no idea whether the next tap was the last one or the fourth of nine,
 * which makes the run feel formless rather than mysterious. Knowing seven are coming is not a
 * spoiler — *which* cards they are, and what they're worth, is still entirely unknown, and that's
 * where the actual tension lives. The count converts anticipation from "is this over?" into
 * "there are four more" , which is the better feeling and the one the user asked for.
 *
 * The intro beat before the hunt still withholds everything: the count appears once the hunt
 * begins, not on the "THE CHASE BEGINS" screen, so the opening still lands as a reveal.
 *
 * Coloured in the tier's own accent so the tracker belongs to Black Label or Vault Break rather
 * than sitting on top of them in a generic app colour.
 */
export function GrailJourneyTracker({
  index,
  total,
  identity,
  isFinal,
}: {
  /** 0-based index of the grail currently on screen. */
  index: number;
  total: number;
  identity: TierRevealIdentity;
  isFinal: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.eyebrow, { color: identity.accentHex }]}>
          {isFinal ? copy.grail.finalEyebrow : copy.grail.eyebrow}
        </Text>
        <Text style={styles.counter}>{copy.grail.journey(index + 1, total)}</Text>
      </View>

      {/* One pip per grail in the run. Past ones stay lit at half strength (what you've already
          seen), the live one is wide and full strength, and the ones still to come are dim — so
          the shape of the remaining run is readable at a glance without reading the numbers. */}
      <View style={styles.pipRow}>
        {Array.from({ length: total }).map((_, i) => {
          const done = i < index;
          const live = i === index;
          return (
            <Animated.View
              key={i}
              entering={FadeIn.delay(Math.min(i, 10) * 26).duration(240).easing(Easing.out(Easing.cubic))}
              style={[
                styles.pip,
                done && { backgroundColor: `rgba(${identity.accentRGB},0.5)` },
                live && { backgroundColor: identity.accentHex, width: 22 },
              ]}
            />
          );
        })}
      </View>

      {!isFinal && total - index - 1 > 0 && (
        <Text style={styles.remaining}>{copy.grail.remaining(total - index - 1)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 9 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 2.4 },
  counter: {
    fontFamily: fonts.extrabold,
    fontSize: 11,
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.55)",
  },
  pipRow: { flexDirection: "row", gap: 5, alignItems: "center", flexWrap: "wrap", justifyContent: "center" },
  pip: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.16)" },
  remaining: { fontFamily: fonts.medium, fontSize: 11, color: "rgba(255,255,255,0.38)" },
});
