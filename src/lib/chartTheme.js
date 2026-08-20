/**
 * Recharts styling, derived from the active palette so axes, grid lines and
 * tooltips flip with light/dark rather than being hardcoded.
 *
 * Lives here because more than one panel draws charts now (the Overview's
 * PerformanceSection and the campaign's growth chart). It was local to
 * PerformanceSection; copying it to the second caller would have left two
 * definitions to keep in step, and the first theme tweak would have silently
 * applied to one chart and not the other.
 */
export const chartTheme = (P) => ({
  axisProps: {
    tick: { fontSize: 10, fill: P.mute, fontFamily: "Sora, sans-serif" },
    axisLine: false,
    tickLine: false,
  },
  gridStroke: P.border,
  tooltipStyle: {
    contentStyle: {
      background: P.surface,
      border: `1px solid ${P.borderMid}`,
      borderRadius: 8,
      fontSize: 11.5,
      fontFamily: "Sora, sans-serif",
      boxShadow: P.shadowLg,
      color: P.text,
    },
    labelStyle: { color: P.text, fontWeight: 700, marginBottom: 3 },
    cursor: { stroke: P.borderMid, strokeWidth: 1, fill: P.hover },
  },
});

export default chartTheme;
