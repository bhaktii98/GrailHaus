import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import type { TierAmbience, TierRevealIdentity } from "./tierPersonality";

/**
 * The atmosphere behind a grail reveal, drawn in each tier's own visual language.
 *
 * This is the piece that makes a 10-pack of Black Label *look* like Black Label. The single-pack
 * reveal expresses that tier through `art/fire.ts` — a six-layer GPU particle system (skirt,
 * sheet, embers, smoke, sparks, cracks) with a heat halo and a light sweep. Reproducing that here
 * would be both wrong and unaffordable: wrong because the Grail Hunt has no 3D scene to attach it
 * to, and unaffordable because a bulk run shows up to ten grails back to back and mounting a
 * particle system per reveal is exactly the memory spike the bulk flow is designed to avoid.
 *
 * So this is a deliberate *translation*, not a port: the same silhouette and the same palette,
 * expressed with a handful of Reanimated views on the UI thread. Embers still rise and drift and
 * die, still coloured crimson→molten→champagne, still surging on the reveal beat — they are just
 * eight animated views rather than six hundred GPU particles. The read is consistent; the cost is
 * a rounding error.
 *
 * Every layer is driven by `intensity` (0..1 from `grailIntensity`), so the atmosphere escalates
 * across a run exactly as the reveal choreography does: a first grail smoulders, the climax burns.
 */

/** Deliberately small. Each is one Animated.View on the UI thread; the silhouette comes from the
 * spread and the timing, not from the count. */
const EMBER_COUNT = 8;

export function GrailAmbience({
  identity,
  intensity,
  /** Rises to 1 as the card turns — lets the atmosphere surge on the landing, the same way
   * `fire.ts`'s `burst()` spikes `uSurge` when a card locks open. */
  surge,
}: {
  identity: TierRevealIdentity;
  intensity: number;
  surge: SharedValue<number>;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <RoomGlow identity={identity} intensity={intensity} surge={surge} />
      {identity.ambience === "ember" && <EmberField identity={identity} intensity={intensity} />}
      {identity.ambience === "vault" && <VaultShafts identity={identity} intensity={intensity} />}
      {identity.ambience === "foil" && <FoilMotes identity={identity} intensity={intensity} />}
    </View>
  );
}

/**
 * The tier's room colour — Black Label's ember heat haze, Vault Break's violet vault light,
 * Street Rip's violet foil glow. Stands in for `fire.ts`'s `apexHalo`: one large, low-contrast
 * wash that pushes the tier's light into the room without washing the card out.
 */
function RoomGlow({
  identity,
  intensity,
  surge,
}: {
  identity: TierRevealIdentity;
  intensity: number;
  surge: SharedValue<number>;
}) {
  const breathe = useSharedValue(0);
  useEffect(() => {
    // A slow, irregular breath — the 2D equivalent of fire.ts's `flick` term, which combines
    // three sine waves at different rates so the light never pulses mechanically.
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.35, { duration: 1700, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    return () => cancelAnimation(breathe);
  }, [breathe]);

  const style = useAnimatedStyle(() => {
    const flick = 0.78 + breathe.value * 0.22;
    return {
      opacity: intensity * 0.5 * flick + surge.value * 0.3,
      transform: [{ scale: 0.9 + intensity * 0.22 + surge.value * 0.18 }],
    };
  });

  return <Animated.View style={[styles.roomGlow, { backgroundColor: identity.vignetteGlow }, style]} />;
}

/**
 * Black Label's signature. Embers rise from below the card, sway as they climb, and burn out —
 * the same life cycle `fire.ts`'s vertex shader runs (`t = fract(time/life + phase)`, rise scaled
 * by seed, lateral sway from stacked sines, `grow * die` alpha envelope), reproduced per-view.
 *
 * Colours are taken straight off the fire palette: the hot core, the molten body, and the crimson
 * tail, assigned by ember so the field reads as the same flame rather than a uniform orange.
 */
function EmberField({ identity, intensity }: { identity: TierRevealIdentity; intensity: number }) {
  const embers = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, (_, i) => ({
        // Spread across the card's width, weighted outward so embers hug the edges the way
        // fire.ts's `rim()` emitter weights its perimeter sample toward corners and the lower edge.
        x: (i / (EMBER_COUNT - 1) - 0.5) * 300,
        delay: (i * 517) % 2300,
        duration: 2600 + ((i * 397) % 1600),
        size: 3 + ((i * 7) % 4),
        drift: (((i * 131) % 60) - 30) * 1.4,
        // fire.ts: crimson at the tail, molten orange through the body, champagne at the core.
        color: i % 3 === 0 ? identity.hotHex : i % 3 === 1 ? "#ff7a1e" : "#7a0f06",
      })),
    [identity.hotHex]
  );

  return (
    <>
      {embers.map((e, i) => (
        <Ember key={i} {...e} intensity={intensity} />
      ))}
    </>
  );
}

function Ember({
  x,
  delay,
  duration,
  size,
  drift,
  color,
  intensity,
}: {
  x: number;
  delay: number;
  duration: number;
  size: number;
  drift: number;
  color: string;
  intensity: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(t);
  }, [t, delay, duration]);

  const style = useAnimatedStyle(() => {
    // grow * die, exactly the shape of fire.ts's alpha envelope.
    const grow = interpolate(t.value, [0, 0.22], [0, 1], "clamp");
    const die = 1 - interpolate(t.value, [0.55, 1], [0, 1], "clamp");
    return {
      opacity: grow * die * intensity * 0.9,
      transform: [
        { translateX: x + Math.sin(t.value * Math.PI * 2.3) * drift * t.value },
        { translateY: interpolate(t.value, [0, 1], [150, -190]) },
        { scale: 0.5 + t.value * 1.2 },
      ],
    };
  });

  return (
    <Animated.View
      style={[styles.particle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}

/**
 * Vault Break's signature — slow vertical light shafts in its violet, reading as a vault door
 * opening onto something lit from within. Its 3D reveal's atmosphere is the violet rim light
 * (`lighting.rim` = 0x7d4ce0) raking across champagne foil, so the 2D translation is light, not
 * particles.
 */
function VaultShafts({ identity, intensity }: { identity: TierRevealIdentity; intensity: number }) {
  const shafts = useMemo(
    () => [
      { x: -104, w: 34, delay: 0, duration: 3400 },
      { x: 0, w: 52, delay: 700, duration: 4100 },
      { x: 108, w: 30, delay: 1500, duration: 3700 },
    ],
    []
  );
  return (
    <>
      {shafts.map((s, i) => (
        <Shaft key={i} {...s} color={identity.accentRGB} intensity={intensity} />
      ))}
    </>
  );
}

function Shaft({
  x,
  w,
  delay,
  duration,
  color,
  intensity,
}: {
  x: number;
  w: number;
  delay: number;
  duration: number;
  color: string;
  intensity: number;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true)
    );
    return () => cancelAnimation(t);
  }, [t, delay, duration]);

  const style = useAnimatedStyle(() => ({
    opacity: (0.07 + t.value * 0.16) * intensity,
    transform: [{ translateX: x }, { scaleY: 0.82 + t.value * 0.3 }],
  }));

  return (
    <Animated.View
      style={[styles.shaft, { width: w, backgroundColor: `rgba(${color},0.5)` }, style]}
    />
  );
}

/**
 * Street Rip's signature — sparse gold foil motes catching the light as they drift, matching the
 * violet-and-gold identity of the base pack. The quietest of the three, because the base tier's
 * own reveal is the quietest.
 */
function FoilMotes({ identity, intensity }: { identity: TierRevealIdentity; intensity: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => ({
        x: (((i * 83) % 100) / 100 - 0.5) * 290,
        delay: (i * 640) % 2600,
        duration: 3400 + ((i * 311) % 1400),
        size: 2.5 + ((i * 5) % 3),
        drift: (((i * 97) % 44) - 22) * 1.2,
        color: identity.accentHex,
      })),
    [identity.accentHex]
  );
  return (
    <>
      {motes.map((m, i) => (
        <Ember key={i} {...m} intensity={intensity * 0.75} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  roomGlow: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -190,
    width: 380,
    height: 380,
    borderRadius: 190,
  },
  particle: { position: "absolute", alignSelf: "center", top: "50%" },
  shaft: { position: "absolute", alignSelf: "center", top: "50%", marginTop: -170, height: 340, borderRadius: 26 },
});
