<script setup>
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";

/**
 * options: [{ value, label, disabled? }]. Values may be numbers or strings;
 * the emitted value keeps the original type.
 */
const props = defineProps({
  id: { type: String, required: true },
  label: { type: String, required: true },
  modelValue: { type: [Number, String], default: "" },
  options: { type: Array, required: true },
  hint: { type: String, default: "" },
  error: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["update:modelValue"]);

function onChange(value) {
  const match = props.options.find((o) => String(o.value) === value);
  emit("update:modelValue", match ? match.value : value);
}
</script>

<template>
  <Field :data-invalid="!!props.error" class="gap-1.5">
    <FieldLabel :for="props.id" class="text-xs">{{ props.label }}</FieldLabel>
    <Select
      :model-value="String(props.modelValue)"
      :disabled="props.disabled"
      @update:model-value="onChange"
    >
      <SelectTrigger
        :id="props.id"
        class="w-full"
        :aria-invalid="!!props.error"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in props.options"
          :key="String(option.value)"
          :value="String(option.value)"
          :disabled="option.disabled"
        >
          {{ option.label }}
        </SelectItem>
      </SelectContent>
    </Select>
    <FieldError v-if="props.error" class="text-xs">{{
      props.error
    }}</FieldError>
    <FieldDescription v-else-if="props.hint" class="text-xs">
      {{ props.hint }}
    </FieldDescription>
  </Field>
</template>
