<script setup>
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  modelValue: { type: [Number, String], default: "" },
  unit: { type: String, default: "" },
  hint: { type: String, default: "" },
  error: { type: String, default: "" },
  step: { type: [Number, String], default: "any" },
  min: { type: [Number, String], default: undefined },
  max: { type: [Number, String], default: undefined },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

function onInput(value) {
  // Keep "" so the server can report the field as required
  emit(
    "update:modelValue",
    value === "" || value === null ? "" : Number(value),
  );
}
</script>

<template>
  <Field :data-invalid="!!props.error" class="gap-1.5">
    <FieldLabel :for="props.id" class="text-xs">
      {{ props.label }}
      <span v-if="props.unit" class="font-normal text-muted-foreground">
        ({{ props.unit }})
      </span>
    </FieldLabel>
    <Input
      :id="props.id"
      type="number"
      inputmode="decimal"
      :model-value="props.modelValue"
      :step="props.step"
      :min="props.min"
      :max="props.max"
      :disabled="props.disabled"
      :aria-invalid="!!props.error"
      class="font-mono"
      @update:model-value="onInput"
    />
    <FieldError v-if="props.error" class="text-xs">{{
      props.error
    }}</FieldError>
    <FieldDescription v-else-if="props.hint" class="text-xs">
      {{ props.hint }}
    </FieldDescription>
  </Field>
</template>
