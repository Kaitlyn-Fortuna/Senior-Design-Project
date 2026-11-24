<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { getUser, logout } from "../services/auth";
import {
  enabledCurrentInputs,
  enabledVoltageInputs,
  pricePerKwh,
} from "@/services/inputs";
import { fetchPowerSeries } from "@/services/power";
import { setChatContext, clearChatContext } from "@/services/chatContext";
import { useLiveReadings } from "@/composables/useLiveReadings";
import {
  formatBucket,
  formatCurrent,
  formatDuration,
  formatEnergy,
  formatMoney,
  formatPf,
  formatPower,
  formatTimestamp,
  formatVoltage,
  escapeHtml,
} from "@/lib/format";
import Sparkline from "@/components/live/Sparkline.vue";
import AnimatedNumber from "@/components/live/AnimatedNumber.vue";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart.vue";
import EnergySelectionCard from "@/components/charts/EnergySelectionCard.vue";
import SummarizeButton from "@/components/summary/SummarizeButton.vue";
import SummaryPanel from "@/components/summary/SummaryPanel.vue";
import { powerProfile, useAiSummary } from "@/composables/useAiSummary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  ActivityIcon,
  DollarSignIcon,
  MousePointerClickIcon,
  RadioIcon,
  SettingsIcon,
  ZapIcon,
} from "@lucide/vue";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import {
  VisAxis,
  VisDonut,
  VisDonutSelectors,
  VisSingleContainer,
  VisStackedBar,
  VisStackedBarSelectors,
  VisTooltip,
  VisXYContainer,
} from "@unovis/vue";

const router = useRouter();
const user = getUser();

function onLogout() {
  logout();
  router.push("/login");
}

const HISTORY_SECONDS = 48 * 3600;
const COST_WINDOW_SECONDS = 3600;
const REFRESH_MS = 20_000;

const devices = enabledCurrentInputs; // only inputs that are turned on

// ---- Live ----
const { history, latest, connected, isLive, ageSeconds } = useLiveReadings();

// Voltage of a leg: what the clamps on that leg measured
function legVoltage(reading, leg) {
  if (!reading?.voltages) return 0;
  const onLeg = devices.value.filter((d) => d.leg === leg).map((d) => d.port);
  for (const port of onLeg) {
    if (reading.voltages[port] > 0) return reading.voltages[port];
  }
  return 0;
}

const liveVoltages = computed(() =>
  enabledVoltageInputs.value.map((v) => ({
    ...v,
    voltage: legVoltage(latest.value, v.port),
    history: history.value.map((r) => legVoltage(r, v.port)),
  })),
);

const liveClamps = computed(() =>
  devices.value.map((d) => {
    const r = latest.value;
    return {
      ...d,
      power: r?.ports?.[d.port] ?? 0,
      current: r?.currents?.[d.port] ?? 0,
      voltage: r?.voltages?.[d.port] ?? 0,
      pf: r?.powerFactors?.[d.port] ?? 0,
      history: history.value.map((h) => h.ports?.[d.port] ?? 0),
    };
  }),
);

const liveTotal = computed(() => liveClamps.value.reduce((s, c) => s + c.power, 0));

// Live chart: last readings, one line per input
const liveChartData = computed(() =>
  history.value.map((r) => {
    const point = { t: Date.parse(r.timestamp) };
    for (const d of devices.value) point[d.key] = r.ports?.[d.port] ?? 0;
    return point;
  }),
);

// Price: the one saved with the newest reading, else the configured price
const currentPrice = computed(() =>
  latest.value?.price > 0 ? latest.value.price : pricePerKwh.value,
);
const costPerHour = computed(() => (liveTotal.value / 1000) * currentPrice.value);

// ---- 48-hour history ----
const series = ref({ points: [], bucketSeconds: null, span: null });
const seriesLoading = ref(true);
const seriesError = ref("");
const selection = ref(null);
const selectionResult = ref(null);

async function loadSeries() {
  try {
    series.value = await fetchPowerSeries({ sinceSeconds: HISTORY_SECONDS, maxPoints: 300 });
    seriesError.value = "";
  } catch (err) {
    seriesError.value = err.message;
  } finally {
    seriesLoading.value = false;
  }
}

const totalSeries = computed(() => [{ key: "total", label: "Total", color: "var(--chart-3)" }]);
const historyChartData = computed(() =>
  series.value.points.map((p) => ({
    t: Date.parse(p.timestamp),
    total: devices.value.reduce((s, d) => s + p.ports[d.port], 0),
  })),
);

const historyTotals = computed(() => {
  const perDevice = devices.value.map((d) => {
    const wh = series.value.points.reduce((s, p) => s + p.energyWh[d.port], 0);
    const cost = series.value.points.reduce((s, p) => s + p.cost[d.port], 0);
    return { ...d, kWh: wh / 1000, cost };
  });
  const kWh = perDevice.reduce((s, d) => s + d.kWh, 0);
  const cost = perDevice.reduce((s, d) => s + d.cost, 0);
  return {
    kWh,
    cost,
    devices: perDevice.map((d) => ({ ...d, percent: kWh > 0 ? (d.kWh / kWh) * 100 : 0 })),
  };
});

const historyPeak = computed(() => {
  let best = null;
  for (const p of historyChartData.value) if (!best || p.total > best.total) best = p;
  return best;
});

const historyDescription = computed(() => {
  const s = series.value;
  if (!s.span) return "No readings in the last 48 hours";
  const covered = (Date.parse(s.span.last) - Date.parse(s.span.first)) / 1000;
  return `${formatDuration(covered)} of readings · ${formatBucket(s.bucketSeconds)} averages`;
});

const kwFormat = (w) => formatPower(w);

// ---- Pie: energy by device (48 h) ----
const pieData = computed(() => historyTotals.value.devices.filter((d) => d.kWh > 0));
const pieConfig = computed(() =>
  Object.fromEntries(devices.value.map((d) => [d.key, { label: d.label, color: d.color }])),
);
const formatPercent = (p) => `${p.toFixed(1)}%`;

const donutTriggers = {
  [VisDonutSelectors.segment]: (d) => {
    const item = d?.data ?? d;
    return `
      <div class="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl min-w-36">
        <div class="font-medium text-foreground">${escapeHtml(item.label)}</div>
        <div class="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
          <span>Energy:</span>
          <span class="font-mono font-medium text-foreground">${formatEnergy(item.kWh)}</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-muted-foreground">
          <span>Cost:</span>
          <span class="font-mono font-medium text-foreground">${formatMoney(item.cost)}</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-muted-foreground">
          <span>Share:</span>
          <span class="font-mono font-medium text-foreground">${formatPercent(item.percent)}</span>
        </div>
      </div>`;
  },
};

// ---- Cost per minute (last hour) ----
const costSeries = ref({ points: [] });

async function loadCost() {
  try {
    costSeries.value = await fetchPowerSeries({
      sinceSeconds: COST_WINDOW_SECONDS,
      bucketSeconds: 60,
    });
  } catch (err) {
    console.error("Could not load cost data:", err.message);
  }
}

const costBars = computed(() =>
  costSeries.value.points.map((p) => {
    const bar = { t: Date.parse(p.timestamp) };
    for (const d of devices.value) bar[d.key] = p.cost[d.port];
    bar.total = devices.value.reduce((s, d) => s + p.cost[d.port], 0);
    return bar;
  }),
);
const costHourTotal = computed(() => costBars.value.reduce((s, b) => s + b.total, 0));
const costMaxMinute = computed(() =>
  costBars.value.reduce((best, b) => (!best || b.total > best.total ? b : best), null),
);
const costAccessors = computed(() => devices.value.map((d) => (b) => b[d.key]));
const costColors = (_d, i) => devices.value[i]?.color;

const costTriggers = {
  [VisStackedBarSelectors.bar]: (d) => {
    // Unovis binds each bar segment to { datum, index, stackIndex, ... }; unwrap to our row.
    const b = d?.datum ?? d;
    const rows = devices.value
      .filter((d) => b[d.key] > 0)
      .map(
        (d) => `<div class="flex items-center justify-between gap-3 text-muted-foreground">
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-xs" style="background:${escapeHtml(d.color)}"></span>${escapeHtml(d.label)}</span>
          <span class="font-mono text-foreground">${formatMoney(b[d.key])}</span></div>`,
      )
      .join("");
    return `<div class="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl grid gap-1 min-w-40">
      <div class="font-medium text-foreground">${formatTimestamp(b.t, { date: false })} (1 min)</div>
      ${rows}
      <div class="flex justify-between gap-3 border-t border-border/50 pt-1"><span class="font-medium">Total</span>
      <span class="font-mono font-semibold">${formatMoney(b.total)}</span></div></div>`;
  },
};

// ---- Refresh ----
let refreshTimer = null;
onMounted(() => {
  loadSeries();
  loadCost();
  refreshTimer = setInterval(() => {
    loadSeries();
    loadCost();
  }, REFRESH_MS);
});
onUnmounted(() => clearInterval(refreshTimer));

// Live data just started (e.g. meter turned on): refresh the charts right away
watch(isLive, (live, was) => {
  if (live && !was) {
    loadSeries();
    loadCost();
  }
});

watch(selection, (s) => {
  if (!s) selectionResult.value = null;
});

// ---- Chat assistant summary ----
const round = (n, d = 2) => +Number(n || 0).toFixed(d);

function chatSummary() {
  return {
    page: "Dashboard",
    pricePerKwh: currentPrice.value,
    enabledInputs: devices.value.map((d) => d.label),
    live: isLive.value
      ? {
          totalW: round(liveTotal.value, 1),
          costPerHour: round(costPerHour.value, 4),
          inputs: liveClamps.value.map((c) => ({
            name: c.label,
            W: round(c.power, 1),
            A: round(c.current, 3),
            V: round(c.voltage, 1),
            pf: round(c.pf),
          })),
          voltages: liveVoltages.value.map((v) => ({ name: v.label, V: round(v.voltage, 1) })),
        }
      : {
          status: "not receiving live data",
          lastReadingSecondsAgo: ageSeconds.value === null ? null : Math.round(ageSeconds.value),
        },
    last48Hours: {
      dataCovers: historyDescription.value,
      totalKWh: round(historyTotals.value.kWh, 4),
      totalCost: round(historyTotals.value.cost, 4),
      peakAveragePowerW: historyPeak.value ? round(historyPeak.value.total, 1) : null,
      peakAt: historyPeak.value ? new Date(historyPeak.value.t).toLocaleString() : null,
      byDevice: historyTotals.value.devices.map((d) => ({
        name: d.label,
        kWh: round(d.kWh, 4),
        cost: round(d.cost, 4),
        percent: Math.round(d.percent),
      })),
    },
    lastHourCost: {
      total: round(costHourTotal.value, 4),
      minutesWithData: costBars.value.length,
      mostExpensiveMinute: costMaxMinute.value
        ? { at: new Date(costMaxMinute.value.t).toLocaleTimeString(), cost: round(costMaxMinute.value.total, 4) }
        : null,
    },
    chartSelection: selectionResult.value,
  };
}

onMounted(() => setChatContext("dashboard", chatSummary));

// ---- Inline "Summarize" for the 48-hour charts ----
const historySummary = useAiSummary("dashboard-48h", () => {
  const { last48Hours, lastHourCost, live, pricePerKwh } = chatSummary();
  const points = series.value.points.map((p) => {
    const point = { t: Date.parse(p.timestamp), total: 0 };
    for (const d of devices.value) {
      point[d.key] = p.ports[d.port];
      point.total += p.ports[d.port];
    }
    return point;
  });
  return {
    pricePerKwh,
    last48Hours,
    lastHourCost,
    liveNow: live.totalW !== undefined ? { totalW: live.totalW, costPerHour: live.costPerHour } : live,
    profileWatts: powerProfile(points, devices.value.map((d) => d.key), {
      max: 48,
      labelFor: (k) => devices.value.find((d) => d.key === k)?.label ?? k,
    }),
  };
});
onUnmounted(() => clearChatContext("dashboard", chatSummary));
</script>

<template>
  <div class="max-w-275 mx-auto px-5 pt-7 pb-12 flex flex-col gap-6">
    <header class="flex justify-between items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-foreground m-0">Energy Monitor</h1>
        <p class="mt-1.5 text-sm text-muted-foreground flex items-center gap-2 m-0">
          <Badge :variant="connected ? 'connected' : 'disconnected'">
            {{ connected ? "Connected" : "Disconnected" }}
          </Badge>
          <span v-if="user"> · {{ user.username }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="router.push('/setup')">
          <SettingsIcon data-icon="inline-start" />
          Setup
        </Button>
        <Button variant="outline" @click="onLogout"> Log out </Button>
      </div>
    </header>

    <!-- ===== Live (only while readings arrive in real time) ===== -->
    <section v-if="isLive" class="flex flex-col gap-4" aria-label="Live readings">
      <Card class="gap-4">
        <CardHeader>
          <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle class="flex items-center gap-2">
                <span class="relative flex size-2.5">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span class="relative inline-flex size-2.5 rounded-full bg-green-500" />
                </span>
                Live
              </CardTitle>
              <CardDescription>Power per input, last {{ history.length }} readings</CardDescription>
            </div>
            <div class="flex gap-6 text-right">
              <div>
                <p class="text-xs text-muted-foreground m-0">Total power</p>
                <p class="text-3xl font-semibold text-foreground m-0">
                  <AnimatedNumber :value="liveTotal" :format="formatPower" />
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground m-0">Costing now</p>
                <p class="text-3xl font-semibold text-foreground m-0">
                  <AnimatedNumber :value="costPerHour" :format="(v) => formatMoney(v) + '/h'" />
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TimeSeriesChart
            :data="liveChartData"
            :series="devices"
            :y-format="kwFormat"
            show-total
            class="h-56"
          />
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card v-for="v in liveVoltages" :key="v.key" class="gap-3 py-4">
          <CardHeader class="px-4">
            <div class="flex items-center justify-between gap-2">
              <CardTitle class="flex items-center gap-2 truncate">
                <ZapIcon class="size-4 shrink-0" :style="{ color: v.color }" />
                <span class="truncate">{{ v.label }}</span>
              </CardTitle>
              <Badge variant="outline" class="font-mono">{{ v.key.toUpperCase() }}</Badge>
            </div>
          </CardHeader>
          <CardContent class="px-4 flex flex-col gap-2">
            <div class="text-2xl font-semibold text-foreground">
              <AnimatedNumber :value="v.voltage" :format="formatVoltage" />
            </div>
            <Sparkline :values="v.history" :color="v.color" />
            <span class="text-xs text-muted-foreground">Voltage</span>
          </CardContent>
        </Card>

        <Card v-for="c in liveClamps" :key="c.key" class="gap-3 py-4">
          <CardHeader class="px-4">
            <div class="flex items-center justify-between gap-2">
              <CardTitle class="flex items-center gap-2 truncate">
                <span class="size-2.5 shrink-0 rounded-xs" :style="{ backgroundColor: c.color }" />
                <span class="truncate">{{ c.label }}</span>
              </CardTitle>
              <Badge variant="outline" class="font-mono">{{ c.key.toUpperCase() }}</Badge>
            </div>
          </CardHeader>
          <CardContent class="px-4 flex flex-col gap-2">
            <div class="text-2xl font-semibold text-foreground">
              <AnimatedNumber :value="c.power" :format="formatPower" />
            </div>
            <dl class="grid grid-cols-3 gap-2 text-xs m-0">
              <div>
                <dt class="text-muted-foreground">Current</dt>
                <dd class="m-0 font-medium text-foreground"><AnimatedNumber :value="c.current" :format="formatCurrent" /></dd>
              </div>
              <div>
                <dt class="text-muted-foreground">Voltage</dt>
                <dd class="m-0 font-medium text-foreground"><AnimatedNumber :value="c.voltage" :format="formatVoltage" /></dd>
              </div>
              <div>
                <dt class="text-muted-foreground">PF</dt>
                <dd class="m-0 font-medium text-foreground"><AnimatedNumber :value="c.pf" :format="formatPf" /></dd>
              </div>
            </dl>
            <Sparkline :values="c.history" :color="c.color" />
            <span class="text-xs text-muted-foreground">Power</span>
          </CardContent>
        </Card>
      </div>
    </section>

    <div
      v-else
      class="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
    >
      <RadioIcon class="size-4 shrink-0" />
      <span>
        Not receiving live data<template v-if="ageSeconds !== null">
          · last reading {{ formatDuration(ageSeconds) }} ago</template>. The live view appears when the meter is sending readings.
      </span>
    </div>

    <main class="flex flex-wrap gap-6">
      <!-- Line Chart: Power Usage (48 hours) -->
      <Card class="w-full lg:flex-1 min-w-[320px] flex flex-col">
        <CardHeader>
          <CardTitle>Power Usage (48 hours)</CardTitle>
          <CardDescription>{{ historyDescription }}</CardDescription>
          <CardAction v-if="historyChartData.length">
            <SummarizeButton :loading="historySummary.loading.value" @click="historySummary.generate()" />
          </CardAction>
        </CardHeader>
        <CardContent class="flex-1 flex flex-col gap-3">
          <div v-if="seriesLoading" class="h-[260px] flex items-center justify-center">
            <Spinner class="size-6 text-primary" />
          </div>
          <p v-else-if="seriesError" class="text-sm text-destructive m-0">{{ seriesError }}</p>
          <div
            v-else-if="historyChartData.length === 0"
            class="h-[260px] flex items-center justify-center text-sm text-muted-foreground"
          >
            No readings in the last 48 hours.
          </div>
          <template v-else>
            <TimeSeriesChart
              v-model:selection="selection"
              :data="historyChartData"
              :series="totalSeries"
              :y-format="kwFormat"
              selectable
              class="h-[260px]"
            />
            <SummaryPanel :summary="historySummary" title="Last 48 hours" />
            <EnergySelectionCard
              v-if="selection"
              :selection="selection"
              :points="historyChartData"
              :devices="devices"
              @clear="selection = null"
              @result="selectionResult = $event"
            />
            <p v-else class="flex items-center gap-1.5 text-xs text-muted-foreground m-0">
              <MousePointerClickIcon class="size-3.5" />
              Drag across the chart to see the energy and cost for that time.
            </p>
          </template>
        </CardContent>
        <CardFooter class="mt-auto">
          <Button variant="outline" class="w-full" @click="router.push('/details')">
            View Details
          </Button>
        </CardFooter>
      </Card>

      <!-- Pie Chart: Energy Consumption By Device -->
      <Card class="w-full lg:flex-1 min-w-[320px] flex flex-col">
        <CardHeader>
          <CardTitle>Energy Consumption By Device</CardTitle>
          <CardDescription>
            Last 48 hours · {{ formatEnergy(historyTotals.kWh) }} total ·
            {{ formatMoney(historyTotals.cost) }}
          </CardDescription>
        </CardHeader>
        <CardContent class="flex-1 flex flex-col items-center justify-between">
          <ChartContainer v-if="pieData.length" :config="pieConfig" class="h-56 w-full">
            <VisSingleContainer :data="pieData" :margin="{ top: 8, right: 8, bottom: 8, left: 8 }">
              <VisDonut
                :value="(d) => d.kWh"
                :color="(d) => d.color"
                :arc-width="0"
                :pad-angle="0.02"
              />
              <VisTooltip :triggers="donutTriggers" />
            </VisSingleContainer>
          </ChartContainer>
          <div v-else class="h-56 flex items-center justify-center text-sm text-muted-foreground">
            No energy used yet.
          </div>

          <div class="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 w-full text-xs">
            <div
              v-for="item in historyTotals.devices"
              :key="item.key"
              class="flex items-center justify-between gap-2"
            >
              <div class="flex items-center gap-1.5 truncate">
                <span class="size-2.5 shrink-0 rounded-xs" :style="{ backgroundColor: item.color }" />
                <span class="truncate text-muted-foreground">{{ item.label }}</span>
              </div>
              <span class="font-mono font-medium text-foreground shrink-0">
                {{ formatPercent(item.percent) }}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter class="mt-auto">
          <Button variant="outline" class="w-full" @click="router.push('/details')">
            View Details
          </Button>
        </CardFooter>
      </Card>

      <!-- Cost of power -->
      <Card class="w-full">
        <CardHeader>
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle class="flex items-center gap-2">
                <DollarSignIcon class="size-4 text-muted-foreground" />
                Cost of Power
              </CardTitle>
              <CardDescription>
                Cost of each 1-minute interval over the last hour at
                {{ formatMoney(currentPrice) }}/kWh
              </CardDescription>
            </div>
            <dl class="grid grid-cols-3 gap-6 m-0 text-right">
              <div>
                <dt class="text-xs text-muted-foreground">Right now</dt>
                <dd class="m-0 text-lg font-semibold text-foreground tabular-nums">
                  <template v-if="isLive">{{ formatMoney(costPerHour / 60) }}/min</template>
                  <span v-else class="text-muted-foreground">—</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">Per hour at this rate</dt>
                <dd class="m-0 text-lg font-semibold text-foreground tabular-nums">
                  <template v-if="isLive">{{ formatMoney(costPerHour) }}</template>
                  <span v-else class="text-muted-foreground">—</span>
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted-foreground">Last hour</dt>
                <dd class="m-0 text-lg font-semibold text-foreground tabular-nums">
                  {{ formatMoney(costHourTotal) }}
                </dd>
              </div>
            </dl>
          </div>
        </CardHeader>
        <CardContent>
          <ChartContainer v-if="costBars.length" :config="pieConfig" class="h-48 w-full aspect-auto">
            <VisXYContainer
              :data="costBars"
              :margin="{ top: 8, right: 12, bottom: 28, left: 64 }"
              :y-domain-min-constraint="[0, 0]"
            >
              <VisStackedBar
                :x="(b) => b.t"
                :y="costAccessors"
                :color="costColors"
                :bar-padding="0.15"
                :rounded-corners="2"
              />
              <VisAxis
                type="x"
                :num-ticks="6"
                :tick-format="(t) => formatTimestamp(t, { date: false })"
                :grid-line="false"
              />
              <VisAxis type="y" :num-ticks="4" :tick-format="formatMoney" />
              <VisTooltip :triggers="costTriggers" />
            </VisXYContainer>
          </ChartContainer>
          <div v-else class="h-48 flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
            <ActivityIcon class="size-5" />
            No usage recorded in the last hour.
          </div>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
