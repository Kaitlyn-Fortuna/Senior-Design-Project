<script setup>
import { computed } from "vue";

// Tiny line chart for a recent history of values (no axes).
const props = defineProps({
  values: { type: Array, default: () => [] }, // numbers, oldest first
  color: { type: String, default: "var(--chart-1)" },
  height: { type: Number, default: 36 },
});

const W = 100; // drawing width in viewBox units (stretched to fit)

const points = computed(() => {
  const v = props.values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return "";
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1; // flat line when nothing changes
  const pad = 2;
  const h = props.height - pad * 2;
  return v
    .map((x, i) => {
      const px = (i / (v.length - 1)) * W;
      const py = pad + h - ((x - min) / span) * h;
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(" ");
});

// Same line closed to the bottom, for a faint fill
const area = computed(() => (points.value ? `0,${props.height} ${points.value} ${W},${props.height}` : ""));
</script>

<template>
  <svg
    :viewBox="`0 0 ${W} ${height}`"
    preserveAspectRatio="none"
    class="w-full"
    :style="{ height: height + 'px' }"
    aria-hidden="true"
  >
    <polygon v-if="area" :points="area" :fill="color" opacity="0.12" />
    <polyline
      v-if="points"
      :points="points"
      fill="none"
      :stroke="color"
      stroke-width="1.75"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
