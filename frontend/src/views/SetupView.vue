<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { getUser } from "@/services/auth";
import {
  CURRENT_KEYS,
  VOLTAGE_KEYS,
  fetchDeviceConfig,
  putDeviceConfig,
  cachePortNames,
} from "@/services/deviceConfig";
import { defaultInputName } from "@/services/portConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ActivityIcon,
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloudOffIcon,
  GaugeIcon,
  RefreshCwIcon,
  SettingsIcon,
  ZapIcon,
} from "@lucide/vue";
import InputConfigCard from "@/components/setup/InputConfigCard.vue";
import InputAdvancedDialog from "@/components/setup/InputAdvancedDialog.vue";
import ConfigNumberField from "@/components/setup/ConfigNumberField.vue";
import ConfigSelectField from "@/components/setup/ConfigSelectField.vue";

const router = useRouter();
const user = getUser();

const SAVE_DELAY_MS = 700;

// ---- Loading ----
const config = ref(null); // mirrors device-configuration.json
const options = ref({ gains: [], oversamplingRatios: [] });
const isLoading = ref(true);
const loadError = ref("");

async function load() {
  isLoading.value = true;
  loadError.value = "";
  try {
    const data = await fetchDeviceConfig();
    applyFromServer(() => {
      config.value = data.config;
    });
    options.value = data.options;
    lastSaved.value = data.config.last_updated || null;
    cachePortNames(data.config);
  } catch (err) {
    loadError.value = err.message || "Could not load device configuration";
  } finally {
    isLoading.value = false;
  }
}

// ---- Autosave ----
// "idle" | "pending" (waiting for typing to stop) | "saving" | "saved" | "invalid" | "error"
const saveState = ref("idle");
const saveError = ref("");
const fieldErrors = ref({}); // "c0 ct_ratio" -> "c0 ct_ratio must be at least 1"
const lastSaved = ref(null);

let saveTimer = null;
let saving = false;
let saveAgain = false;
let ignoreNextChange = false;

// Run a config change that came from the server without triggering a save
function applyFromServer(fn) {
  ignoreNextChange = true;
  fn();
}

watch(
  config,
  () => {
    if (ignoreNextChange) {
      ignoreNextChange = false;
      return;
    }
    if (!config.value) return;
    saveState.value = "pending";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  },
  { deep: true, flush: "sync" },
);

function payload() {
  // eslint-disable-next-line no-unused-vars
  const { last_updated, ...rest } = config.value;
  return JSON.parse(JSON.stringify(rest));
}

async function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!config.value) return;
  if (saving) {
    saveAgain = true;
    return;
  }
  saving = true;
  saveState.value = "saving";
  try {
    const { config: saved } = await putDeviceConfig(payload());
    fieldErrors.value = {};
    saveError.value = "";
    lastSaved.value = saved.last_updated;
    cachePortNames(saved);
    // The server may reassign a CT's voltage reference when a voltage input is disabled
    for (const k of CURRENT_KEYS) {
      const local = config.value.inputs[k];
      if (local.voltage_sensor !== saved.inputs[k].voltage_sensor) {
        applyFromServer(() => {
          local.voltage_sensor = saved.inputs[k].voltage_sensor;
        });
      }
    }
    setStateUnlessEditing("saved");
  } catch (err) {
    if (err.errors?.length) {
      fieldErrors.value = Object.fromEntries(
        err.errors.map((msg) => {
          // "c0 ct_ratio must be at least 1" -> key "c0 ct_ratio", text "Must be at least 1"
          const words = msg.split(" ");
          const text = words.slice(2).join(" ");
          return [
            words.slice(0, 2).join(" "),
            text.charAt(0).toUpperCase() + text.slice(1),
          ];
        }),
      );
      setStateUnlessEditing("invalid");
    } else {
      saveError.value = err.message || "Save failed";
      setStateUnlessEditing("error");
    }
  } finally {
    saving = false;
    if (saveAgain) {
      saveAgain = false;
      save();
    }
  }
}

// Don't report "saved" while newer edits are still waiting to be sent
function setStateUnlessEditing(state) {
  if (!saveTimer && !saveAgain) saveState.value = state;
}

const hasUnsavedChanges = computed(() =>
  ["pending", "saving", "invalid", "error"].includes(saveState.value),
);

function onBeforeUnload(e) {
  if (saveState.value === "pending") save();
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = "";
  }
}

onMounted(() => {
  load();
  window.addEventListener("beforeunload", onBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", onBeforeUnload);
  if (saveTimer) save(); // flush pending edits when leaving the page
});

const lastSavedLabel = computed(() => {
  if (!lastSaved.value) return "";
  return new Date(lastSaved.value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
});

// ---- Select options ----

const osrOptions = computed(() =>
  options.value.oversamplingRatios.map((r) => ({
    value: r,
    label: `${r} (${Math.round(8192000 / 2 / r).toLocaleString()} samples/s)`,
  })),
);

const voltageSensorOptions = computed(() =>
  VOLTAGE_KEYS.map((k) => {
    const input = config.value?.inputs[k];
    return {
      value: k,
      label: `${k.toUpperCase()} – ${displayName(k)}${input?.enabled ? "" : " (disabled)"}`,
      disabled: !input?.enabled,
    };
  }),
);

// ---- Names ----
function displayName(key) {
  return config.value?.inputs[key]?.name?.trim() || defaultInputName(key);
}

// ---- Advanced input settings modal ----
const advanced = ref({ open: false, kind: "current", startKey: "" });

function openAdvanced(kind, key) {
  advanced.value = { open: true, kind, startKey: key };
}

// drafts: { c0: { ct_ratio, ... }, ... } (only the inputs that changed)
function applyAdvanced(drafts) {
  for (const [key, values] of Object.entries(drafts)) {
    Object.assign(config.value.inputs[key], values);
  }
  save(); // write now rather than waiting for the autosave delay
}

// ---- Advanced system settings panel ----
const systemSettingsOpen = ref(false);
const SYSTEM_SECTIONS = ["adc ", "database ", "leds "];
const systemErrorCount = computed(
  () =>
    Object.keys(fieldErrors.value).filter((k) =>
      SYSTEM_SECTIONS.some((s) => k.startsWith(s)),
    ).length,
);
// Open the panel if a value inside it is rejected
watch(systemErrorCount, (n) => {
  if (n > 0) systemSettingsOpen.value = true;
});

const enabledCount = (keys) =>
  keys.filter((k) => config.value?.inputs[k].enabled).length;

const err = (key) => fieldErrors.value[key] || "";
const errorCount = computed(() => Object.keys(fieldErrors.value).length);
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

      <div
        class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-border/50 pb-5"
      >
        <div>
          <h1
            class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground m-0"
          >
            Setup
          </h1>
          <p class="mt-1 text-sm text-muted-foreground m-0">
            Configure input sensors, sampling and thresholds. Changes are saved
            automatically.
          </p>
        </div>

        <!-- Autosave status -->
        <div
          v-if="config"
          class="flex items-center gap-2 text-xs self-start sm:self-auto"
          aria-live="polite"
        >
          <template v-if="saveState === 'pending' || saveState === 'saving'">
            <Spinner class="size-3.5 text-primary" />
            <span class="text-muted-foreground">Saving…</span>
          </template>
          <template v-else-if="saveState === 'invalid'">
            <AlertCircleIcon class="size-4 text-destructive" />
            <span class="text-destructive font-medium">
              Not saved: fix {{ errorCount }}
              {{ errorCount === 1 ? "field" : "fields" }}
            </span>
          </template>
          <template v-else-if="saveState === 'error'">
            <CloudOffIcon class="size-4 text-destructive" />
            <span class="text-destructive font-medium">{{ saveError }}</span>
            <Button variant="outline" size="xs" @click="save">
              <RefreshCwIcon data-icon="inline-start" />
              Retry
            </Button>
          </template>
          <template v-else>
            <CheckIcon class="size-4 text-green-600 dark:text-green-400" />
            <span class="text-muted-foreground">
              {{ saveState === "saved" ? "Saved" : "Up to date" }}
              <template v-if="lastSavedLabel">· {{ lastSavedLabel }}</template>
            </span>
          </template>
        </div>
      </div>
    </header>

    <!-- Loading / error -->
    <div
      v-if="isLoading"
      class="h-64 flex flex-col items-center justify-center gap-3 rounded-lg border border-border/50"
    >
      <Spinner class="size-8 text-primary" />
      <p class="text-sm text-muted-foreground">Loading device configuration…</p>
    </div>

    <Alert v-else-if="loadError" variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>Could not load device configuration</AlertTitle>
      <AlertDescription class="flex flex-col items-start gap-3">
        <span>{{ loadError }}</span>
        <Button variant="outline" size="sm" @click="load">
          <RefreshCwIcon data-icon="inline-start" />
          Try again
        </Button>
      </AlertDescription>
    </Alert>

    <main v-else-if="config" class="flex flex-col gap-6 w-full">
      <!-- Inputs Panel -->
      <Card class="w-full">
        <CardHeader>
          <div class="flex items-center gap-2">
            <SettingsIcon class="size-5 text-muted-foreground" />
            <CardTitle>Input Sensors</CardTitle>
          </div>
          <CardDescription>
            Name, enable and calibrate each measurement input. Use
            <strong class="text-foreground font-medium">Advanced</strong> to
            edit transformer, gain and calibration values.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-6">
          <!-- Current inputs -->
          <section class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <ActivityIcon class="size-4 text-primary" />
              <h2 class="text-sm font-semibold m-0">Current Inputs</h2>
              <Badge variant="secondary" class="font-mono text-xs">
                {{ enabledCount(CURRENT_KEYS) }} of
                {{ CURRENT_KEYS.length }} enabled
              </Badge>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <InputConfigCard
                v-for="key in CURRENT_KEYS"
                :key="key"
                :input-key="key"
                :input="config.inputs[key]"
                :placeholder="defaultInputName(key)"
                :errors="fieldErrors"
                @advanced="openAdvanced('current', key)"
              />
            </div>
          </section>

          <Separator />

          <!-- Voltage inputs -->
          <section class="flex flex-col gap-3">
            <div class="flex items-center gap-2">
              <ZapIcon class="size-4 text-primary" />
              <h2 class="text-sm font-semibold m-0">Voltage Inputs</h2>
              <Badge variant="secondary" class="font-mono text-xs">
                {{ enabledCount(VOLTAGE_KEYS) }} of
                {{ VOLTAGE_KEYS.length }} enabled
              </Badge>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <InputConfigCard
                v-for="key in VOLTAGE_KEYS"
                :key="key"
                :input-key="key"
                :input="config.inputs[key]"
                :placeholder="defaultInputName(key)"
                :errors="fieldErrors"
                @advanced="openAdvanced('voltage', key)"
              />
            </div>
          </section>
        </CardContent>
      </Card>

      <!-- Advanced System Settings Panel -->
      <Collapsible v-model:open="systemSettingsOpen" class="w-full">
        <Card class="w-full">
          <CardHeader
            class="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <div class="flex items-center gap-2">
                <GaugeIcon class="size-5 text-muted-foreground" />
                <CardTitle>Advanced System Settings</CardTitle>
                <Badge
                  v-if="systemErrorCount > 0"
                  variant="destructive"
                  class="px-1.5 py-0 text-[10px]"
                >
                  {{ systemErrorCount }}
                </Badge>
              </div>
              <CardDescription class="mt-1.5">
                ADC sampling, database logging and status LED settings.
              </CardDescription>
            </div>
            <CollapsibleTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="self-start sm:self-auto"
              >
                <component
                  :is="systemSettingsOpen ? ChevronUpIcon : ChevronDownIcon"
                  data-icon="inline-start"
                />
                {{ systemSettingsOpen ? "Collapse" : "Expand" }}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- ADC -->
              <section class="flex flex-col gap-3">
                <div>
                  <h2 class="text-sm font-semibold m-0">ADC Sampling</h2>
                  <p class="text-xs text-muted-foreground m-0 mt-0.5">
                    Takes effect after the meter program restarts.
                  </p>
                </div>
                <ConfigSelectField
                  id="adc-oversampling_ratio"
                  v-model="config.adc.oversampling_ratio"
                  label="Oversampling Ratio"
                  :options="osrOptions"
                  :error="err('adc oversampling_ratio')"
                />
                <ConfigNumberField
                  id="adc-report_seconds"
                  v-model="config.adc.report_seconds"
                  label="Report Interval"
                  unit="s"
                  hint="How often RMS and power are calculated"
                  :min="0.05"
                  :max="60"
                  :error="err('adc report_seconds')"
                />
              </section>

              <!-- Database -->
              <section class="flex flex-col gap-3">
                <div>
                  <h2 class="text-sm font-semibold m-0">Database Logging</h2>
                  <p class="text-xs text-muted-foreground m-0 mt-0.5">
                    Readings below a minimum are stored as 0.
                  </p>
                </div>
                <ConfigNumberField
                  id="database-insert_seconds"
                  v-model="config.database.insert_seconds"
                  label="Insert Interval"
                  unit="s"
                  :min="0.05"
                  :max="60"
                  :error="err('database insert_seconds')"
                />
                <div
                  class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3"
                >
                  <ConfigNumberField
                    id="database-min_voltage"
                    v-model="config.database.min_voltage"
                    label="Min Voltage"
                    unit="V"
                    :min="0"
                    :error="err('database min_voltage')"
                  />
                  <ConfigNumberField
                    id="database-min_current"
                    v-model="config.database.min_current"
                    label="Min Current"
                    unit="A"
                    :min="0"
                    :error="err('database min_current')"
                  />
                  <ConfigNumberField
                    id="database-min_power"
                    v-model="config.database.min_power"
                    label="Min Power"
                    unit="W"
                    :min="0"
                    :error="err('database min_power')"
                  />
                </div>
              </section>

              <!-- LEDs -->
              <section class="flex flex-col gap-3">
                <div>
                  <h2 class="text-sm font-semibold m-0">Status LEDs</h2>
                  <p class="text-xs text-muted-foreground m-0 mt-0.5">
                    An input's LED lights when its reading is above these
                    levels.
                  </p>
                </div>
                <ConfigNumberField
                  id="leds-min_voltage"
                  v-model="config.leds.min_voltage"
                  label="Min Voltage"
                  unit="V"
                  :min="0"
                  :error="err('leds min_voltage')"
                />
                <ConfigNumberField
                  id="leds-min_current"
                  v-model="config.leds.min_current"
                  label="Min Current"
                  unit="A"
                  :min="0"
                  :error="err('leds min_current')"
                />
              </section>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <InputAdvancedDialog
        v-model:open="advanced.open"
        :kind="advanced.kind"
        :keys="advanced.kind === 'current' ? CURRENT_KEYS : VOLTAGE_KEYS"
        :inputs="config.inputs"
        :start-key="advanced.startKey"
        :display-name="displayName"
        :voltage-sensor-options="voltageSensorOptions"
        :valid-gains="options.gains"
        @save="applyAdvanced"
      />
    </main>
  </div>
</template>
