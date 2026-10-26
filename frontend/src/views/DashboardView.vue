<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getUser, logout } from "../services/auth";
import { getPortDisplayName } from "@/services/portConfig";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "@lucide/vue";
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
import { connectSocket, disconnectSocket } from "../services/socket";
import { Badge } from "@/components/ui/badge"
const router = useRouter();
const user = getUser();

function onLogout() {
  logout();
  router.push("/login");
}
// Line chart configuration
const chartConfig = {
  power: {
    label: "Power (kW)",
    color: "var(--chart-1)",
  },
};


const powerData = ref([]);


const portColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "oklch(0.68 0.16 160)",
];


function toChartPoint(reading, hour){
  const tstamp = new Date(reading.timestamp);
  return{
    hour,
    timeFormatted: tstamp.toLocaleString(),
    label: tstamp.toLocaleString([],{
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }),
    power: reading.totalWatts/1000,
  }
};


function buildDeviceData(reading = null) {
  const ports = reading?.ports ?? Array(6).fill(0);
  const totalUsage = ports.reduce((total, usage) => total + usage, 0);

  return ports.map((usage, port) => ({
    port,
    usage,
    percent: totalUsage > 0 ? (usage / totalUsage) * 100 : 0,
    color: portColors[port],
    device: getPortDisplayName(port),
  }));
};

const deviceData = ref(buildDeviceData());


const deviceChartConfig = computed(() => {
  const config = {};
  deviceData.value.forEach((item) => {
    config[`port${item.port}`] = {
      label: item.device,
      color: item.color,
    };
  });
  return config;
});

// Tooltip trigger for Donut / Pie chart segments
const donutTriggers = {
  [VisDonutSelectors.segment]: (d) => {
    const item = d?.data ?? d;
    return `
      <div class="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl min-w-32">
        <div class="font-medium text-foreground">${item.device}</div>
        <div class="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
          <span>Usage:</span>
          <span class="font-mono font-medium text-foreground">${item.usage} kWh</span>
        </div>
        <div class="flex items-center justify-between gap-3 text-muted-foreground">
          <span>Share:</span>
          <span class="font-mono font-medium text-foreground">${item.percent}%</span>
        </div>
        </div>
        `;
      },
    };
const latestReading = ref(null);
function setLatestReading(reading){
  latestReading.value = reading;
  deviceData.value = buildDeviceData(reading);
};
    
function handlePowerHistory(readings){
  powerData.value = readings.map(toChartPoint);
  if (readings.length > 0 ){
    setLatestReading(readings.at(-1));
    console.log("Latest reading: ", latestReading);
  }
};
const connected = ref(false);
let socket = null;

const powerTickValues = computed(() => {
  const lastHour = powerData.value.at(-1);
  if (lastHour <= 0){
    return[0];
    }
    return [...new Set([0, Math.floor(lastHour/2), lastHour])]
});

  function socketConnect() {
    connected.value = true;
  };

function socketDisconnect() {
  connected.value = false;
};

function handlePowerError(error){
  console.error("Power error", error.message);
};

function handlePowerUpdate(reading){
  if (latestReading.value?.id === reading.id){
    return;
  }
  setLatestReading(reading);
  powerData.value = [...powerData.value, 
      toChartPoint(reading, powerData.value.length)].slice(-48).map((point, index) => ({
        ...point, hour: index}));
};

function socketConnectionError(error) {
  console.error("Socket error", error.message)
};



onMounted(() => {
  socket = connectSocket();
  deviceData.value = buildDeviceData();
  connected.value = socket.connected;

  socket.on("connect", socketConnect);
  socket.on("disconnect", socketDisconnect);
  socket.on("connect_error", socketConnectionError);
  socket.on("power:history", handlePowerHistory);
  socket.on("power:update", handlePowerUpdate);
  socket.on("power:error", handlePowerError);
  socket.emit("power:refresh");
});


onUnmounted(() => {
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
        <p
          class="mt-1.5 text-sm text-muted-foreground flex items-center gap-2 m-0">
          <Badge :variant = "connected ? 'connected' : 'disconnected'">
            {{connected ? "Connected" : "Disconnected"}}
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

    <main class="flex flex-wrap gap-6">
      <!-- Line Chart: Power Usage (48 hours) -->
      <Card class="w-full lg:flex-1 min-w-[320px] flex flex-col">
        <CardHeader>
          <CardTitle>Power Usage (48 hours)</CardTitle>
          <CardDescription>
            Home energy consumption over the last 48 hours
          </CardDescription>
        </CardHeader>
        <CardContent class="flex-1 flex flex-col">
          <ChartContainer :config="chartConfig" :cursor="true" class="flex-1 w-full min-h-[260px]">
            <VisXYContainer
              :data="powerData"
              :margin="{ top: 12, right: 12, bottom: 28, left: 36 }"
            >
              <VisLine
                :x="(d) => d.hour"
                :y="(d) => d.power"
                color="var(--color-power)"
                :line-width="2"
              />
              <VisAxis
                type="x"
                :tick-values="powerTickValues"
                :tick-format="(val) => powerData[val]?.label ?? ''"
                :grid-line="false"
              />
              <VisAxis
                type="y"
                :num-ticks="5"
                :tick-format="(val) => `${val} kW`"
              />
              <ChartCrosshair
                :template="
                  componentToString(chartConfig, ChartTooltipContent, {
                    labelKey: 'formattedTime',
                  })
                "
                :color="() => 'var(--color-power)'"
              />
              <ChartTooltip />
            </VisXYContainer>
          </ChartContainer>
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
            Breakdown of 24-hour electricity usage (25.0 kWh total)
          </CardDescription>
        </CardHeader>
        <CardContent class="flex-1 flex flex-col items-center justify-between">
          <ChartContainer :config="deviceChartConfig" class="h-56 w-full">
            <VisSingleContainer
              :data="deviceData"
              :margin="{ top: 8, right: 8, bottom: 8, left: 8 }"
            >
              <VisDonut
                :value="(d) => d.usage"
                :color="(d) => d.color"
                :arc-width="0"
                :pad-angle="0.02"
              />
              <VisTooltip :triggers="donutTriggers" />
            </VisSingleContainer>
          </ChartContainer>

          <!-- Device Legend Grid -->
          <div class="grid grid-cols-2 gap-x-4 gap-y-2 pt-4 w-full text-xs">
            <div
              v-for="item in deviceData"
              :key="item.device"
              class="flex items-center justify-between gap-2"
            >
              <div class="flex items-center gap-1.5 truncate">
                <span
                  class="size-2.5 shrink-0 rounded-xs"
                  :style="{ backgroundColor: item.color }"
                />
                <span class="truncate text-muted-foreground">{{ item.device }}</span>
              </div>
              <span class="font-mono font-medium text-foreground shrink-0">
                {{ item.percent }}%
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter class="mt-auto">
          <Button variant="outline" class="w-full">
            View Details
          </Button>
        </CardFooter>
      </Card>
    </main>
  </div>
</template>
