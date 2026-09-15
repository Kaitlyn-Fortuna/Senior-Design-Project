<script setup>
import { ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { getUser } from "@/services/auth";
import {
  DEFAULT_DEVICES,
  LOOKBACK_OPTIONS,
  generateTimeSeriesData,
} from "@/services/deviceData";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
} from "@/components/ui/chart";
import { VisAxis, VisLine, VisXYContainer } from "@unovis/vue";
import {
  ArrowLeftIcon,
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from "@lucide/vue";

const router = useRouter();
const user = getUser();

// Devices list - dynamic and ready for API data
const devices = ref(DEFAULT_DEVICES);

// Lookback filter state (default 48 hours)
const selectedRange = ref("48h");

// Raw generated 15-minute time-series data
const timeSeriesData = computed(() =>
  generateTimeSeriesData(selectedRange.value, devices.value)
);

// Dynamic Chart Configuration based on devices list
const chartConfig = computed(() => {
  const config = {};
  devices.value.forEach((device) => {
    config[device.key] = {
      label: device.label,
      color: device.color,
    };
  });
  return config;
});

// Calculate tick indices for X-axis (approx 6 ticks across the range)
const tickIndices = computed(() => {
  const len = timeSeriesData.value.length;
  if (len === 0) return [];
  const count = 6;
  const step = Math.max(1, Math.floor((len - 1) / (count - 1)));
  const ticks = [];
  for (let i = 0; i < count - 1; i++) {
    ticks.push(i * step);
  }
  ticks.push(len - 1);
  return ticks;
});

// Format tick labels based on current time span
function formatXTick(val) {
  const point = timeSeriesData.value[val];
  if (!point) return "";
  if (selectedRange.value === "12h" || selectedRange.value === "24h") {
    return point.timeStr;
  }
  return `${point.dateStr} ${point.timeStr}`;
}

// Table sort order (default: newest first for intuitive inspection)
const sortOrder = ref("desc"); // 'asc' or 'desc'
function toggleSort() {
  sortOrder.value = sortOrder.value === "asc" ? "desc" : "asc";
}

// Sorted data for table display
const sortedTableData = computed(() => {
  const copy = [...timeSeriesData.value];
  if (sortOrder.value === "desc") {
    return copy.reverse();
  }
  return copy;
});

// Pagination state
const pageSize = ref(20);
const currentPage = ref(1);
const pageInput = ref(1);

const totalPages = computed(() =>
  Math.max(1, Math.ceil(sortedTableData.value.length / pageSize.value))
);

const paginatedTableData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedTableData.value.slice(start, start + pageSize.value);
});

// Sync pageInput when currentPage changes
watch(currentPage, (val) => {
  pageInput.value = val;
});

// Reset page when time range changes
watch(selectedRange, () => {
  currentPage.value = 1;
});

function onPageChange(e) {
  const raw = e?.target ? e.target.value : pageInput.value;
  let page = parseInt(raw, 10);
  if (isNaN(page)) {
    pageInput.value = currentPage.value;
    return;
  }
  if (page < 1) page = 1;
  if (page > totalPages.value) page = totalPages.value;
  currentPage.value = page;
  pageInput.value = page;
}

function firstPage() {
  currentPage.value = 1;
}

function lastPage() {
  currentPage.value = totalPages.value;
}

function prevPage() {
  if (currentPage.value > 1) {
    currentPage.value--;
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-12 flex flex-col gap-6 w-full">
    <!-- Page Header -->
    <header class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <Button variant="outline" size="sm" @click="router.push('/')">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to Dashboard
        </Button>
        <span v-if="user" class="text-sm text-muted-foreground">
          Logged in as <strong class="text-foreground">{{ user.username }}</strong>
        </span>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground m-0">
            Power Usage Details
          </h1>
          <p class="mt-1 text-sm text-muted-foreground m-0">
            15-minute interval power consumption across all monitored devices.
          </p>
        </div>

        <!-- Filter Panel -->
        <div class="flex items-center gap-2">
          <label for="range-select" class="text-sm font-medium text-muted-foreground whitespace-nowrap">
            Look Back:
          </label>
          <Select v-model="selectedRange">
            <SelectTrigger id="range-select" class="w-44">
              <SelectValue placeholder="Select lookback" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="option in LOOKBACK_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>

    <!-- Main Content: Chart above Table, both taking full width -->
    <main class="flex flex-col gap-6 w-full">
      <!-- 1. Chart Section (Full Width) -->
      <Card class="w-full">
        <CardHeader class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Device Power Usage Trends</CardTitle>
            <CardDescription>
              Power trends over time on 15-minute increments ({{ timeSeriesData.length }} data points)
            </CardDescription>
          </div>
          <Badge variant="secondary" class="self-start sm:self-auto font-mono">
            {{ timeSeriesData.length }} intervals
          </Badge>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <ChartContainer
            :config="chartConfig"
            :cursor="true"
            class="w-full h-80 min-h-[300px]"
          >
            <VisXYContainer
              :data="timeSeriesData"
              :margin="{ top: 16, right: 20, bottom: 32, left: 40 }"
            >
              <!-- Multi-line chart: Line for each device -->
              <VisLine
                v-for="device in devices"
                :key="device.key"
                :x="(d) => d.index"
                :y="(d) => d[device.key]"
                :color="device.color"
                :line-width="2"
              />
              <VisAxis
                type="x"
                :tick-values="tickIndices"
                :tick-format="formatXTick"
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
                :color="() => 'var(--primary)'"
              />
              <ChartTooltip />
            </VisXYContainer>
          </ChartContainer>

          <!-- Dynamic Device Legend -->
          <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 border-t border-border/50 text-xs">
            <div
              v-for="device in devices"
              :key="device.key"
              class="flex items-center gap-2"
            >
              <span
                class="size-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: device.color }"
              />
              <span class="text-muted-foreground font-medium">{{ device.label }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 2. Table Section (Full Width, below Chart) -->
      <Card class="w-full">
        <CardHeader class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Readings Data Table</CardTitle>
            <CardDescription>
              15-minute interval power consumption by device matching the chart.
            </CardDescription>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="toggleSort">
              <ArrowUpDownIcon data-icon="inline-start" />
              {{ sortOrder === 'desc' ? 'Newest First' : 'Oldest First' }}
            </Button>
          </div>
        </CardHeader>
        <CardContent class="p-0 sm:p-6 sm:pt-0">
          <div class="rounded-md border border-border/50 overflow-hidden">
            <div class="max-h-[460px] overflow-auto">
              <Table>
                <TableHeader class="sticky top-0 bg-card z-10 shadow-xs">
                  <TableRow>
                    <TableHead class="min-w-40 font-semibold">Time</TableHead>
                    <!-- Dynamic headers for each device -->
                    <TableHead
                      v-for="device in devices"
                      :key="device.key"
                      class="text-right font-semibold whitespace-nowrap min-w-32"
                    >
                      <div class="flex items-center justify-end gap-1.5">
                        <span
                          class="size-2 rounded-full shrink-0"
                          :style="{ backgroundColor: device.color }"
                        />
                        <span>{{ device.label }}</span>
                      </div>
                    </TableHead>
                    <TableHead class="text-right font-semibold min-w-28">Total (kW)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="row in paginatedTableData"
                    :key="row.timestamp"
                  >
                    <TableCell class="font-medium whitespace-nowrap text-foreground">
                      {{ row.formattedTime }}
                    </TableCell>
                    <!-- Dynamic columns matching each device -->
                    <TableCell
                      v-for="device in devices"
                      :key="device.key"
                      class="text-right font-mono text-muted-foreground"
                    >
                      {{ row[device.key] }} kW
                    </TableCell>
                    <TableCell class="text-right font-mono font-medium text-foreground">
                      {{ row.total }} kW
                    </TableCell>
                  </TableRow>
                  <TableRow v-if="paginatedTableData.length === 0">
                    <TableCell :colspan="devices.length + 2" class="h-24 text-center text-muted-foreground">
                      No data available for this range.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
        <CardFooter class="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/50 pt-4">
          <div class="text-xs text-muted-foreground">
            Showing
            <strong class="font-medium text-foreground">
              {{ sortedTableData.length === 0 ? 0 : (currentPage - 1) * pageSize + 1 }}
            </strong>
            to
            <strong class="font-medium text-foreground">
              {{ Math.min(currentPage * pageSize, sortedTableData.length) }}
            </strong>
            of
            <strong class="font-medium text-foreground">
              {{ sortedTableData.length }}
            </strong>
            entries
          </div>

          <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <!-- First Page -->
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage <= 1"
              aria-label="First page"
              @click="firstPage"
            >
              <ChevronsLeftIcon data-icon="inline-start" />
              <span class="hidden sm:inline">First</span>
            </Button>

            <!-- Previous Page -->
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage <= 1"
              aria-label="Previous page"
              @click="prevPage"
            >
              <ChevronLeftIcon data-icon="inline-start" />
              <span class="hidden sm:inline">Previous</span>
            </Button>

            <!-- Page Number Input in between -->
            <div class="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
              <span>Page</span>
              <Input
                v-model="pageInput"
                type="number"
                min="1"
                :max="totalPages"
                class="h-8 w-16 text-center text-xs"
                aria-label="Enter page number"
                @change="onPageChange"
                @keydown.enter="onPageChange"
                @blur="onPageChange"
              />
              <span>of {{ totalPages }}</span>
            </div>

            <!-- Next Page -->
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage >= totalPages"
              aria-label="Next page"
              @click="nextPage"
            >
              <span class="hidden sm:inline">Next</span>
              <ChevronRightIcon data-icon="inline-end" />
            </Button>

            <!-- Last Page -->
            <Button
              variant="outline"
              size="sm"
              :disabled="currentPage >= totalPages"
              aria-label="Last page"
              @click="lastPage"
            >
              <span class="hidden sm:inline">Last</span>
              <ChevronsRightIcon data-icon="inline-end" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  </div>
</template>
