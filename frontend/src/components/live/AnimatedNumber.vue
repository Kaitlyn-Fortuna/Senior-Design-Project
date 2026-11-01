<script setup>
import { ref, watch, onUnmounted } from "vue";

// Shows a number that glides to each new value instead of jumping.
const props = defineProps({
  value: { type: Number, default: 0 },
  format: { type: Function, default: (n) => n.toFixed(1) },
  duration: { type: Number, default: 400 }, // ms
});

const shown = ref(props.value);
let frame = null;

watch(
  () => props.value,
  (to) => {
    cancelAnimationFrame(frame);
    const from = shown.value;
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      shown.value = to;
      return;
    }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / props.duration);
      const eased = 1 - (1 - t) ** 3; // ease-out
      shown.value = from + (to - from) * eased;
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  },
);

onUnmounted(() => cancelAnimationFrame(frame));
</script>

<template>
  <span class="tabular-nums">{{ format(shown) }}</span>
</template>
