<script setup>
import { computed, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangleIcon, SaveIcon } from "@lucide/vue";
import { cn } from "@/lib/utils";
import ConfigNumberField from "./ConfigNumberField.vue";
import ConfigSelectField from "./ConfigSelectField.vue";

/**
 * Edits the advanced (non-name, non-enabled) values of one group of inputs
 * (all current inputs or all voltage inputs). Edits are kept as drafts until
 * Save is pressed; switching between inputs keeps every input's draft.
 */
const props = defineProps({
  open: { type: Boolean, default: false },
  kind: { type: String, required: true }, // "current" | "voltage"
  keys: { type: Array, required: true }, // e.g. ["c0", ..., "c5"]
  inputs: { type: Object, required: true }, // config.inputs (not modified here)
  startKey: { type: String, default: "" },
  displayName: { type: Function, required: true }, // key -> name shown to the user
  voltageSensorOptions: { type: Array, default: () => [] },
  validGains: { type: Array, required: true },
});

const emit = defineEmits(["update:open", "save"]);

const FIELDS = {
  current: [
    "ct_ratio",
    "ct_burden_ohms",
    "turns",
    "voltage_sensor",
    "gain",
    "calibration",
  ],
  voltage: [
    "transformer_input_v",
    "transformer_output_v",
    "divider_ratio",
    "gain",
    "calibration",
  ],
};

// Same limits as backend/src/deviceConfig.js
const LIMITS = {
  ct_ratio: { min: 1, max: 100000 },
  ct_burden_ohms: { min: 0.1, max: 1000 },
  turns: { min: 1, max: 100, integer: true },
  transformer_input_v: { min: 1, max: 1000 },
  transformer_output_v: { min: 0.1, max: 1000 },
  divider_ratio: { min: 1, max: 1000 },
  calibration: { min: 0.5, max: 2 },
};

const fields = computed(() => FIELDS[props.kind]);
const drafts = ref({});
const activeKey = ref("");
const confirmingClose = ref(false);

function pick(input) {
  return Object.fromEntries(fields.value.map((f) => [f, input[f]]));
}

// Fresh drafts every time the modal opens
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    drafts.value = Object.fromEntries(
      props.keys.map((k) => [k, pick(props.inputs[k])]),
    );
    activeKey.value = props.keys.includes(props.startKey)
      ? props.startKey
      : props.keys[0];
    confirmingClose.value = false;
  },
  { immediate: true },
);

const active = computed(() => drafts.value[activeKey.value]);

const dirtyKeys = computed(() =>
  props.keys.filter((k) =>
    fields.value.some((f) => drafts.value[k]?.[f] !== props.inputs[k][f]),
  ),
);

function validate(draft) {
  const errors = {};
  for (const f of fields.value) {
    const value = draft[f];
    if (f === "gain") {
      if (!props.validGains.includes(value)) errors[f] = "Choose a gain";
      continue;
    }
    if (f === "voltage_sensor") {
      if (!props.voltageSensorOptions.some((o) => o.value === value))
        errors[f] = "Choose a voltage input";
      continue;
    }
    const { min, max, integer } = LIMITS[f];
    if (value === "" || value === null || value === undefined)
      errors[f] = "Required";
    else if (!Number.isFinite(value)) errors[f] = "Must be a number";
    else if (integer && !Number.isInteger(value))
      errors[f] = "Must be a whole number";
    else if (value < min) errors[f] = `Must be at least ${min}`;
    else if (value > max) errors[f] = `Must be at most ${max}`;
  }
  return errors;
}

const errorsByKey = computed(() =>
  Object.fromEntries(
    props.keys.map((k) => [k, validate(drafts.value[k] ?? {})]),
  ),
);
const hasErrors = (k) => Object.keys(errorsByKey.value[k] ?? {}).length > 0;
const err = (f) => errorsByKey.value[activeKey.value]?.[f] ?? "";
const fieldId = (f) => `advanced-${activeKey.value}-${f}`;

const unit = computed(() => (props.kind === "current" ? "A" : "V"));

// Amps or line volts per volt at the ADC input, from the draft values
// (NaN while a value is blank or invalid)
const scale = computed(() => {
  const i = active.value;
  if (!i) return NaN;
  const v =
    props.kind === "current"
      ? (i.ct_ratio / i.ct_burden_ohms / i.turns) * i.calibration
      : i.divider_ratio *
        (i.transformer_input_v / i.transformer_output_v) *
        i.calibration;
  return Number.isFinite(v) && v > 0 ? v : NaN;
});

const scaleSummary = computed(() =>
  Number.isNaN(scale.value)
    ? ""
    : `${scale.value.toFixed(2)} ${unit.value} per ADC volt`,
);

// ADC full scale is ±1.2 V / gain; divide by √2 for the largest RMS sine wave
const ADC_VREF = 1.2;
const gainOptions = computed(() =>
  props.validGains.map((g) => {
    const max = (ADC_VREF / g / Math.SQRT2) * scale.value;
    return {
      value: g,
      label: Number.isNaN(max)
        ? `×${g}`
        : `×${g}: up to ${max.toFixed(2)} ${unit.value}`,
    };
  }),
);

// Escape, the X button and clicking outside all come through here
function onOpenChange(open) {
  if (open) return;
  if (dirtyKeys.value.length > 0) {
    confirmingClose.value = true;
    return;
  }
  emit("update:open", false);
}

function discard() {
  confirmingClose.value = false;
  emit("update:open", false);
}

function save() {
  const invalid = props.keys.find(hasErrors);
  if (invalid) {
    activeKey.value = invalid;
    confirmingClose.value = false;
    return;
  }
  emit(
    "save",
    Object.fromEntries(dirtyKeys.value.map((k) => [k, { ...drafts.value[k] }])),
  );
  confirmingClose.value = false;
  emit("update:open", false);
}

const anyErrors = computed(() => props.keys.some(hasErrors));
const typeLabel = computed(() =>
  props.kind === "current" ? "Current Inputs" : "Voltage Inputs",
);
</script>

<template>
  <Dialog :open="props.open" @update:open="onOpenChange">
    <DialogContent
      class="sm:max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto"
    >
      <DialogHeader>
        <DialogTitle>Advanced Settings · {{ typeLabel }}</DialogTitle>
        <DialogDescription>
          Changes apply to device-configuration.json when you press Save.
        </DialogDescription>
      </DialogHeader>

      <!-- Input switcher -->
      <div
        role="tablist"
        :aria-label="typeLabel"
        class="flex flex-wrap gap-1.5"
      >
        <button
          v-for="k in props.keys"
          :key="k"
          type="button"
          role="tab"
          :aria-selected="k === activeKey"
          :class="
            cn(
              'relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer',
              k === activeKey
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted',
              !props.inputs[k].enabled && k !== activeKey && 'opacity-60',
            )
          "
          @click="activeKey = k"
        >
          <span class="font-mono font-semibold">{{ k.toUpperCase() }}</span>
          <span class="max-w-28 truncate">{{ props.displayName(k) }}</span>
          <span
            v-if="hasErrors(k)"
            class="size-1.5 rounded-full bg-destructive"
            title="Has invalid values"
          />
          <span
            v-else-if="dirtyKeys.includes(k)"
            class="size-1.5 rounded-full bg-primary"
            title="Unsaved changes"
          />
        </button>
      </div>

      <div
        v-if="active"
        class="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/20 p-3.5"
      >
        <div class="flex items-center gap-2">
          <Badge variant="outline" class="font-mono font-semibold">
            {{ activeKey.toUpperCase() }}
          </Badge>
          <span class="text-sm font-medium truncate">{{
            props.displayName(activeKey)
          }}</span>
          <Badge
            v-if="!props.inputs[activeKey].enabled"
            variant="secondary"
            class="text-xs"
          >
            Disabled
          </Badge>
        </div>

        <!-- Current transformer settings -->
        <div
          v-if="props.kind === 'current'"
          class="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <ConfigNumberField
            :id="fieldId('ct_ratio')"
            v-model="active.ct_ratio"
            label="CT Ratio"
            hint="Primary : secondary turns (e.g. 2400 for 2400:1)"
            :min="1"
            :max="100000"
            :error="err('ct_ratio')"
          />
          <ConfigNumberField
            :id="fieldId('ct_burden_ohms')"
            v-model="active.ct_burden_ohms"
            label="Burden Resistor"
            unit="Ω"
            :min="0.1"
            :max="1000"
            :error="err('ct_burden_ohms')"
          />
          <ConfigNumberField
            :id="fieldId('turns')"
            v-model="active.turns"
            label="Conductor Turns"
            hint="Times the wire passes through the clamp"
            :step="1"
            :min="1"
            :max="100"
            :error="err('turns')"
          />
          <ConfigSelectField
            :id="fieldId('voltage_sensor')"
            v-model="active.voltage_sensor"
            label="Voltage Reference"
            hint="Voltage input used to compute power"
            :options="props.voltageSensorOptions"
            :error="err('voltage_sensor')"
          />
          <ConfigSelectField
            :id="fieldId('gain')"
            v-model="active.gain"
            label="ADC Gain"
            :options="gainOptions"
            :error="err('gain')"
          />
          <ConfigNumberField
            :id="fieldId('calibration')"
            v-model="active.calibration"
            label="Calibration Factor"
            hint="Multiplier, 0.5 – 2"
            :step="0.001"
            :min="0.5"
            :max="2"
            :error="err('calibration')"
          />
        </div>

        <!-- Voltage transformer settings -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ConfigNumberField
            :id="fieldId('transformer_input_v')"
            v-model="active.transformer_input_v"
            label="Transformer Input"
            unit="V"
            :min="1"
            :max="1000"
            :error="err('transformer_input_v')"
          />
          <ConfigNumberField
            :id="fieldId('transformer_output_v')"
            v-model="active.transformer_output_v"
            label="Transformer Output"
            unit="V"
            :min="0.1"
            :max="1000"
            :error="err('transformer_output_v')"
          />
          <ConfigNumberField
            :id="fieldId('divider_ratio')"
            v-model="active.divider_ratio"
            label="Divider Ratio"
            :min="1"
            :max="1000"
            :error="err('divider_ratio')"
          />
          <ConfigSelectField
            :id="fieldId('gain')"
            v-model="active.gain"
            label="ADC Gain"
            :options="gainOptions"
            :error="err('gain')"
          />
          <ConfigNumberField
            :id="fieldId('calibration')"
            v-model="active.calibration"
            label="Calibration Factor"
            hint="Multiplier, 0.5 – 2"
            :step="0.001"
            :min="0.5"
            :max="2"
            :error="err('calibration')"
          />
        </div>

        <p v-if="scaleSummary" class="text-xs text-muted-foreground m-0">
          Effective scale:
          <span class="font-mono text-foreground">{{ scaleSummary }}</span>
        </p>
      </div>

      <!-- Unsaved-changes warning -->
      <div
        v-if="confirmingClose"
        role="alert"
        class="flex flex-col gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-start gap-2">
          <AlertTriangleIcon
            class="size-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
          />
          <span>
            Unsaved changes on
            <strong>{{
              dirtyKeys.map((k) => k.toUpperCase()).join(", ")
            }}</strong
            >. Discard them?
          </span>
        </div>
        <div class="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" @click="confirmingClose = false">
            Keep Editing
          </Button>
          <Button variant="destructive" size="sm" @click="discard"
            >Discard</Button
          >
        </div>
      </div>

      <DialogFooter class="items-center">
        <span
          v-if="dirtyKeys.length"
          class="text-xs text-muted-foreground sm:mr-auto"
        >
          {{ dirtyKeys.length }}
          {{ dirtyKeys.length === 1 ? "input" : "inputs" }} with unsaved changes
        </span>
        <Button variant="outline" @click="onOpenChange(false)">Cancel</Button>
        <Button :disabled="dirtyKeys.length === 0 || anyErrors" @click="save">
          <SaveIcon data-icon="inline-start" />
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
