import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";

/**
 * The portfolio's total value over the last few hours — an area under a line, with a marker on
 * the live edge.
 *
 * Every point is real: the caller sums the same `computePriceDrift` the server evaluates, across
 * the same holdings, at each timestamp (see `usePortfolioViewModel`). Nothing here smooths,
 * extrapolates, or invents a trend — the shape is whatever the simulation actually did.
 *
 * Scaled to the series' own min/max rather than to zero. A collection worth $4,200 that moved $60
 * would otherwise draw a dead-flat line; the point of this chart is the shape of the movement, and
 * the axis labels beside it carry the absolute figures.
 */
export function Sparkline({
  points,
  color,
  height = 68,
  width,
  showBaseline = true,
}: {
  points: number[];
  color: string;
  height?: number;
  width: number;
  showBaseline?: boolean;
}) {
  const paths = useMemo(() => {
    if (width <= 0 || points.length < 2) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);
    // A perfectly flat series (one holding whose drift hasn't moved yet, or an empty collection)
    // would divide by zero — park it on the centre line instead.
    const span = max - min || 1;
    const padding = 4;
    const usable = height - padding * 2;

    const x = (i: number) => (i / (points.length - 1)) * width;
    const y = (value: number) => padding + (1 - (value - min) / span) * usable;

    const line = `M ${points.map((p, i) => `${x(i).toFixed(2)},${y(p).toFixed(2)}`).join(" L ")}`;
    const area = `${line} L ${width},${height} L 0,${height} Z`;
    const first = points[0];
    const last = points[points.length - 1];

    return { line, area, tip: { x: width, y: y(last) }, baselineY: y(first) };
  }, [points, width, height]);

  if (!paths) return <View style={{ height, width }} />;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.3} />
          <Stop offset="1" stopColor={color} stopOpacity={0.01} />
        </SvgGradient>
      </Defs>
      {/* Where the window opened — turns the line into "up or down since then" at a glance. */}
      {showBaseline && (
        <Line
          x1={0}
          y1={paths.baselineY}
          x2={width}
          y2={paths.baselineY}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
      )}
      <Path d={paths.area} fill="url(#sparkFill)" />
      <Path d={paths.line} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={paths.tip.x - 2} cy={paths.tip.y} r={3.5} fill={color} />
    </Svg>
  );
}
