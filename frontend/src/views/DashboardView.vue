<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getUser, logout } from "../services/auth";
import {
  getPortDisplayName,
  getSavedPortNames,
  getPortVoltageIndex,
  isPortEnabled,
} from "@/services/portConfig";
import { formatPower, formatCurrent, formatVoltage, formatPf, formatPercent } from "@/lib/format";
import Sparkline from "@/components/live/Sparkline.vue";
import AnimatedNumber from "@/components/live/AnimatedNumber.vue";
import { Button } from "@/components/ui/button";
import { SettingsIcon, ZapIcon } from "@lucide/vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
} from "@/components/ui/chart";
import {
  VisAxis,
  VisDonut,
  VisDonutSelectors,
  VisLine,
  VisSingleContainer,
  VisTooltip,
  VisXYContainer,
} from "@unovis/vue";
import { connectSocket } from "../services/socket";
import { Badge } from "@/components/ui/badge";

const router = useRouter();
const user = getUser();

function onLogout() {
  logout();
  router.push("/login");
}

// ---- Timing ----
const LIVE_POINTS = 60; // readings kept for the live sparklines
const CHART_POINTS = 48; // points on the power line chart
const CHART_REFRESH_MS = 10_000; // line + pie charts redraw this often (live cards update on every reading)

const portColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.68 0.16 160)",
];
const voltageColor = "oklch(0.75 0.15 70)";

// ---- Incoming data ----
const latestReading = ref(null); // newest reading from the socket
const liveHistory = ref([]); // last LIVE_POINTS readings, oldest first
const powerData = ref([]); // line chart points (watts), updated slowly
let pending = []; // readings not yet drawn on the slow charts

function toChartPoint(reading) {
  const tstamp = new Date(reading.timestamp);
  return {
    timeFormatted: tstamp.toLocaleString(),
    label: tstamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }),
    watts: reading.totalWatts,
  };
}

// ---- Live cards (update on every reading) ----
const names = () => getSavedPortNames();
const voltageName = (i) => names()[6 + i] || `V${i}`;

const liveVoltages = computed(() =>
  [0, 1]
    .filter((i) => isPortEnabled(6 + i))
    .map((i) => ({
      key: `v${i}`,
      name: voltageName(i),
      voltage: latestReading.value?.voltages?.[i] ?? 0,
      history: liveHistory.value.map((r) => r.voltages?.[i] ?? 0),
    })),
);

const liveClamps = computed(() =>
  [0, 1, 2, 3, 4, 5]
    .filter((port) => isPortEnabled(port))
    .map((port) => {
      const r = latestReading.value;
      const leg = getPortVoltageIndex(port);
      return {
        port,
        key: `c${port}`,
        name: getPortDisplayName(port),
        color: portColors[port],
        power: r?.ports?.[port] ?? 0,
        current: r?.currents?.[port] ?? 0,
        voltage: r?.voltages?.[leg] ?? 0,
        legName: voltageName(leg),
        pf: r?.powerFactors?.[port] ?? 0,
        history: liveHistory.value.map((h) => h.currents?.[port] ?? 0),
      };
    }),
);

// Total of the clamps that are turned on
const liveTotal = computed(() => liveClamps.value.reduce((sum, c) => sum + c.power, 0));

// ---- Line chart (slow) with automatic W / kW ----
const chartUnit = computed(() => {
  const max = Math.max(0, ...powerData.value.map((p) => p.watts));
  return max >= 1000 ? { unit: "kW", div: 1000 } : { unit: "W", div: 1 };
});

const chartPoints = computed(() =>
  powerData.value.map((p, index) => ({ ...p, index, power: p.watts / chartUnit.value.div })),
);

const chartConfig = computed(() => ({
  power: { label: `Power (${chartUnit.value.unit})`, color: "var(--chart-1)" },
}));

const powerTickValues = computed(() => {
  const last = chartPoints.value.length - 1;
  if (last <= 0) return [0];
  return [...new Set([0, Math.floor(last / 2), last])];
});

const formatAxis = (val) => {
  const n = Number(val);
  const decimals = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
  return `${n.toFixed(decimals)} ${chartUnit.value.unit}`;
};

// ---- Pie chart (slow) ----
function buildDeviceData(reading = null) {
  const ports = reading?.ports ?? Array(6).fill(0);
  const enabled = ports.map((usage, port) => ({ usage, port })).filter((d) => isPortEnabled(d.port));
  const total = enabled.reduce((sum, d) => sum + d.usage, 0);
  return enabled.map(({ usage, port }) => ({
    port,
    usage,
    percent: total > 0 ? (usage / total) * 100 : 0,
    color: portColors[port],
    device: getPortDisplayName(port),
  }));
}

const deviceData = ref(buildDeviceData());
const deviceTotal = computed(() => deviceData.value.reduce((sum, d) => sum + d.usage, 0));

const deviceChartConfig = computed(() => {
  const config = {};
  deviceData.value.forEach((item) => {
    config[`port${item.port}`] = { label: item.device, color: item.color };
  });
  return config;
});

const donutTriggers = {
  [VisDonutSelectors.segment]: (d) => {
    const item = d?.data ?? d;
    return `
      <div class="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl min-w-32">
        <div class="font-medium text-foreground">${item.device}</div>
        <div class="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
          <span>Power:</span>
          <span class="font-mono font-medium text-foreground">${formatPower(item.usage)}</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-muted-foreground">
          <span>Share:</span>
          <span class="font-mono font-medium text-foreground">${formatPercent(item.percent)}</span>
        </div>
      </div>
    `;
  },
};

// Draw anything new on the slow charts
function flushCharts() {
  if (pending.length === 0) return;
  powerData.value = [...powerData.value, ...pending.map(toChartPoint)].slice(-CHART_POINTS);
  deviceData.value = buildDeviceData(latestReading.value);
  pending = [];
}

// ---- Socket ----
const connected = ref(false);
let socket = null;
let chartTimer = null;

function handlePowerHistory(readings) {
  if (readings.length === 0) return;
  latestReading.value = readings.at(-1);
  liveHistory.value = readings.slice(-LIVE_POINTS);
  powerData.value = readings.slice(-CHART_POINTS).map(toChartPoint);
  deviceData.value = buildDeviceData(latestReading.value);
  pending = [];
}

function handlePowerUpdate(reading) {
  if (latestReading.value?.id === reading.id) return;
  latestReading.value = reading;
  liveHistory.value = [...liveHistory.value, reading].slice(-LIVE_POINTS);
  pending.push(reading);
}

const socketConnect = () => (connected.value = true);
const socketDisconnect = () => (connected.value = false);
const handlePowerError = (error) => console.error("Power error", error.message);
const socketConnectionError = (error) => console.error("Socket error", error.message);

onMounted(() => {
  socket = connectSocket();
  connected.value = socket.connected;

  socket.on("connect", socketConnect);
  socket.on("disconnect", socketDisconnect);
  socket.on("connect_error", socketConnectionError);
  socket.on("power:history", handlePowerHistory);
  socket.on("power:update", handlePowerUpdate);
  socket.on("power:error", handlePowerError);
  socket.emit("power:refresh");

  chartTimer = setInterval(flushCharts, CHART_REFRESH_MS);
});

onUnmounted(() => {
  clearInterval(chartTimer);
  if (socket) {
    socket.off("power:history", handlePowerHistory);
    socket.off("power:update", handlePowerUpdate);
    socket.off("power:error", handlePowerError);
    socket.off("connect", socketConnect);
    socket.off("disconnect", socketDisconnect);
    socket.off("connect_error", socketConnectionError);
  }
});
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

    <!-- ===== Live ===== -->
    <section class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="text-lg font-semibold text-foreground m-0">Live</h2>
        <span class="text-sm text-muted-foreground">
          Total
          <strong class="text-foreground"><AnimatedNumber :value="liveTotal" :format="formatPower" /></strong>
        </span>
      </div>

      <p v-if="!latestReading" class="text-sm text-muted-foreground m-0">Waiting for readings…</p>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Voltage sensors -->
        <Card v-for="v in liveVoltages" :key="v.key" class="gap-3 py-4">
          <CardHeader class="px-4">
            <div class="flex items-center justify-between gap-2">
              <CardTitle class="flex items-center gap-2 truncate">
                <ZapIcon class="size-4 text-muted-foreground" />
                <span class="truncate">{{ v.name }}</span>
              </CardTitle>
              <Badge variant="outline" class="font-mono">{{ v.key.toUpperCase() }}</Badge>
            </div>
          </CardHeader>
          <CardContent class="px-4 flex flex-col gap-2">
            <div class="text-2xl font-semibold text-foreground">
              <AnimatedNumber :value="v.voltage" :format="formatVoltage" />
            </div>
            <Sparkline :values="v.history" :color="voltageColor" />
            <span class="text-xs text-muted-foreground">Voltage, last {{ v.history.length }} readings</span>
          </CardContent>
        </Card>

        <!-- Current clamps -->
        <Card v-for="c in liveClamps" :key="c.key" class="gap-3 py-4">
          <CardHeader class="px-4">
            <div class="flex items-center justify-between gap-2">
              <CardTitle class="flex items-center gap-2 truncate">
                <span class="size-2.5 shrink-0 rounded-xs" :style="{ backgroundColor: c.color }" />
                <span class="truncate">{{ c.name }}</span>
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
                <dt class="text-muted-foreground truncate" :title="`Voltage from ${c.legName}`">Voltage</dt>
                <dd class="m-0 font-medium text-foreground"><AnimatedNumber :value="c.voltage" :format="formatVoltage" /></dd>
              </div>
              <div>
                <dt class="text-muted-foreground">PF</dt>
                <dd class="m-0 font-medium text-foreground"><AnimatedNumber :value="c.pf" :format="formatPf" /></dd>
              </div>
            </dl>
            <Sparkline :values="c.history" :color="c.color" />
            <span class="text-xs text-muted-foreground">Current, last {{ c.history.length }} readings</span>
          </CardContent>
        </Card>
      </div>
    </section>

    <main class="flex flex-wrap gap-6">
      <!-- Line Chart: Power Usage -->
      <Card class="w-full lg:flex-1 min-w-[320px] flex flex-col">
        <CardHeader>
          <CardTitle>Power Usage</CardTitle>
          <CardDescription>
            Total power, last {{ chartPoints.length }} readings (refreshes every {{ CHART_REFRESH_MS / 1000 }} s)
          </CardDescription>
        </CardHeader>
        <CardContent class="flex-1 flex flex-col">
          <ChartContainer :config="chartConfig" :cursor="true" class="flex-1 w-full min-h-[260px]">
            <VisXYContainer :data="chartPoints" :margin="{ top: 12, right: 12, bottom: 28, left: 52 }">
              <VisLine :x="(d) => d.index" :y="(d) => d.power" color="var(--color-power)" :line-width="2" />
              <VisAxis
                type="x"
                :tick-values="powerTickValues"
                :tick-format="(val) => chartPoints[val]?.label ?? ''"
                :grid-line="false"
              />
              <VisAxis type="y" :num-ticks="5" :tick-format="formatAxis" />
              <ChartCrosshair
                :template="componentToString(chartConfig, ChartTooltipContent, { labelKey: 'formattedTime' })"
                :color="() => 'var(--color-power)'"
              />
              <ChartTooltip />
            </VisXYContainer>
          </ChartContainer>
        </CardContent>
        <CardFooter class="mt-auto">
          <Button variant="outline" class="w-full" @click="router.push('/details')">View Details</Button>
        </CardFooter>
      </Card>

      <!-- Pie Chart: Power By Device -->
      <Card class="w-full lg:flex-1 min-w-[320px] flex flex-col">
        <CardHeader>
          <CardTitle>Power By Device</CardTitle>
          <CardDescription>Share of current power use ({{ formatPower(deviceTotal) }} total)</CardDescription>
        </CardHeader>
        <CardContent class="flex-1 flex flex-col items-center justify-between">
          <ChartContainer :config="deviceChartConfig" class="h-56 w-full">
            <VisSingleContainer :data="deviceData" :margin="{ top: 8, right: 8, bottom: 8, left: 8 }">
              <VisDonut :value="(d) => d.usage" :color="(d) => d.color" :arc-width="0" :pad-angle="0.02" />
              <VisTooltip :triggers="donutTriggers" />
            </VisSingleContainer>
          </ChartContainer>

          <!-- Device legend -->
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 w-full text-xs">
            <div v-for="item in deviceData" :key="item.port" class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 truncate">
                <span class="size-2.5 shrink-0 rounded-xs" :style="{ backgroundColor: item.color }" />
                <span class="truncate text-muted-foreground">{{ item.device }}</span>
              </div>
              <span class="font-mono font-medium text-foreground shrink-0">{{ formatPercent(item.percent) }}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter class="mt-auto">
          <Button variant="outline" class="w-full" @click="router.push('/details')">View Details</Button>
        </CardFooter>
      </Card>
    </main>
  </div>
</template>
