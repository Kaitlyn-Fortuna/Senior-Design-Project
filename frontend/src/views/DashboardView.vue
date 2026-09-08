<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import { getUser, logout } from "../services/auth";
import { Button } from "@/components/ui/button";
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

// 48 hours of simulated home power usage data
const powerData = [
  // Day 1
  { hour: 0, formattedTime: "Day 1, 12:00 AM", label: "Day 1 12 AM", power: 0.85 },
  { hour: 1, formattedTime: "Day 1, 1:00 AM", label: "1 AM", power: 0.78 },
  { hour: 2, formattedTime: "Day 1, 2:00 AM", label: "2 AM", power: 0.72 },
  { hour: 3, formattedTime: "Day 1, 3:00 AM", label: "3 AM", power: 0.75 },
  { hour: 4, formattedTime: "Day 1, 4:00 AM", label: "4 AM", power: 0.82 },
  { hour: 5, formattedTime: "Day 1, 5:00 AM", label: "5 AM", power: 1.15 },
  { hour: 6, formattedTime: "Day 1, 6:00 AM", label: "6 AM", power: 2.34 },
  { hour: 7, formattedTime: "Day 1, 7:00 AM", label: "7 AM", power: 3.65 },
  { hour: 8, formattedTime: "Day 1, 8:00 AM", label: "8 AM", power: 3.92 },
  { hour: 9, formattedTime: "Day 1, 9:00 AM", label: "9 AM", power: 2.45 },
  { hour: 10, formattedTime: "Day 1, 10:00 AM", label: "10 AM", power: 1.82 },
  { hour: 11, formattedTime: "Day 1, 11:00 AM", label: "11 AM", power: 1.64 },
  { hour: 12, formattedTime: "Day 1, 12:00 PM", label: "Day 1 12 PM", power: 1.95 },
  { hour: 13, formattedTime: "Day 1, 1:00 PM", label: "1 PM", power: 1.74 },
  { hour: 14, formattedTime: "Day 1, 2:00 PM", label: "2 PM", power: 1.58 },
  { hour: 15, formattedTime: "Day 1, 3:00 PM", label: "3 PM", power: 1.86 },
  { hour: 16, formattedTime: "Day 1, 4:00 PM", label: "4 PM", power: 2.28 },
  { hour: 17, formattedTime: "Day 1, 5:00 PM", label: "5 PM", power: 3.42 },
  { hour: 18, formattedTime: "Day 1, 6:00 PM", label: "6 PM", power: 4.85 },
  { hour: 19, formattedTime: "Day 1, 7:00 PM", label: "7 PM", power: 4.52 },
  { hour: 20, formattedTime: "Day 1, 8:00 PM", label: "8 PM", power: 3.78 },
  { hour: 21, formattedTime: "Day 1, 9:00 PM", label: "9 PM", power: 2.86 },
  { hour: 22, formattedTime: "Day 1, 10:00 PM", label: "10 PM", power: 1.76 },
  { hour: 23, formattedTime: "Day 1, 11:00 PM", label: "11 PM", power: 1.24 },
  // Day 2
  { hour: 24, formattedTime: "Day 2, 12:00 AM", label: "Day 2 12 AM", power: 0.88 },
  { hour: 25, formattedTime: "Day 2, 1:00 AM", label: "1 AM", power: 0.76 },
  { hour: 26, formattedTime: "Day 2, 2:00 AM", label: "2 AM", power: 0.71 },
  { hour: 27, formattedTime: "Day 2, 3:00 AM", label: "3 AM", power: 0.79 },
  { hour: 28, formattedTime: "Day 2, 4:00 AM", label: "4 AM", power: 0.86 },
  { hour: 29, formattedTime: "Day 2, 5:00 AM", label: "5 AM", power: 1.22 },
  { hour: 30, formattedTime: "Day 2, 6:00 AM", label: "6 AM", power: 2.56 },
  { hour: 31, formattedTime: "Day 2, 7:00 AM", label: "7 AM", power: 4.12 },
  { hour: 32, formattedTime: "Day 2, 8:00 AM", label: "8 AM", power: 3.68 },
  { hour: 33, formattedTime: "Day 2, 9:00 AM", label: "9 AM", power: 2.62 },
  { hour: 34, formattedTime: "Day 2, 10:00 AM", label: "10 AM", power: 1.91 },
  { hour: 35, formattedTime: "Day 2, 11:00 AM", label: "11 AM", power: 1.72 },
  { hour: 36, formattedTime: "Day 2, 12:00 PM", label: "Day 2 12 PM", power: 2.08 },
  { hour: 37, formattedTime: "Day 2, 1:00 PM", label: "1 PM", power: 1.83 },
  { hour: 38, formattedTime: "Day 2, 2:00 PM", label: "2 PM", power: 1.62 },
  { hour: 39, formattedTime: "Day 2, 3:00 PM", label: "3 PM", power: 2.05 },
  { hour: 40, formattedTime: "Day 2, 4:00 PM", label: "4 PM", power: 2.48 },
  { hour: 41, formattedTime: "Day 2, 5:00 PM", label: "5 PM", power: 3.96 },
  { hour: 42, formattedTime: "Day 2, 6:00 PM", label: "6 PM", power: 5.18 },
  { hour: 43, formattedTime: "Day 2, 7:00 PM", label: "7 PM", power: 4.68 },
  { hour: 44, formattedTime: "Day 2, 8:00 PM", label: "8 PM", power: 3.95 },
  { hour: 45, formattedTime: "Day 2, 9:00 PM", label: "9 PM", power: 3.12 },
  { hour: 46, formattedTime: "Day 2, 10:00 PM", label: "10 PM", power: 1.98 },
  { hour: 47, formattedTime: "Day 2, 11:00 PM", label: "11 PM", power: 1.32 },
];

// Device energy consumption data (24-hour period, total: 25.0 kWh)
const deviceData = [
  { device: "HVAC / Air Conditioning", usage: 10.0, percent: 40, color: "var(--chart-1)" },
  { device: "Water Heater", usage: 4.25, percent: 17, color: "var(--chart-2)" },
  { device: "Refrigerator", usage: 3.25, percent: 13, color: "var(--chart-3)" },
  { device: "Oven & Stove", usage: 2.75, percent: 11, color: "var(--chart-4)" },
  { device: "Washing Machine", usage: 2.5, percent: 10, color: "var(--chart-5)" },
  { device: "Dishwasher", usage: 2.25, percent: 9, color: "oklch(0.68 0.16 160)" },
];

const deviceChartConfig = {
  hvac: { label: "HVAC / Air Conditioning", color: "var(--chart-1)" },
  waterHeater: { label: "Water Heater", color: "var(--chart-2)" },
  refrigerator: { label: "Refrigerator", color: "var(--chart-3)" },
  oven: { label: "Oven & Stove", color: "var(--chart-4)" },
  washer: { label: "Washing Machine", color: "var(--chart-5)" },
  dishwasher: { label: "Dishwasher", color: "oklch(0.68 0.16 160)" },
};

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
</script>

<template>
  <div class="max-w-275 mx-auto px-5 pt-7 pb-12 flex flex-col gap-6">
    <header class="flex justify-between items-center gap-4">
      <div>
        <h1 class="text-2xl font-bold text-foreground m-0">Energy Monitor</h1>
        <p
          class="mt-1.5 text-sm text-muted-foreground flex items-center gap-2 m-0"
        >
          <span v-if="user"> · {{ user.username }}</span>
        </p>
      </div>
      <Button variant="outline" @click="onLogout"> Log out </Button>
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
                :tick-values="[0, 12, 24, 36, 47]"
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
          <Button variant="outline" class="w-full">
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
