<script setup>
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getUser, logout } from "@/services/auth";
import { fetchDeviceConfig, saveDeviceConfig } from "@/services/deviceConfig";
import { cachePortNames } from "@/services/portConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  GaugeIcon,
  SlidersHorizontalIcon,
  ZapIcon,
  RotateCwIcon,
} from "@lucide/vue";

const router = useRouter();
const user = getUser();

// ---- State ----
const config = ref(null); // settings being edited (null until loaded)
const validGains = ref([1, 2, 4, 8, 16, 32, 64, 128]);
const validOsr = ref([128, 256, 512, 1024, 2048, 4096, 8192, 16256]);
const loading = ref(true);
const loadError = ref("");
const status = ref("idle"); // "idle" | "saving" | "saved" | "error"
const saveErrors = ref([]);
const lastSaved = ref(null); // time of the last save (from the file's last_updated)

// Fields that failed validation, as "c0.turns", "adc.report_seconds", ...
// Server messages look like "c0 turns must be at least 1": first word = input or
// section, second word = field.
const invalidFields = computed(() => {
  const set = new Set();
  for (const msg of saveErrors.value) {
    const m = /^(\S+) (\S+)/.exec(msg);
    if (m) set.add(`${m[1]}.${m[2]}`);
  }
  return set;
});
const invalid = (section, field) => invalidFields.value.has(`${section}.${field}`);
// True if any field of an input (e.g. "c0") or section (e.g. "adc") is invalid
const sectionInvalid = (section) =>
  [...invalidFields.value].some((f) => f.startsWith(section + "."));

const lastSavedText = computed(() =>
  lastSaved.value
    ? lastSaved.value.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
    : "",
);

// Inputs in display order: voltage sensors first, then current clamps
const voltageKeys = ["v0", "v1"];
const currentKeys = ["c0", "c1", "c2", "c3", "c4", "c5"];

// Which "Advanced" dropdowns are open, by input key (and "system" for the bottom section)
const open = ref({});

// Allowed ranges, matching the server's checks in backend/src/deviceConfig.js.
// Input fields are keyed by field name; system settings by "section.field".
const RANGES = {
  transformer_input_v: { min: 1, max: 1000 },
  transformer_output_v: { min: 0.1, max: 1000 },
  divider_ratio: { min: 1, max: 1000 },
  calibration: { min: 0.5, max: 2 },
  turns: { min: 1, max: 100, whole: true },
  ct_ratio: { min: 1, max: 100000 },
  ct_burden_ohms: { min: 0.1, max: 1000 },
  "adc.report_seconds": { min: 0.05, max: 60 },
  "database.insert_seconds": { min: 0.05, max: 60 },
  "database.min_voltage": { min: 0 },
  "database.min_current": { min: 0 },
  "database.min_power": { min: 0 },
  "leds.min_voltage": { min: 0 },
  "leds.min_current": { min: 0 },
};

// "min = 1, max = 100" text shown under a number field
function rangeText(name) {
  const r = RANGES[name];
  if (!r) return "";
  const parts = [`min = ${r.min}`];
  if (r.max !== undefined) parts.push(`max = ${r.max}`);
  if (r.whole) parts.push("whole number");
  return parts.join(", ");
}

// ---- Display helpers ----
const ADC_FULL_SCALE = 1.2; // volts peak at the ADC pin at gain 1

// Name to show for a voltage sensor in the clamp dropdown
function voltageLabel(key) {
  const name = config.value?.inputs[key]?.name;
  return name ? `${name} (${key.toUpperCase()})` : key.toUpperCase();
}

// Largest RMS value an input can read at a gain, in real units (V or A).
// Peak at the ADC = 1.2 V / gain; RMS of a sine = peak / sqrt(2); then scale to the wire.
function maxReading(key, gain) {
  const input = config.value.inputs[key];
  const adcRms = ADC_FULL_SCALE / gain / Math.SQRT2;
  if (key.startsWith("v")) {
    const ratio = input.transformer_input_v / input.transformer_output_v;
    return adcRms * input.divider_ratio * ratio * input.calibration;
  }
  return (adcRms * input.ct_ratio) / input.ct_burden_ohms / input.turns * input.calibration;
}

function gainLabel(key, gain) {
  const max = maxReading(key, gain);
  if (!Number.isFinite(max)) return `×${gain}`;
  const unit = key.startsWith("v") ? "V" : "A";
  const shown = max >= 100 ? max.toFixed(0) : max >= 10 ? max.toFixed(1) : max.toFixed(2);
  return `×${gain}: up to ${shown} ${unit}`;
}

function osrLabel(osr) {
  const sps = 8_192_000 / 2 / osr;
  return `${osr}: ${sps >= 1000 ? sps / 1000 + "k" : Math.round(sps)} samples/s`;
}

// Voltage sensors that are turned on (the only ones a clamp can use)
const enabledVoltageKeys = computed(() =>
  config.value ? voltageKeys.filter((k) => config.value.inputs[k].enabled) : [],
);

// When a voltage sensor is turned off, move clamps that used it to the first one still on
watch(enabledVoltageKeys, (on) => {
  if (!config.value || on.length === 0) return;
  for (const k of currentKeys) {
    const input = config.value.inputs[k];
    if (!on.includes(input.voltage_sensor)) input.voltage_sensor = on[0];
  }
});

// ---- Load ----
let loaded = false; // ignore the watcher while the config is first being filled in

async function load() {
  loading.value = true;
  loadError.value = "";
  loaded = false;
  try {
    const data = await fetchDeviceConfig();
    config.value = data.config;
    cachePortNames(data.config);
    lastSaved.value = data.config.last_updated ? new Date(data.config.last_updated) : null;
    validGains.value = data.validGains || validGains.value;
    validOsr.value = data.validOsr || validOsr.value;
  } catch (err) {
    if (err.status === 401) return goToLogin();
    loadError.value = err.message || "Couldn't load settings from the device.";
  } finally {
    loading.value = false;
    // wait one tick so the initial assignment doesn't trigger an autosave
    setTimeout(() => (loaded = true), 0);
  }
}
onMounted(load);

// ---- Autosave: save shortly after the last change ----
const SAVE_DELAY_MS = 600; // waits for you to stop typing
let saveTimer = null;

watch(
  config,
  () => {
    if (!loaded) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY_MS);
  },
  { deep: true },
);

const SAVE_ATTEMPTS = 3; // tries before showing a connection error
const RETRY_DELAY_MS = 500; // wait between tries
const syncError = ref(""); // set when the device couldn't be reached
let saveSeq = 0; // each save gets a number; an older save stops if a newer one starts

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Retry only problems that might go away: no response (network) or a server error (5xx).
// Bad values (400) and an expired login (401) are answered right away.
const isRetryable = (err) => err.status === undefined || err.status >= 500;

async function save() {
  clearTimeout(saveTimer); // "Try again" shouldn't also fire a pending autosave
  const seq = ++saveSeq;
  status.value = "saving";

  for (let attempt = 1; attempt <= SAVE_ATTEMPTS; attempt++) {
    try {
      const result = await saveDeviceConfig(config.value);
      if (seq !== saveSeq) return; // a newer save took over
      cachePortNames(result.config);
      saveErrors.value = [];
      syncError.value = "";
      lastSaved.value = result.config.last_updated ? new Date(result.config.last_updated) : new Date();
      status.value = "saved";
      return;
    } catch (err) {
      if (seq !== saveSeq) return;
      if (err.status === 401) return goToLogin();

      if (isRetryable(err) && attempt < SAVE_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
        if (seq !== saveSeq) return;
        continue;
      }

      status.value = "error";
      if (isRetryable(err)) {
        // Still failing after every try: the device or backend is unreachable
        saveErrors.value = [];
        syncError.value = `Couldn't reach the device after ${SAVE_ATTEMPTS} tries. Check that the backend is running, then try again.`;
      } else {
        // Nothing was saved; keep what's on screen so it can be corrected
        syncError.value = "";
        saveErrors.value = err.errors?.length ? err.errors : [err.message];
        // Open the Advanced section of any input with a bad field so it's visible
        for (const f of invalidFields.value) open.value[f.split(".")[0]] = true;
        if (["adc", "database", "leds"].some(sectionInvalid)) open.value.system = true;
      }
      return;
    }
  }
}

function goToLogin() {
  logout();
  router.push("/login");
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-12 flex flex-col gap-6 w-full">
    <!-- Page header -->
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

      <div class="flex items-end justify-between gap-4 border-b border-border/50 pb-5">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold tracking-tight text-foreground m-0">Sensor Settings</h1>
          <p class="mt-1 text-sm text-muted-foreground m-0">
            Update the names and calibration of your voltage sensors and current clamps.
          </p>
        </div>
        <!-- Autosave status -->
        <span
          :class="cn(
            'flex items-center gap-1.5 text-sm shrink-0',
            status === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )"
        >
          <template v-if="status === 'saving'"><Spinner /> Saving…</template>
          <template v-else-if="status === 'error'">
            <CircleAlertIcon class="size-4" />
            Not saved{{ lastSavedText ? ` · last saved ${lastSavedText}` : "" }}
            <!-- Only for connection problems; bad values need fixing, not retrying -->
            <Button v-if="syncError" variant="outline" size="sm" class="ml-1" @click="save">
              <RotateCwIcon data-icon="inline-start" />
              Try again
            </Button>
          </template>
          <template v-else-if="lastSavedText">
            <CheckIcon class="size-4" /> Last saved {{ lastSavedText }}
          </template>
        </span>
      </div>
    </header>

    <div v-if="loading" class="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner /> Loading settings from the device…
    </div>

    <Alert v-else-if="loadError" variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>Couldn't load settings</AlertTitle>
      <AlertDescription class="flex flex-col gap-3">
        <span>{{ loadError }}</span>
        <Button variant="outline" size="sm" class="w-fit" @click="load">Try again</Button>
      </AlertDescription>
    </Alert>

    <main v-else-if="config" class="flex flex-col gap-6 w-full">
      <!-- Couldn't reach the device -->
      <Alert v-if="syncError" variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Not saved</AlertTitle>
        <AlertDescription>{{ syncError }}</AlertDescription>
      </Alert>

      <!-- Validation errors from the last save -->
      <Alert v-if="saveErrors.length" variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Not saved. Fix these and it will save again:</AlertTitle>
        <AlertDescription>
          <ul class="list-disc pl-4">
            <li v-for="e in saveErrors" :key="e">{{ e }}</li>
          </ul>
        </AlertDescription>
      </Alert>

      <!-- ===== Voltage sensors ===== -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <ZapIcon class="size-5 text-muted-foreground" />
            <CardTitle>Voltage sensors</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div
            v-for="key in voltageKeys"
            :key="key"
            :class="cn(
              'flex flex-col gap-3 rounded-lg border p-4',
              sectionInvalid(key) ? 'border-destructive' : 'border-border/50',
              !config.inputs[key].enabled && 'opacity-60',
            )"
          >
            <!-- Header: input id + on/off switch -->
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2">
                <Badge variant="outline" class="font-mono">{{ key.toUpperCase() }}</Badge>
                <span v-if="config.inputs[key].name" class="text-sm truncate">{{ config.inputs[key].name }}</span>
              </span>
              <label class="flex items-center gap-2 text-sm text-muted-foreground">
                {{ config.inputs[key].enabled ? "Connected" : "Not connected" }}
                <Switch v-model="config.inputs[key].enabled" :aria-label="`${key.toUpperCase()} connected`" />
              </label>
            </div>

            <template v-if="config.inputs[key].enabled">
            <Field>
              <FieldLabel :for="key + '-name'">Name</FieldLabel>
              <Input
                :id="key + '-name'"
                v-model="config.inputs[key].name"
                :placeholder="key.toUpperCase()"
                maxlength="40"
              />
            </Field>

            <Collapsible v-model:open="open[key]">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="w-fit -ml-2">
                  <SlidersHorizontalIcon data-icon="inline-start" />
                  Advanced
                  <ChevronDownIcon data-icon="inline-end" :class="open[key] ? 'rotate-180' : ''" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <FieldGroup class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                  <Field :data-invalid="invalid(key, 'gain') || undefined">
                    <FieldLabel>Gain</FieldLabel>
                    <Select
                      :model-value="String(config.inputs[key].gain)"
                      @update:model-value="(v) => (config.inputs[key].gain = Number(v))"
                    >
                      <SelectTrigger class="w-full" :aria-invalid="invalid(key, 'gain') || undefined">
                        <!-- Text given directly so it updates live (e.g. when turns change) -->
                        <SelectValue>{{ gainLabel(key, config.inputs[key].gain) }}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem v-for="g in validGains" :key="g" :value="String(g)">
                            {{ gainLabel(key, g) }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field :data-invalid="invalid(key, 'calibration') || undefined">
                    <FieldLabel :for="key + '-cal'">Calibration</FieldLabel>
                    <Input :id="key + '-cal'" v-model.number="config.inputs[key].calibration" :aria-invalid="invalid(key, 'calibration') || undefined" type="number" step="0.001" min="0.5" max="2" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("calibration") }}</span>
                  </Field>
                  <Field :data-invalid="invalid(key, 'divider_ratio') || undefined">
                    <FieldLabel :for="key + '-div'">Divider ratio</FieldLabel>
                    <Input :id="key + '-div'" v-model.number="config.inputs[key].divider_ratio" :aria-invalid="invalid(key, 'divider_ratio') || undefined" type="number" step="0.01" min="1" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("divider_ratio") }}</span>
                  </Field>
                  <Field :data-invalid="invalid(key, 'transformer_input_v') || undefined">
                    <FieldLabel :for="key + '-tin'">Transformer input (V)</FieldLabel>
                    <Input :id="key + '-tin'" v-model.number="config.inputs[key].transformer_input_v" :aria-invalid="invalid(key, 'transformer_input_v') || undefined" type="number" step="0.1" min="1" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("transformer_input_v") }}</span>
                  </Field>
                  <Field :data-invalid="invalid(key, 'transformer_output_v') || undefined">
                    <FieldLabel :for="key + '-tout'">Transformer output (V)</FieldLabel>
                    <Input :id="key + '-tout'" v-model.number="config.inputs[key].transformer_output_v" :aria-invalid="invalid(key, 'transformer_output_v') || undefined" type="number" step="0.1" min="0.1" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("transformer_output_v") }}</span>
                  </Field>
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
            </template>
          </div>
        </CardContent>
      </Card>

      <!-- ===== Current clamps ===== -->
      <Card>
        <CardHeader>
          <div class="flex items-center gap-2">
            <GaugeIcon class="size-5 text-muted-foreground" />
            <CardTitle>Current clamps</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div
            v-for="key in currentKeys"
            :key="key"
            :class="cn(
              'flex flex-col gap-3 rounded-lg border p-4',
              sectionInvalid(key) ? 'border-destructive' : 'border-border/50',
              !config.inputs[key].enabled && 'opacity-60',
            )"
          >
            <!-- Header: input id + on/off switch -->
            <div class="flex items-center justify-between gap-3">
              <span class="flex items-center gap-2">
                <Badge variant="outline" class="font-mono">{{ key.toUpperCase() }}</Badge>
                <span v-if="config.inputs[key].name" class="text-sm truncate">{{ config.inputs[key].name }}</span>
              </span>
              <label class="flex items-center gap-2 text-sm text-muted-foreground">
                {{ config.inputs[key].enabled ? "Connected" : "Not connected" }}
                <Switch v-model="config.inputs[key].enabled" :aria-label="`${key.toUpperCase()} connected`" />
              </label>
            </div>

            <template v-if="config.inputs[key].enabled">
            <Field>
              <FieldLabel :for="key + '-name'">Name</FieldLabel>
              <Input
                :id="key + '-name'"
                v-model="config.inputs[key].name"
                :placeholder="key.toUpperCase()"
                maxlength="40"
              />
            </Field>

            <Collapsible v-model:open="open[key]">
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="w-fit -ml-2">
                  <SlidersHorizontalIcon data-icon="inline-start" />
                  Advanced
                  <ChevronDownIcon data-icon="inline-end" :class="open[key] ? 'rotate-180' : ''" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <FieldGroup class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                  <Field :data-invalid="invalid(key, 'voltage_sensor') || undefined">
                    <FieldLabel>Voltage source</FieldLabel>
                    <Select v-model="config.inputs[key].voltage_sensor" :disabled="enabledVoltageKeys.length === 0">
                      <SelectTrigger class="w-full" :aria-invalid="invalid(key, 'voltage_sensor') || undefined">
                        <!-- Text given directly so a renamed voltage sensor shows right away -->
                        <SelectValue>{{
                          enabledVoltageKeys.length ? voltageLabel(config.inputs[key].voltage_sensor) : "No voltage sensor connected"
                        }}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem v-for="v in enabledVoltageKeys" :key="v" :value="v">
                            {{ voltageLabel(v) }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field :data-invalid="invalid(key, 'gain') || undefined">
                    <FieldLabel>Gain</FieldLabel>
                    <Select
                      :model-value="String(config.inputs[key].gain)"
                      @update:model-value="(v) => (config.inputs[key].gain = Number(v))"
                    >
                      <SelectTrigger class="w-full" :aria-invalid="invalid(key, 'gain') || undefined">
                        <!-- Text given directly so it updates live (e.g. when turns change) -->
                        <SelectValue>{{ gainLabel(key, config.inputs[key].gain) }}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem v-for="g in validGains" :key="g" :value="String(g)">
                            {{ gainLabel(key, g) }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field :data-invalid="invalid(key, 'turns') || undefined">
                    <FieldLabel :for="key + '-turns'">Turns</FieldLabel>
                    <Input :id="key + '-turns'" v-model.number="config.inputs[key].turns" :aria-invalid="invalid(key, 'turns') || undefined" type="number" step="1" min="1" max="100" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("turns") }}</span>
                  </Field>
                  <Field :data-invalid="invalid(key, 'calibration') || undefined">
                    <FieldLabel :for="key + '-cal'">Calibration</FieldLabel>
                    <Input :id="key + '-cal'" v-model.number="config.inputs[key].calibration" :aria-invalid="invalid(key, 'calibration') || undefined" type="number" step="0.001" min="0.5" max="2" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("calibration") }}</span>
                  </Field>
                  <Field :data-invalid="invalid(key, 'ct_ratio') || undefined">
                    <FieldLabel :for="key + '-ratio'">CT ratio (N:1)</FieldLabel>
                    <Input :id="key + '-ratio'" v-model.number="config.inputs[key].ct_ratio" :aria-invalid="invalid(key, 'ct_ratio') || undefined" type="number" step="1" min="1" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("ct_ratio") }}</span>
                  </Field>
                  <Field :data-invalid="invalid(key, 'ct_burden_ohms') || undefined">
                    <FieldLabel :for="key + '-burden'">Burden resistor (Ω)</FieldLabel>
                    <Input :id="key + '-burden'" v-model.number="config.inputs[key].ct_burden_ohms" :aria-invalid="invalid(key, 'ct_burden_ohms') || undefined" type="number" step="0.1" min="0.1" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("ct_burden_ohms") }}</span>
                  </Field>
                </FieldGroup>
              </CollapsibleContent>
            </Collapsible>
            </template>
          </div>
        </CardContent>
      </Card>

      <!-- ===== System (advanced) ===== -->
      <Collapsible v-model:open="open.system">
        <Card>
          <CardHeader>
            <CollapsibleTrigger as-child>
              <Button variant="ghost" class="w-fit -ml-2">
                <SlidersHorizontalIcon data-icon="inline-start" />
                Advanced system settings
                <ChevronDownIcon data-icon="inline-end" :class="open.system ? 'rotate-180' : ''" />
              </Button>
            </CollapsibleTrigger>
            <CardDescription>Sampling, database noise filtering and LED thresholds.</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent class="flex flex-col gap-6">
              <section class="flex flex-col gap-3">
                <h3 class="text-sm font-medium m-0">Sampling</h3>
                <FieldGroup class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field :data-invalid="invalid('adc', 'oversampling_ratio') || undefined">
                    <FieldLabel>Oversampling ratio</FieldLabel>
                    <Select
                      :model-value="String(config.adc.oversampling_ratio)"
                      @update:model-value="(v) => (config.adc.oversampling_ratio = Number(v))"
                    >
                      <SelectTrigger class="w-full" :aria-invalid="invalid('adc', 'oversampling_ratio') || undefined">
                        <SelectValue>{{ osrLabel(config.adc.oversampling_ratio) }}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem v-for="o in validOsr" :key="o" :value="String(o)">
                            {{ osrLabel(o) }}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription class="text-destructive">* Restart the ADC script to apply</FieldDescription>
                  </Field>
                  <Field :data-invalid="invalid('adc', 'report_seconds') || undefined">
                    <FieldLabel for="report-s">Report every (s)</FieldLabel>
                    <Input id="report-s" v-model.number="config.adc.report_seconds" :aria-invalid="invalid('adc', 'report_seconds') || undefined" type="number" step="0.1" min="0.05" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("adc.report_seconds") }}</span>
                    <FieldDescription class="text-destructive">* Restart the ADC script to apply</FieldDescription>
                  </Field>
                </FieldGroup>
              </section>

              <section class="flex flex-col gap-3">
                <h3 class="text-sm font-medium m-0">Database</h3>
                <FieldGroup class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Field :data-invalid="invalid('database', 'insert_seconds') || undefined">
                    <FieldLabel for="db-insert">Save every (s)</FieldLabel>
                    <Input id="db-insert" v-model.number="config.database.insert_seconds" :aria-invalid="invalid('database', 'insert_seconds') || undefined" type="number" step="1" min="0.05" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("database.insert_seconds") }}</span>
                  </Field>
                  <Field :data-invalid="invalid('database', 'min_voltage') || undefined">
                    <FieldLabel for="db-v">Ignore voltage below (V)</FieldLabel>
                    <Input id="db-v" v-model.number="config.database.min_voltage" :aria-invalid="invalid('database', 'min_voltage') || undefined" type="number" step="0.5" min="0" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("database.min_voltage") }}</span>
                  </Field>
                  <Field :data-invalid="invalid('database', 'min_current') || undefined">
                    <FieldLabel for="db-c">Ignore current below (A)</FieldLabel>
                    <Input id="db-c" v-model.number="config.database.min_current" :aria-invalid="invalid('database', 'min_current') || undefined" type="number" step="0.01" min="0" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("database.min_current") }}</span>
                  </Field>
                  <Field :data-invalid="invalid('database', 'min_power') || undefined">
                    <FieldLabel for="db-p">Ignore power below (W)</FieldLabel>
                    <Input id="db-p" v-model.number="config.database.min_power" :aria-invalid="invalid('database', 'min_power') || undefined" type="number" step="0.1" min="0" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("database.min_power") }}</span>
                  </Field>
                </FieldGroup>
              </section>

              <section class="flex flex-col gap-3">
                <h3 class="text-sm font-medium m-0">Status LEDs</h3>
                <FieldGroup class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field :data-invalid="invalid('leds', 'min_voltage') || undefined">
                    <FieldLabel for="led-v">Voltage LED on above (V)</FieldLabel>
                    <Input id="led-v" v-model.number="config.leds.min_voltage" :aria-invalid="invalid('leds', 'min_voltage') || undefined" type="number" step="1" min="0" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("leds.min_voltage") }}</span>
                  </Field>
                  <Field :data-invalid="invalid('leds', 'min_current') || undefined">
                    <FieldLabel for="led-c">Current LED on above (A)</FieldLabel>
                    <Input id="led-c" v-model.number="config.leds.min_current" :aria-invalid="invalid('leds', 'min_current') || undefined" type="number" step="0.01" min="0" />
                    <span class="text-xs text-muted-foreground/70">{{ rangeText("leds.min_current") }}</span>
                  </Field>
                </FieldGroup>
              </section>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </main>
  </div>
</template>
