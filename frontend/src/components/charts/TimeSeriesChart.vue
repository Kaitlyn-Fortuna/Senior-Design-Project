<script setup>
import { computed, ref } from "vue";
import { useResizeObserver } from "@vueuse/core";
import { ChartContainer, ChartCrosshair, ChartTooltip } from "@/components/ui/chart";
import { VisAxis, VisLine, VisXYContainer } from "@unovis/vue";
import { escapeHtml, formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Line chart over time with
 * - a padded y axis, so lines don't touch the top and bottom edges
 * - an optional drag-to-select time range (v-model:selection = { start, end } in ms)
 */
const props = defineProps({
  data: { type: Array, default: () => [] }, // [{ t: ms, [series.key]: number }]
  series: { type: Array, default: () => [] }, // [{ key, label, color }]
  yFormat: { type: Function, default: (v) => String(v) },
  tooltipFormat: { type: Function, default: null }, // defaults to yFormat
  selectable: { type: Boolean, default: false },
  selection: { type: Object, default: null },
  showTotal: { type: Boolean, default: false }, // tooltip "Total" row
  lineWidth: { type: Number, default: 2 },
  axisTicks: { type: Boolean, default: true },
  class: { type: [String, Array, Object], default: "" },
});

const emit = defineEmits(["update:selection"]);

const margin = computed(() =>
  props.axisTicks
    ? { top: 12, right: 16, bottom: 28, left: 64 }
    : { top: 4, right: 4, bottom: 4, left: 4 },
);

// Same colour everywhere: chart config feeds the CSS vars the chart uses
const chartConfig = computed(() =>
  Object.fromEntries(props.series.map((s) => [s.key, { label: s.label, color: s.color }])),
);

// ---- Domains ----
const xDomain = computed(() => {
  const ts = props.data.map((d) => d.t);
  if (ts.length === 0) return [Date.now() - 60000, Date.now()];
  const lo = Math.min(...ts);
  const hi = Math.max(...ts);
  return lo === hi ? [lo - 30000, hi + 30000] : [lo, hi];
});

const yDomain = computed(() => {
  const values = [];
  for (const d of props.data) {
    for (const s of props.series) {
      const v = d[s.key];
      if (Number.isFinite(v)) values.push(v);
    }
  }
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  // 15% of the range above and below; a flat line gets 10% of its value
  const pad = range > 0 ? range * 0.15 : Math.abs(max) * 0.1 || 1;
  const lo = min >= 0 ? Math.max(0, min - pad) : min - pad;
  return [lo, max + pad];
});

const spanMs = computed(() => xDomain.value[1] - xDomain.value[0]);

function formatXTick(ms) {
  const span = spanMs.value;
  if (span <= 10 * 60 * 1000) return formatTimestamp(ms, { seconds: true, date: false });
  if (span <= 24 * 3600 * 1000) return formatTimestamp(ms, { date: false });
  return formatTimestamp(ms);
}

// ---- Tooltip ----
function tooltip(d) {
  const fmt = props.tooltipFormat ?? props.yFormat;
  const rows = props.series
    .map(
      (s) => `<div class="flex items-center justify-between gap-4">
        <span class="flex items-center gap-1.5 text-muted-foreground">
          <span class="size-2.5 rounded-xs" style="background:${escapeHtml(s.color)}"></span>${escapeHtml(s.label)}
        </span>
        <span class="font-mono font-medium text-foreground tabular-nums">${escapeHtml(fmt(d[s.key] ?? 0))}</span>
      </div>`,
    )
    .join("");
  const total = props.showTotal
    ? `<div class="flex items-center justify-between gap-4 border-t border-border/50 pt-1 mt-0.5">
        <span class="font-medium text-foreground">Total</span>
        <span class="font-mono font-semibold text-foreground tabular-nums">${escapeHtml(
          fmt(props.series.reduce((sum, s) => sum + (d[s.key] ?? 0), 0)),
        )}</span>
      </div>`
    : "";
  return `<div class="rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl grid gap-1 min-w-40">
    <div class="font-medium text-foreground">${escapeHtml(formatTimestamp(d.t, { seconds: spanMs.value <= 3600 * 1000 }))}</div>
    ${rows}${total}
  </div>`;
}

// ---- Drag to select ----
const wrapper = ref(null);
const width = ref(0);
useResizeObserver(wrapper, (entries) => {
  width.value = entries[0].contentRect.width;
});

const plotWidth = computed(() => Math.max(1, width.value - margin.value.left - margin.value.right));
const timeToX = (t) =>
  margin.value.left + ((t - xDomain.value[0]) / spanMs.value) * plotWidth.value;
const xToTime = (x) => {
  const frac = Math.min(1, Math.max(0, (x - margin.value.left) / plotWidth.value));
  return xDomain.value[0] + frac * spanMs.value;
};

const drag = ref(null); // { x0, x1 } in px while dragging

function localX(e) {
  return e.clientX - wrapper.value.getBoundingClientRect().left;
}

function onPointerDown(e) {
  if (!props.selectable || e.button !== 0 || props.data.length < 2) return;
  const x = localX(e);
  if (x < margin.value.left || x > margin.value.left + plotWidth.value) return;
  drag.value = { x0: x, x1: x };
  wrapper.value.setPointerCapture(e.pointerId);
}

function onPointerMove(e) {
  if (drag.value) drag.value = { ...drag.value, x1: localX(e) };
}

function onPointerUp(e) {
  if (!drag.value) return;
  const { x0, x1 } = drag.value;
  drag.value = null;
  wrapper.value.releasePointerCapture?.(e.pointerId);
  if (Math.abs(x1 - x0) < 6) return; // a click, not a drag
  const a = xToTime(Math.min(x0, x1));
  const b = xToTime(Math.max(x0, x1));
  emit("update:selection", { start: Math.round(a), end: Math.round(b) });
}

const band = computed(() => {
  const clamp = (x) =>
    Math.min(margin.value.left + plotWidth.value, Math.max(margin.value.left, x));
  if (drag.value) {
    const a = clamp(Math.min(drag.value.x0, drag.value.x1));
    const b = clamp(Math.max(drag.value.x0, drag.value.x1));
    return { left: a, width: b - a };
  }
  if (props.selection) {
    const a = clamp(timeToX(props.selection.start));
    const b = clamp(timeToX(props.selection.end));
    if (b - a <= 0) return null;
    return { left: a, width: b - a };
  }
  return null;
});
</script>

<template>
  <div
    ref="wrapper"
    :class="cn('relative', selectable && 'cursor-crosshair select-none touch-pan-y', props.class)"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="drag = null"
  >
    <ChartContainer :config="chartConfig" :cursor="axisTicks" class="h-full w-full aspect-auto">
      <VisXYContainer
        :data="data"
        :margin="margin"
        :auto-margin="false"
        :x-domain="xDomain"
        :y-domain="yDomain"
      >
        <VisLine
          v-for="s in series"
          :key="s.key"
          :x="(d) => d.t"
          :y="(d) => d[s.key]"
          :color="s.color"
          :line-width="lineWidth"
        />
        <template v-if="axisTicks">
          <VisAxis type="x" :num-ticks="5" :tick-format="formatXTick" :grid-line="false" />
          <VisAxis type="y" :num-ticks="5" :tick-format="yFormat" />
          <ChartCrosshair :template="tooltip" :color="(_d, i) => series[i]?.color" />
          <ChartTooltip />
        </template>
      </VisXYContainer>
    </ChartContainer>

    <div
      v-if="band"
      class="pointer-events-none absolute border-x-2 border-primary bg-primary/15"
      :style="{
        left: band.left + 'px',
        width: band.width + 'px',
        top: margin.top + 'px',
        bottom: margin.bottom + 'px',
      }"
    />
  </div>
</template>
