import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { fonts, ink } from "../theme/tokens";

/**
 * Ticking "time remaining until `target`" text. Ticks locally on a 1s timer —
 * the countdown itself needs no server round-trip, only the drop's state
 * transition (soon → live → closed) does, which the caller re-derives from
 * fresh `PackSku` data on its own polling interval.
 *
 * Uses Outfit with tabular-nums rather than the mockup's JetBrains Mono —
 * that's a font the app doesn't load today, and pulling in a second typeface
 * for one countdown label isn't worth the extra dependency this pass.
 */
export function Countdown({ target, color = ink.text }: { target: string; color?: string }) {
  const remainingMs = useRemainingMs(target);
  return <Text style={[styles.text, { color }]}>{formatRemaining(remainingMs)}</Text>;
}

/** The Drop screen's "OPENS IN" boxed HRS/MIN/SEC tiles — a distinct layout
 * from the compact inline text above, not just a style variant of it, since
 * it needs three separately-boxed digit pairs plus per-tile labels. */
export function CountdownBoxes({ target }: { target: string }) {
  const remainingMs = useRemainingMs(target);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <View style={styles.boxRow}>
      <Tile value={pad(hours)} label="HRS" />
      <Text style={styles.colon}>:</Text>
      <Tile value={pad(minutes)} label="MIN" />
      <Text style={styles.colon}>:</Text>
      <Tile value={pad(seconds)} label="SEC" emphasize />
    </View>
  );
}

function Tile({ value, label, emphasize }: { value: string; label: string; emphasize?: boolean }) {
  return (
    <View style={styles.tileWrap}>
      <View style={[styles.tile, emphasize && styles.tileEmphasize]}>
        <Text style={[styles.tileValue, emphasize && styles.tileValueEmphasize]}>{value}</Text>
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function useRemainingMs(target: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return Math.max(0, new Date(target).getTime() - now);
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (days > 0) return `${days}d ${pad(hours)}h`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(minutes)}:${pad(seconds)}`;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: "Outfit_600SemiBold",
    fontSize: 22,
    letterSpacing: 0.5,
    fontVariant: ["tabular-nums"],
  },
  boxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  tileWrap: { alignItems: "center", gap: 6 },
  tile: {
    width: 48,
    height: 44,
    borderRadius: 11,
    backgroundColor: "rgba(242,196,107,0.14)",
    borderWidth: 1,
    borderColor: "rgba(242,196,107,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileEmphasize: { backgroundColor: "rgba(242,196,107,0.22)", borderColor: "rgba(242,196,107,0.6)" },
  tileValue: {
    fontFamily: fonts.black,
    fontSize: 22,
    letterSpacing: -0.44,
    color: "#F8E3B4",
    fontVariant: ["tabular-nums"],
  },
  tileValueEmphasize: { color: "#FFF3D6" },
  tileLabel: { fontFamily: fonts.bold, fontSize: 8.5, letterSpacing: 1.7, color: "rgba(255,255,255,0.5)" },
  colon: { fontFamily: fonts.black, fontSize: 18, color: "rgba(242,196,107,0.55)", marginBottom: 16 },
});
