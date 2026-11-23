<script setup>
import { computed, ref, watch } from "vue";
import { XIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { fetchEnergy } from "@/services/power";
import {
  formatDuration,
  formatEnergy,
  formatMoney,
  formatPower,
  formatTimestamp,
} from "@/lib/format";

/**
 * Energy (kWh) and cost for a selected time range, total and per device.
 * Cost uses the price saved with each reading.
 */
const props = defineProps({
  selection: { type: Object, required: true }, // { start, end } ms
  devices: { type: Array, required: true }, // [{ port, label, color }]
});
const emit = defineEmits(["clear", "result"]);

const loading = ref(false);
const error = ref("");
const result = ref(null);
let seq = 0;

async function load() {
  const id = ++seq;
  loading.value = true;
  error.value = "";
  try {
    const data = await fetchEnergy({
      startDate: new Date(props.selection.start).toISOString(),
      endDate: new Date(props.selection.end).toISOString(),
    });
    if (id === seq) result.value = data;
  } catch (err) {
    if (id === seq) error.value = err.message;
  } finally {
    if (id === seq) loading.value = false;
  }
}

watch(() => [props.selection.start, props.selection.end], load, { immediate: true });

const rows = computed(() => {
  const r = result.value;
  if (!r) return [];
  const list = props.devices.map((d) => ({
    ...d,
    kWh: r.energyWh[d.port] / 1000,
    cost: r.cost[d.port],
    avgW: r.avgW[d.port],
  }));
  const max = Math.max(...list.map((x) => x.kWh), 0);
  return list.map((x) => ({ ...x, share: max > 0 ? x.kWh / max : 0 }));
});

const totals = computed(() => {
  const kWh = rows.value.reduce((s, r) => s + r.kWh, 0);
  const cost = rows.value.reduce((s, r) => s + r.cost, 0);
  const seconds = result.value?.seconds ?? 0;
  return { kWh, cost, seconds, avgW: seconds > 0 ? (kWh * 3.6e6) / seconds : 0 };
});

watch(
  [totals, rows],
  () => {
    if (!result.value) return;
    emit("result", {
      start: new Date(props.selection.start).toISOString(),
      end: new Date(props.selection.end).toISOString(),
      totalKWh: +totals.value.kWh.toFixed(4),
      totalCost: +totals.value.cost.toFixed(4),
      averageW: +totals.value.avgW.toFixed(1),
      devices: rows.value.map((r) => ({
        name: r.label,
        kWh: +r.kWh.toFixed(4),
        cost: +r.cost.toFixed(4),
      })),
    });
  },
  { immediate: true },
);
</script>

<template>
  <div class="rounded-lg border border-primary/40 bg-primary/5 p-4 flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground m-0">
          Selected range
        </p>
        <p class="text-sm text-foreground m-0 mt-0.5">
          {{ formatTimestamp(selection.start, { seconds: true }) }} –
          {{ formatTimestamp(selection.end, { seconds: true }) }}
          <span class="text-muted-foreground">
            ({{ formatDuration((selection.end - selection.start) / 1000) }})
          </span>
        </p>
      </div>
      <Button variant="ghost" size="icon-sm" aria-label="Clear selection" @click="emit('clear')">
        <XIcon />
      </Button>
    </div>

    <div v-if="loading && !result" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner class="size-4" /> Calculating…
    </div>
    <p v-else-if="error" class="text-sm text-destructive m-0">{{ error }}</p>

    <template v-else-if="result">
      <p v-if="result.count === 0" class="text-sm text-muted-foreground m-0">
        No readings were recorded in this range.
      </p>
      <template v-else>
        <div class="grid grid-cols-3 gap-3">
          <div>
            <p class="text-xs text-muted-foreground m-0">Energy</p>
            <p class="text-xl font-semibold text-foreground m-0 tabular-nums">
              {{ formatEnergy(totals.kWh) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground m-0">Cost</p>
            <p class="text-xl font-semibold text-foreground m-0 tabular-nums">
              {{ formatMoney(totals.cost) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground m-0">Average power</p>
            <p class="text-xl font-semibold text-foreground m-0 tabular-nums">
              {{ formatPower(totals.avgW) }}
            </p>
          </div>
        </div>

        <ul class="flex flex-col gap-1.5 m-0 p-0 list-none text-xs">
          <li v-for="r in rows" :key="r.port" class="grid grid-cols-[minmax(0,9rem)_1fr_auto_auto] items-center gap-3">
            <span class="flex items-center gap-1.5 truncate text-muted-foreground">
              <span class="size-2.5 shrink-0 rounded-xs" :style="{ backgroundColor: r.color }" />
              <span class="truncate">{{ r.label }}</span>
            </span>
            <span class="h-1.5 rounded-full bg-muted overflow-hidden">
              <span class="block h-full rounded-full" :style="{ width: r.share * 100 + '%', backgroundColor: r.color }" />
            </span>
            <span class="font-mono text-foreground tabular-nums text-right">{{ formatEnergy(r.kWh) }}</span>
            <span class="font-mono text-muted-foreground tabular-nums text-right w-16">{{ formatMoney(r.cost) }}</span>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
