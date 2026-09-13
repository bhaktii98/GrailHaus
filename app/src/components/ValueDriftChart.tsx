import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import { computePriceDriftHistory } from "@grailhaus/shared";
import type { Category } from "@grailhaus/shared";
import { fonts, ink } from "../theme/tokens";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const BUCKET_COUNT = 168; // hourly, over the week
const CHART_HEIGHT = 96;

/**
 * The item's real value-drift formula (shared/economics.ts's `computePriceDrift`) swept across
 * the past week and bucketed hourly — not a stored price history (none exists; the drift is a
 * pure function of time, so there's nothing to store), and not a smoothed/invented trend line.
 * Each hour's band is the actual min/max the formula passed through in that hour: a card's fast
 * ~40-minute cycle (PRD §28) means its bands read as "sweeps its whole range constantly," while a
 * watch's slower cycle draws a legible wave — both are the honest shape of the same real math,
 * not a per-category visual choice.
 */
export function ValueDriftChart({
  item,
  minValueCents,
  maxValueCents,
  accentColor,
}: {
  item: { id: string; category: Category; baseValueCents: number };
  minValueCents: number;
  maxValueCents: number;
  accentColor: string;
}) {
  const [width, setWidth] = useState(0);

  const buckets = useMemo(
    () => computePriceDriftHistory(item, WEEK_MS, BUCKET_COUNT),
    // `item.id` is enough to key the memo — category/baseValueCents are fixed for a given item.
    [item.id]
  );

  const { areaPath, linePath, lastPoint } = useMemo(() => {
    if (width === 0) return { areaPath: "", linePath: "", lastPoint: null };
    const span = Math.max(1, maxValueCents - minValueCents);
    const x = (i: number) => (i / (BUCKET_COUNT - 1)) * width;
    const y = (valueCents: number) => CHART_HEIGHT - ((valueCents - minValueCents) / span) * CHART_HEIGHT;

    const uppers = buckets.map((b, i) => `${x(i)},${y(b.maxValueCents)}`);
    const lowers = buckets.map((b, i) => `${x(i)},${y(b.minValueCents)}`).reverse();
    const area = `M ${uppers[0]} L ${uppers.slice(1).join(" L ")} L ${lowers.join(" L ")} Z`;
    const line = `M ${buckets.map((b, i) => `${x(i)},${y(b.avgValueCents)}`).join(" L ")}`;
    const last = buckets[buckets.length - 1];

    return { areaPath: area, linePath: line, lastPoint: { x: x(BUCKET_COUNT - 1), y: y(last.avgValueCents) } };
  }, [buckets, width, minValueCents, maxValueCents]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>7-DAY DRIFT</Text>
        <Text style={styles.headerNote}>Simulated · every 30s</Text>
      </View>

      <View style={styles.chartBox} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <SvgGradient id="driftFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={accentColor} stopOpacity={0.32} />
                <Stop offset="1" stopColor={accentColor} stopOpacity={0.02} />
              </SvgGradient>
            </Defs>
            <Path d={areaPath} fill="url(#driftFill)" />
            <Path d={linePath} stroke={accentColor} strokeWidth={1.75} fill="none" strokeLinejoin="round" />
            {lastPoint && <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} fill={accentColor} />}
          </Svg>
        )}
      </View>

      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>7d ago</Text>
        <Text style={styles.axisLabel}>Now</Text>
      </View>
      <View style={styles.rangeRow}>
        <Text style={styles.rangeLabel}>Low ${(minValueCents / 100).toLocaleString()}</Text>
        <Text style={styles.rangeLabel}>High ${(maxValueCents / 100).toLocaleString()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  headerLabel: { fontFamily: fonts.extrabold, fontSize: 9.5, letterSpacing: 1.4, color: "rgba(255,255,255,0.55)" },
  headerNote: { fontFamily: fonts.medium, fontSize: 9.5, color: "rgba(255,255,255,0.4)" },
  chartBox: { height: CHART_HEIGHT, marginTop: 8 },
  axisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  axisLabel: { fontFamily: fonts.medium, fontSize: 9.5, color: "rgba(255,255,255,0.4)" },
  rangeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  rangeLabel: { fontFamily: fonts.semibold, fontSize: 11, color: ink.textMeta },
});
