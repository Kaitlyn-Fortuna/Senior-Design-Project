<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getUser } from "@/services/auth";
import {
  getDevices,
  generateTimeSeriesData,
  formatDateForInput,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FilterIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from "@lucide/vue";
import { cn } from "@/lib/utils";

const router = useRouter();
const user = getUser();

// Devices list - dynamic and loaded with saved port names (ports 0-5)
const devices = ref(getDevices());

// Selected device keys for filtering (defaults to all devices)
const selectedDeviceKeys = ref(devices.value.map((d) => d.key));

onMounted(() => {
  const currentDevices = getDevices();
  devices.value = currentDevices;
  if (selectedDeviceKeys.value.length === 0) {
    selectedDeviceKeys.value = currentDevices.map((d) => d.key);
  }
});

// Active devices based on filter selection
const activeDevices = computed(() =>
  devices.value.filter((d) => selectedDeviceKeys.value.includes(d.key))
);

function toggleDevice(key) {
  if (selectedDeviceKeys.value.includes(key)) {
    selectedDeviceKeys.value = selectedDeviceKeys.value.filter((k) => k !== key);
  } else {
    selectedDeviceKeys.value = [...selectedDeviceKeys.value, key];
  }
}

function selectAllDevices() {
  selectedDeviceKeys.value = devices.value.map((d) => d.key);
}

function deselectAllDevices() {
  selectedDeviceKeys.value = [];
}

// Collapsible filter panel state (default open)
const isFilterOpen = ref(true);

// Date range state (defaults to past 7 days up to today)
const today = new Date();
const todayDateStr = formatDateForInput(today);
const defaultStartDate = formatDateForInput(
  new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
);
const customStartDate = ref(defaultStartDate);
const customEndDate = ref(todayDateStr);

// Date range validation
const isDateRangeInvalid = computed(() => {
  if (!customStartDate.value || !customEndDate.value) return true;
  return new Date(customStartDate.value) > new Date(customEndDate.value);
});

// Shortcut buttons for custom date range
function applyDateShortcut(days) {
  const end = new Date();
  const start = new Date();
  if (days === 0) {
    customStartDate.value = formatDateForInput(start);
    customEndDate.value = formatDateForInput(end);
  } else {
    start.setDate(start.getDate() - days);
    customStartDate.value = formatDateForInput(start);
    customEndDate.value = formatDateForInput(end);
  }
}

// Check if any filters are modified from defaults
const isFilterModified = computed(() => {
  return (
    customStartDate.value !== defaultStartDate ||
    customEndDate.value !== todayDateStr ||
    selectedDeviceKeys.value.length !== devices.value.length
  );
});

function resetFilters() {
  customStartDate.value = defaultStartDate;
  customEndDate.value = todayDateStr;
  selectAllDevices();
}

// Active range display summary text
const activeRangeLabel = computed(() => {
  if (!customStartDate.value || !customEndDate.value) return "Custom Range";
  return `${customStartDate.value} to ${customEndDate.value}`;
});

// Raw generated 15-minute time-series data based on the active date range
const timeSeriesData = computed(() => {
  if (isDateRangeInvalid.value) return [];
  return generateTimeSeriesData(
    {
      mode: "custom",
      startDate: customStartDate.value,
      endDate: customEndDate.value,
    },
    devices.value
  );
});

// Dynamic Chart Configuration based ONLY on active devices
const chartConfig = computed(() => {
  const config = {};
  activeDevices.value.forEach((device) => {
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
  if (customStartDate.value === customEndDate.value) {
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

// Calculate row total dynamically from only active devices
function getRowTotal(row) {
  const sum = activeDevices.value.reduce(
    (acc, device) => acc + (Number(row[device.key]) || 0),
    0
  );
  return Number(sum.toFixed(2));
}

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

// Reset page when any filter changes
watch(
  [
    customStartDate,
    customEndDate,
    selectedDeviceKeys,
  ],
  () => {
    currentPage.value = 1;
  }
);

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

      <div class="flex flex-col gap-1 border-b border-border/50 pb-5">
        <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground m-0">
          Power Usage Details
        </h1>
        <p class="text-sm text-muted-foreground m-0">
          15-minute interval power consumption analysis with customizable date ranges and device filters.
        </p>
      </div>
    </header>

    <!-- Collapsible Filter Panel -->
    <Collapsible v-model:open="isFilterOpen" class="w-full">
      <Card class="w-full">
        <CardHeader class="pb-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <FilterIcon class="text-primary size-4" />
              <div>
                <CardTitle class="text-base sm:text-lg">Filter & Focus Readings</CardTitle>
                <CardDescription class="text-xs sm:text-sm">
                  Specify a date range and select monitored devices to inspect.
                </CardDescription>
              </div>
            </div>

            <div class="flex items-center gap-2 self-start sm:self-auto">
              <Button
                v-if="isFilterModified"
                variant="outline"
                size="sm"
                @click="resetFilters"
              >
                <RotateCcwIcon data-icon="inline-start" />
                Reset
              </Button>

              <!-- Collapse / Expand Toggle Button -->
              <CollapsibleTrigger as-child>
                <Button variant="outline" size="sm">
                  <component
                    :is="isFilterOpen ? ChevronUpIcon : ChevronDownIcon"
                    data-icon="inline-start"
                  />
                  {{ isFilterOpen ? "Collapse Filters" : "Expand Filters" }}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <!-- Active Filter Summary (Always visible in the header for immediate glanceability) -->
          <div class="flex flex-wrap items-center gap-2 pt-2.5 text-xs text-muted-foreground">
            <span class="font-medium text-foreground">Active Filters:</span>
            <Badge variant="secondary" class="gap-1 font-normal">
              <CalendarIcon class="size-3" />
              <span>{{ activeRangeLabel }}</span>
            </Badge>
            <Badge variant="secondary" class="gap-1 font-normal">
              <SlidersHorizontalIcon class="size-3" />
              <span>{{ activeDevices.length }} of {{ devices.length }} devices</span>
            </Badge>
            <Badge variant="outline" class="font-mono text-xs">
              {{ timeSeriesData.length }} intervals
            </Badge>
          </div>
        </CardHeader>

        <!-- Detailed Filter Controls (Collapsible) -->
        <CollapsibleContent>
          <CardContent class="flex flex-col gap-4 pt-3 border-t border-border/50">
            <!-- Date Range Filter Row -->
            <div class="flex flex-col gap-2.5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Date Range
                </span>

                <!-- Quick Date Range Shortcuts -->
                <div class="flex items-center flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    @click="applyDateShortcut(0)"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    @click="applyDateShortcut(2)"
                  >
                    48 Hours
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    @click="applyDateShortcut(7)"
                  >
                    7 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    @click="applyDateShortcut(14)"
                  >
                    14 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    @click="applyDateShortcut(30)"
                  >
                    30 Days
                  </Button>
                </div>
              </div>

              <!-- Date Input Fields -->
              <FieldGroup class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <Field :data-invalid="isDateRangeInvalid" class="w-full sm:w-48">
                  <FieldLabel for="start-date" class="text-xs">
                    Start Date
                  </FieldLabel>
                  <Input
                    id="start-date"
                    v-model="customStartDate"
                    type="date"
                    :max="customEndDate || todayDateStr"
                    :aria-invalid="isDateRangeInvalid"
                    class="w-full"
                  />
                </Field>

                <Field :data-invalid="isDateRangeInvalid" class="w-full sm:w-48">
                  <FieldLabel for="end-date" class="text-xs">
                    End Date
                  </FieldLabel>
                  <Input
                    id="end-date"
                    v-model="customEndDate"
                    type="date"
                    :min="customStartDate"
                    :max="todayDateStr"
                    :aria-invalid="isDateRangeInvalid"
                    class="w-full"
                  />
                </Field>
              </FieldGroup>

              <FieldError v-if="isDateRangeInvalid">
                Start date must be before or equal to end date.
              </FieldError>
            </div>

            <Separator />

            <!-- Monitored Devices Filter Row (Direct Inline Badges) -->
            <div class="flex flex-col gap-2.5">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Monitored Devices
                  </span>
                  <Badge variant="secondary" class="font-mono text-xs">
                    {{ activeDevices.length }} of {{ devices.length }} active
                  </Badge>
                </div>

                <div class="flex items-center gap-2 text-xs">
                  <Button
                    variant="ghost"
                    size="xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click="selectAllDevices"
                  >
                    Select All
                  </Button>
                  <Separator orientation="vertical" class="h-3" />
                  <Button
                    variant="ghost"
                    size="xs"
                    class="text-muted-foreground hover:text-foreground"
                    @click="deselectAllDevices"
                  >
                    Clear All
                  </Button>
                </div>
              </div>

              <!-- Interactive Device Badges -->
              <div class="flex flex-wrap items-center gap-2">
                <button
                  v-for="device in devices"
                  :key="device.key"
                  type="button"
                  :class="
                    cn(
                      'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all cursor-pointer',
                      selectedDeviceKeys.includes(device.key)
                        ? 'bg-card text-foreground border-border shadow-xs hover:border-primary/50'
                        : 'bg-muted/40 text-muted-foreground border-transparent opacity-50 line-through hover:opacity-75'
                    )
                  "
                  :aria-pressed="selectedDeviceKeys.includes(device.key)"
                  @click="toggleDevice(device.key)"
                >
                  <span
                    class="size-2.5 rounded-full shrink-0"
                    :style="{ backgroundColor: device.color }"
                  />
                  <span>{{ device.label }}</span>
                  <Badge
                    variant="outline"
                    class="ml-0.5 px-1 py-0 text-[10px] font-mono leading-none border-border/70"
                  >
                    Port {{ device.port }}
                  </Badge>
                  <CheckIcon
                    v-if="selectedDeviceKeys.includes(device.key)"
                    class="size-3 text-primary shrink-0 ml-0.5"
                  />
                </button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>

    <!-- Main Content: Chart above Table, both taking full width -->
    <main class="flex flex-col gap-6 w-full">
      <!-- 1. Chart Section (Full Width) -->
      <Card class="w-full">
        <CardHeader class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Device Power Usage Trends</CardTitle>
            <CardDescription>
              Power trends over time on 15-minute increments for selected devices.
            </CardDescription>
          </div>
          <Badge variant="secondary" class="self-start sm:self-auto font-mono">
            {{ timeSeriesData.length }} data points
          </Badge>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <!-- Empty State when no devices are selected -->
          <Empty
            v-if="activeDevices.length === 0"
            class="h-72 border border-dashed border-border rounded-lg"
          >
            <EmptyMedia variant="icon">
              <SlidersHorizontalIcon />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No devices selected</EmptyTitle>
              <EmptyDescription>
                Select one or more devices in the filter panel above to display consumption trends.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" @click="selectAllDevices">
                Select All Devices
              </Button>
            </EmptyContent>
          </Empty>

          <!-- Empty State when custom date range yields no data or is invalid -->
          <Empty
            v-else-if="timeSeriesData.length === 0"
            class="h-72 border border-dashed border-border rounded-lg"
          >
            <EmptyMedia variant="icon">
              <CalendarIcon />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No data found</EmptyTitle>
              <EmptyDescription>
                Please choose a valid date range to view power usage readings.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button size="sm" @click="resetFilters">
                Reset to Default Range
              </Button>
            </EmptyContent>
          </Empty>

          <!-- Multi-Line Chart Container -->
          <template v-else>
            <ChartContainer
              :config="chartConfig"
              :cursor="true"
              class="w-full h-80 min-h-[300px]"
            >
              <VisXYContainer
                :data="timeSeriesData"
                :margin="{ top: 16, right: 20, bottom: 32, left: 40 }"
              >
                <!-- Multi-line chart: Line for each ACTIVE device -->
                <VisLine
                  v-for="device in activeDevices"
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

            <!-- Interactive Device Legend (Clicking any legend item toggles it) -->
            <div class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 border-t border-border/50 text-xs">
              <button
                v-for="device in devices"
                :key="device.key"
                type="button"
                :class="
                  cn(
                    'flex items-center gap-2 cursor-pointer transition-opacity rounded-sm px-1 py-0.5',
                    !selectedDeviceKeys.includes(device.key) && 'opacity-40 line-through'
                  )
                "
                :title="
                  selectedDeviceKeys.includes(device.key)
                    ? 'Click to hide ' + device.label
                    : 'Click to show ' + device.label
                "
                @click="toggleDevice(device.key)"
              >
                <span
                  class="size-2.5 rounded-full shrink-0"
                  :style="{ backgroundColor: device.color }"
                />
                <span class="text-muted-foreground font-medium hover:text-foreground">
                  {{ device.label }}
                </span>
              </button>
            </div>
          </template>
        </CardContent>
      </Card>

      <!-- 2. Table Section (Full Width, below Chart) -->
      <Card class="w-full">
        <CardHeader class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>Readings Data Table</CardTitle>
            <CardDescription>
              15-minute interval power consumption for currently active devices matching the chart.
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
                    <!-- Dynamic headers for each ACTIVE device -->
                    <TableHead
                      v-for="device in activeDevices"
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
                    <!-- Dynamic columns matching each ACTIVE device -->
                    <TableCell
                      v-for="device in activeDevices"
                      :key="device.key"
                      class="text-right font-mono text-muted-foreground"
                    >
                      {{ row[device.key] }} kW
                    </TableCell>
                    <!-- Row total summing active devices -->
                    <TableCell class="text-right font-mono font-medium text-foreground">
                      {{ getRowTotal(row) }} kW
                    </TableCell>
                  </TableRow>

                  <!-- Empty state for no active devices -->
                  <TableRow v-if="activeDevices.length === 0">
                    <TableCell :colspan="devices.length + 2" class="h-28 text-center text-muted-foreground">
                      No devices selected. Select at least one device in the filter panel above to display readings.
                    </TableCell>
                  </TableRow>

                  <!-- Empty state for no data rows -->
                  <TableRow v-else-if="paginatedTableData.length === 0">
                    <TableCell :colspan="activeDevices.length + 2" class="h-24 text-center text-muted-foreground">
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
