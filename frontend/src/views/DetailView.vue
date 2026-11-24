<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { getUser } from "@/services/auth";
import { allCurrentInputs, enabledCurrentInputs } from "@/services/inputs";
import { fetchPowerSeries } from "@/services/power";
import { setChatContext, clearChatContext } from "@/services/chatContext";
import {
  formatBucket,
  formatDateForInput,
  formatEnergy,
  formatMoney,
  formatPower,
  formatTimestamp,
} from "@/lib/format";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart.vue";
import EnergySelectionCard from "@/components/charts/EnergySelectionCard.vue";
import SummarizeButton from "@/components/summary/SummarizeButton.vue";
import SummaryPanel from "@/components/summary/SummaryPanel.vue";
import { powerProfile, useAiSummary } from "@/composables/useAiSummary";
import { Switch } from "@/components/ui/switch";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DatePicker from "@/components/DatePicker.vue";
import { Spinner } from "@/components/ui/spinner";
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
  EyeOffIcon,
  MousePointerClickIcon,
  RadioIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from "@lucide/vue";
import { cn } from "@/lib/utils";

const router = useRouter();
const user = getUser();

const AUTO_REFRESH_MS = 15_000;
const MAX_POINTS = 500;

// ---- Devices ----
// Disabled inputs are hidden unless "Show disabled sources" is on (for history)
const showDisabled = ref(false);
const devices = computed(() =>
  showDisabled.value ? allCurrentInputs.value : enabledCurrentInputs.value,
);
const hiddenCount = computed(
  () => allCurrentInputs.value.length - enabledCurrentInputs.value.length,
);

// Selected device keys for filtering (defaults to all devices)
const selectedDeviceKeys = ref(allCurrentInputs.value.map((d) => d.key));

// Turning disabled sources on shows them straight away
watch(showDisabled, (on) => {
  if (!on) return;
  const add = allCurrentInputs.value.filter((d) => !d.enabled).map((d) => d.key);
  selectedDeviceKeys.value = [...new Set([...selectedDeviceKeys.value, ...add])];
});

// Active devices based on filter selection
const activeDevices = computed(() =>
  devices.value.filter((d) => selectedDeviceKeys.value.includes(d.key)),
);

function toggleDevice(key) {
  if (selectedDeviceKeys.value.includes(key)) {
    selectedDeviceKeys.value = selectedDeviceKeys.value.filter((k) => k !== key);
  } else {
    selectedDeviceKeys.value = [...selectedDeviceKeys.value, key];
  }
}

function selectAllDevices() {
  selectedDeviceKeys.value = allCurrentInputs.value.map((d) => d.key);
}

function deselectAllDevices() {
  selectedDeviceKeys.value = [];
}

// Collapsible filter panel state (default open)
const isFilterOpen = ref(true);

// Date range state (defaults to past 2 days / 48 hours up to today)
const today = new Date();
const todayDateStr = formatDateForInput(today);
const defaultStartDate = formatDateForInput(
  new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
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
  start.setDate(start.getDate() - days);
  customStartDate.value = formatDateForInput(start);
  customEndDate.value = formatDateForInput(end);
}

// Check if any filters are modified from defaults
const isFilterModified = computed(() => {
  return (
    customStartDate.value !== defaultStartDate ||
    customEndDate.value !== todayDateStr ||
    activeDevices.value.length !== devices.value.length
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

// ---- Data ----
const isLoading = ref(false); // only for a new range, not background refreshes
const isRefreshing = ref(false);
const loadError = ref("");
const series = ref({ points: [], bucketSeconds: null });
const lastUpdated = ref(null);
let querySeq = 0;

// While the range includes today, new readings keep arriving
const isAutoRefreshing = computed(
  () => !isDateRangeInvalid.value && customEndDate.value >= formatDateForInput(new Date()),
);

async function queryData({ background = false } = {}) {
  if (isDateRangeInvalid.value) return;
  const seq = ++querySeq;
  if (background) isRefreshing.value = true;
  else isLoading.value = true;
  try {
    const result = await fetchPowerSeries({
      startDate: new Date(`${customStartDate.value}T00:00:00`).toISOString(),
      endDate: new Date(`${customEndDate.value}T23:59:59.999`).toISOString(),
      maxPoints: MAX_POINTS,
    });
    if (seq !== querySeq) return;
    series.value = result;
    loadError.value = "";
    lastUpdated.value = new Date();
  } catch (err) {
    if (seq === querySeq) loadError.value = err.message;
  } finally {
    if (seq === querySeq) {
      isLoading.value = false;
      isRefreshing.value = false;
    }
  }
}

// Re-query when the date range changes (devices are filtered locally)
watch([customStartDate, customEndDate], () => {
  selection.value = null;
  queryData();
});

let refreshTimer = null;
onMounted(() => {
  queryData();
  refreshTimer = setInterval(() => {
    if (isAutoRefreshing.value && !isLoading.value) queryData({ background: true });
  }, AUTO_REFRESH_MS);
});

onUnmounted(() => clearInterval(refreshTimer));

const lastUpdatedLabel = computed(() =>
  lastUpdated.value ? formatTimestamp(lastUpdated.value.getTime(), { seconds: true, date: false }) : "",
);

// Parse backend buckets into chart & table points (power in W)
const timeSeriesData = computed(() =>
  series.value.points.map((p, index) => {
    const t = Date.parse(p.timestamp);
    const point = {
      index,
      t,
      timestamp: t,
      formattedTime: formatTimestamp(t, { seconds: (series.value.bucketSeconds ?? 60) < 60 }),
    };
    let total = 0;
    let energyWh = 0;
    let cost = 0;
    for (const d of devices.value) point[d.key] = p.ports[d.port];
    for (const d of activeDevices.value) {
      total += p.ports[d.port];
      energyWh += p.energyWh[d.port];
      cost += p.cost[d.port];
    }
    return { ...point, total, energyWh, cost };
  }),
);

const bucketLabel = computed(() => formatBucket(series.value.bucketSeconds));

// Totals over the whole range for the selected devices
const rangeTotals = computed(() => {
  const perDevice = activeDevices.value.map((d) => {
    let wh = 0;
    let cost = 0;
    let peak = 0;
    for (const p of series.value.points) {
      wh += p.energyWh[d.port];
      cost += p.cost[d.port];
      peak = Math.max(peak, p.ports[d.port]);
    }
    return { ...d, kWh: wh / 1000, cost, peakW: peak };
  });
  let peak = null;
  for (const p of timeSeriesData.value) if (!peak || p.total > peak.total) peak = p;
  return {
    kWh: perDevice.reduce((s, d) => s + d.kWh, 0),
    cost: perDevice.reduce((s, d) => s + d.cost, 0),
    peak,
    devices: perDevice,
  };
});

// ---- Drag-to-select on the chart ----
const selection = ref(null);
const selectionResult = ref(null);
watch(selection, (s) => {
  if (!s) selectionResult.value = null;
});

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
  Math.max(1, Math.ceil(sortedTableData.value.length / pageSize.value)),
);

const paginatedTableData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedTableData.value.slice(start, start + pageSize.value);
});

// Sync pageInput when currentPage changes
watch(currentPage, (val) => {
  pageInput.value = val;
});

// Keep the page in range when a refresh changes the row count
watch(totalPages, (n) => {
  if (currentPage.value > n) currentPage.value = n;
});

// Reset page when any filter changes
watch([customStartDate, customEndDate, selectedDeviceKeys], () => {
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

// ---- Chat assistant summary ----
const round = (n, d = 2) => +Number(n || 0).toFixed(d);

function chatSummary() {
  const t = rangeTotals.value;
  return {
    page: "Details",
    dateRange: { start: customStartDate.value, end: customEndDate.value },
    readingsAveragedInto: bucketLabel.value ? `${bucketLabel.value} intervals` : null,
    intervalsShown: timeSeriesData.value.length,
    showingDisabledSources: showDisabled.value,
    hiddenDisabledSources: showDisabled.value ? [] : allCurrentInputs.value.filter((d) => !d.enabled).map((d) => d.label),
    selectedDevices: activeDevices.value.map((d) => d.label + (d.enabled ? "" : " (disabled)")),
    unselectedDevices: devices.value.filter((d) => !selectedDeviceKeys.value.includes(d.key)).map((d) => d.label),
    rangeTotals: {
      kWh: round(t.kWh, 4),
      cost: round(t.cost, 4),
      peakTotalW: t.peak ? round(t.peak.total, 1) : null,
      peakAt: t.peak ? t.peak.formattedTime : null,
    },
    byDevice: t.devices.map((d) => ({
      name: d.label,
      kWh: round(d.kWh, 4),
      cost: round(d.cost, 4),
      peakW: round(d.peakW, 1),
      percentOfEnergy: t.kWh > 0 ? Math.round((d.kWh / t.kWh) * 100) : 0,
    })),
    chartSelection: selectionResult.value,
  };
}

onMounted(() => setChatContext("details", chatSummary));

// ---- Inline "Summarize" for the chosen range ----
const rangeSummary = useAiSummary("details-range", () => {
  const { chartSelection, ...rest } = chatSummary();
  return {
    ...rest,
    profileWatts: powerProfile(timeSeriesData.value, activeDevices.value.map((d) => d.key), {
      max: 48,
      labelFor: (k) => devices.value.find((d) => d.key === k)?.label ?? k,
    }),
  };
});

// A different range or set of devices makes the old summary wrong
watch([customStartDate, customEndDate, selectedDeviceKeys, showDisabled], () => rangeSummary.dismiss());
onUnmounted(() => clearChatContext("details", chatSummary));
</script>

<template>
  <div
    class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-12 flex flex-col gap-6 w-full"
  >
    <!-- Page Header -->
    <header class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <Button variant="outline" size="sm" @click="router.push('/')">
          <ArrowLeftIcon data-icon="inline-start" />
          Back to Dashboard
        </Button>
        <span v-if="user" class="text-sm text-muted-foreground">
          Logged in as
          <strong class="text-foreground">{{ user.username }}</strong>
        </span>
      </div>

      <div class="flex flex-col gap-1 border-b border-border/50 pb-5">
        <h1
          class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground m-0"
        >
          Power Usage Details
        </h1>
        <p class="text-sm text-muted-foreground m-0">
          Power, energy and cost per device for any date range. Drag across
          the chart to total up a time window.
        </p>
      </div>
    </header>

    <!-- Collapsible Filter Panel -->
    <Collapsible v-model:open="isFilterOpen" class="w-full">
      <Card class="w-full">
        <CardHeader class="pb-3">
          <div
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div class="flex items-center gap-2">
              <FilterIcon class="text-primary size-4" />
              <div>
                <CardTitle class="text-base sm:text-lg"
                  >Filter & Focus Readings</CardTitle
                >
                <CardDescription class="text-xs sm:text-sm">
                  Specify a date range and select monitored devices to inspect.
                </CardDescription>
              </div>
            </div>

            <div class="flex items-center gap-2 self-start sm:self-auto">
              <!-- Auto-update status (no manual refresh needed) -->
              <span
                v-if="isAutoRefreshing"
                class="flex items-center gap-1.5 text-xs text-muted-foreground"
                aria-live="polite"
              >
                <Spinner v-if="isRefreshing" class="size-3.5 text-primary" />
                <RadioIcon v-else class="size-3.5 text-green-600 dark:text-green-400" />
                Auto-updating<template v-if="lastUpdatedLabel"> · {{ lastUpdatedLabel }}</template>
              </span>
              <span v-else-if="lastUpdatedLabel" class="text-xs text-muted-foreground">
                Past range · loaded {{ lastUpdatedLabel }}
              </span>

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
          <div
            class="flex flex-wrap items-center gap-2 pt-2.5 text-xs text-muted-foreground"
          >
            <span class="font-medium text-foreground">Active Filters:</span>
            <Badge variant="secondary" class="gap-1 font-normal">
              <CalendarIcon class="size-3" />
              <span>{{ activeRangeLabel }}</span>
            </Badge>
            <Badge variant="secondary" class="gap-1 font-normal">
              <SlidersHorizontalIcon class="size-3" />
              <span
                >{{ activeDevices.length }} of
                {{ devices.length }} devices</span
              >
            </Badge>
            <Badge variant="outline" class="font-mono text-xs">
              {{ timeSeriesData.length }} readings
            </Badge>
            <div
              v-if="isLoading"
              class="flex items-center gap-1.5 text-primary text-xs ml-auto"
            >
              <Spinner class="size-3.5" />
              <span>Updating...</span>
            </div>
          </div>
        </CardHeader>

        <!-- Detailed Filter Controls (Collapsible) -->
        <CollapsibleContent>
          <CardContent
            class="flex flex-col gap-4 pt-3 border-t border-border/50"
          >
            <!-- Date Range Filter Row -->
            <div class="flex flex-col gap-2.5">
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <span
                  class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
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
              <FieldGroup
                class="flex flex-col sm:flex-row gap-3 items-start sm:items-end"
              >
                <Field
                  :data-invalid="isDateRangeInvalid"
                  class="w-full sm:w-48"
                >
                  <FieldLabel for="start-date" class="text-xs">
                    Start Date
                  </FieldLabel>
                  <DatePicker
                    id="start-date"
                    v-model="customStartDate"
                    :max="customEndDate || todayDateStr"
                    :aria-invalid="isDateRangeInvalid"
                    class="w-full"
                  />
                </Field>

                <Field
                  :data-invalid="isDateRangeInvalid"
                  class="w-full sm:w-48"
                >
                  <FieldLabel for="end-date" class="text-xs">
                    End Date
                  </FieldLabel>
                  <DatePicker
                    id="end-date"
                    v-model="customEndDate"
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
              <div
                class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Monitored Devices
                  </span>
                  <Badge variant="secondary" class="font-mono text-xs">
                    {{ activeDevices.length }} of {{ devices.length }} active
                  </Badge>
                </div>

                <div class="flex items-center gap-2 text-xs">
                  <label
                    for="show-disabled"
                    class="flex items-center gap-2 font-medium cursor-pointer select-none text-muted-foreground"
                    :title="hiddenCount === 0 ? 'No inputs are disabled' : 'Show inputs that are turned off in Setup'"
                  >
                    <EyeOffIcon class="size-3.5" />
                    Show disabled sources
                    <Badge v-if="hiddenCount > 0" variant="secondary" class="font-mono px-1.5">{{ hiddenCount }}</Badge>
                    <Switch id="show-disabled" v-model="showDisabled" :disabled="hiddenCount === 0" />
                  </label>
                  <Separator orientation="vertical" class="h-3" />
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
                        : 'bg-muted/40 text-muted-foreground border-transparent opacity-50 line-through hover:opacity-75',
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
                  <Badge
                    v-if="!device.enabled"
                    variant="secondary"
                    class="px-1 py-0 text-[10px] leading-none"
                  >
                    Disabled
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
        <CardHeader
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
        >
          <div>
            <CardTitle>Device Power Usage Trends</CardTitle>
            <CardDescription>
              Average power per device<template v-if="bucketLabel">
                in {{ bucketLabel }} intervals</template>.
            </CardDescription>
          </div>
          <div class="flex items-center gap-2 self-start sm:self-auto">
            <div
              v-if="isLoading"
              class="flex items-center gap-1.5 text-xs text-muted-foreground mr-1"
            >
              <Spinner class="size-3.5 text-primary" />
              <span>Fetching data...</span>
            </div>
            <Badge variant="secondary" class="font-mono">
              {{ timeSeriesData.length }} data points
            </Badge>
            <SummarizeButton
              v-if="!isLoading && activeDevices.length && timeSeriesData.length"
              label="Summarize range"
              :loading="rangeSummary.loading.value"
              @click="rangeSummary.generate()"
            />
          </div>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <!-- Loading State for Chart -->
          <div
            v-if="isLoading"
            class="h-72 border border-border/50 rounded-lg flex flex-col items-center justify-center gap-3 bg-muted/10"
          >
            <Spinner class="size-8 text-primary" />
            <p class="text-sm text-muted-foreground animate-pulse">
              Loading power data from server...
            </p>
          </div>

          <p
            v-else-if="loadError && timeSeriesData.length === 0"
            class="h-72 flex items-center justify-center text-sm text-destructive border border-dashed border-border rounded-lg"
          >
            {{ loadError }}
          </p>

          <!-- Empty State when no devices are selected -->
          <Empty
            v-else-if="activeDevices.length === 0"
            class="h-72 border border-dashed border-border rounded-lg"
          >
            <EmptyMedia variant="icon">
              <SlidersHorizontalIcon />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>No devices selected</EmptyTitle>
              <EmptyDescription>
                Select one or more devices in the filter panel above to display
                consumption trends.
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
            <TimeSeriesChart
              v-model:selection="selection"
              :data="timeSeriesData"
              :series="activeDevices"
              :y-format="formatPower"
              selectable
              show-total
              class="w-full h-80 min-h-[300px]"
            />

            <SummaryPanel :summary="rangeSummary" :title="`${activeRangeLabel} · ${activeDevices.length} devices`" />

            <EnergySelectionCard
              v-if="selection"
              :selection="selection"
              :points="timeSeriesData"
              :devices="activeDevices"
              @clear="selection = null"
              @result="selectionResult = $event"
            />
            <div v-else class="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
              <span class="flex items-center gap-1.5">
                <MousePointerClickIcon class="size-3.5" />
                Drag across the chart to see the energy and cost for that time.
              </span>
              <span>
                Range total:
                <strong class="text-foreground">{{ formatEnergy(rangeTotals.kWh) }}</strong>
                ·
                <strong class="text-foreground">{{ formatMoney(rangeTotals.cost) }}</strong>
                <template v-if="rangeTotals.peak">
                  · peak {{ formatPower(rangeTotals.peak.total) }} at {{ rangeTotals.peak.formattedTime }}
                </template>
              </span>
            </div>

            <!-- Interactive Device Legend (Clicking any legend item toggles it) -->
            <div
              class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-3 border-t border-border/50 text-xs"
            >
              <button
                v-for="device in devices"
                :key="device.key"
                type="button"
                :class="
                  cn(
                    'flex items-center gap-2 cursor-pointer transition-opacity rounded-sm px-1 py-0.5',
                    !selectedDeviceKeys.includes(device.key) &&
                      'opacity-40 line-through',
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
                <span
                  class="text-muted-foreground font-medium hover:text-foreground"
                >
                  {{ device.label }}
                </span>
              </button>
            </div>
          </template>
        </CardContent>
      </Card>

      <!-- 2. Table Section (Full Width, below Chart) -->
      <Card class="w-full">
        <CardHeader
          class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <CardTitle>Readings Data Table</CardTitle>
            <CardDescription>
              Average power<template v-if="bucketLabel"> per {{ bucketLabel }} interval</template>,
              with the energy used and its cost, for the devices shown on the chart.
            </CardDescription>
          </div>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="toggleSort">
              <ArrowUpDownIcon data-icon="inline-start" />
              {{ sortOrder === "desc" ? "Newest First" : "Oldest First" }}
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
                    <TableHead class="text-right font-semibold min-w-24"
                      >Total</TableHead
                    >
                    <TableHead class="text-right font-semibold min-w-24"
                      >Energy</TableHead
                    >
                    <TableHead class="text-right font-semibold min-w-20"
                      >Cost</TableHead
                    >
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="row in paginatedTableData"
                    :key="row.timestamp"
                  >
                    <TableCell
                      class="font-medium whitespace-nowrap text-foreground"
                    >
                      {{ row.formattedTime }}
                    </TableCell>
                    <!-- Dynamic columns matching each ACTIVE device -->
                    <TableCell
                      v-for="device in activeDevices"
                      :key="device.key"
                      class="text-right font-mono text-muted-foreground"
                    >
                      {{ formatPower(row[device.key]) }}
                    </TableCell>
                    <!-- Row total summing active devices -->
                    <TableCell
                      class="text-right font-mono font-medium text-foreground"
                    >
                      {{ formatPower(row.total) }}
                    </TableCell>
                    <TableCell class="text-right font-mono text-muted-foreground">
                      {{ formatEnergy(row.energyWh / 1000) }}
                    </TableCell>
                    <TableCell class="text-right font-mono text-muted-foreground">
                      {{ formatMoney(row.cost) }}
                    </TableCell>
                  </TableRow>

                  <!-- Loading state for table -->
                  <TableRow v-if="isLoading">
                    <TableCell
                      :colspan="activeDevices.length + 4"
                      class="h-28 text-center text-muted-foreground"
                    >
                      <div class="flex items-center justify-center gap-2">
                        <Spinner class="size-4 text-primary" />
                        <span>Loading power records...</span>
                      </div>
                    </TableCell>
                  </TableRow>

                  <!-- Empty state for no active devices -->
                  <TableRow v-else-if="activeDevices.length === 0">
                    <TableCell
                      :colspan="devices.length + 4"
                      class="h-28 text-center text-muted-foreground"
                    >
                      No devices selected. Select at least one device in the
                      filter panel above to display readings.
                    </TableCell>
                  </TableRow>

                  <!-- Empty state for no data rows -->
                  <TableRow v-else-if="paginatedTableData.length === 0">
                    <TableCell
                      :colspan="activeDevices.length + 4"
                      class="h-24 text-center text-muted-foreground"
                    >
                      No data available for this range.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
        <CardFooter
          class="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/50 pt-4"
        >
          <div class="text-xs text-muted-foreground">
            Showing
            <strong class="font-medium text-foreground">
              {{
                sortedTableData.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1
              }}
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
            <div
              class="flex items-center gap-1.5 text-xs text-muted-foreground px-1"
            >
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
