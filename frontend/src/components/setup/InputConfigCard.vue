<script setup>
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SlidersHorizontalIcon } from "@lucide/vue";
import { cn } from "@/lib/utils";

/**
 * One input from device-configuration.json (c0-c5 or v0-v1).
 * Name and enabled are edited in place; the Advanced button asks the
 * parent to open the advanced settings modal.
 */
const props = defineProps({
  inputKey: { type: String, required: true },
  input: { type: Object, required: true },
  placeholder: { type: String, default: "" },
  errors: { type: Object, default: () => ({}) }, // "c0 ct_ratio" -> message
});

const emit = defineEmits(["advanced"]);

const err = (field) => props.errors[`${props.inputKey} ${field}`] || "";
const id = (field) => `${props.inputKey}-${field}`;

const advancedErrorCount = computed(
  () =>
    Object.keys(props.errors).filter(
      (k) =>
        k.startsWith(`${props.inputKey} `) &&
        k !== `${props.inputKey} name` &&
        k !== `${props.inputKey} enabled`,
    ).length,
);
</script>

<template>
  <div
    :class="
      cn(
        'flex flex-col gap-3 rounded-lg border border-border/60 bg-card/50 p-3.5 transition-colors',
        !props.input.enabled && 'bg-muted/30',
      )
    "
  >
    <div class="flex items-center justify-between gap-3">
      <Badge variant="outline" class="font-mono font-semibold">
        {{ props.inputKey.toUpperCase() }}
      </Badge>
      <label
        :for="id('enabled')"
        class="flex items-center gap-2 text-xs font-medium cursor-pointer select-none"
        :class="
          props.input.enabled ? 'text-foreground' : 'text-muted-foreground'
        "
      >
        {{ props.input.enabled ? "Enabled" : "Disabled" }}
        <Switch :id="id('enabled')" v-model="props.input.enabled" />
      </label>
    </div>

    <div class="flex items-end gap-2">
      <Field :data-invalid="!!err('name')" class="gap-1.5 flex-1">
        <FieldLabel :for="id('name')" class="text-xs">Display Name</FieldLabel>
        <Input
          :id="id('name')"
          v-model="props.input.name"
          maxlength="40"
          :placeholder="props.placeholder"
          :aria-invalid="!!err('name')"
          :class="!props.input.enabled && 'opacity-60'"
        />
      </Field>
      <Button
        variant="outline"
        aria-haspopup="dialog"
        @click="emit('advanced', props.inputKey)"
      >
        <SlidersHorizontalIcon data-icon="inline-start" />
        Advanced
        <Badge
          v-if="advancedErrorCount > 0"
          variant="destructive"
          class="px-1.5 py-0 text-[10px]"
        >
          {{ advancedErrorCount }}
        </Badge>
      </Button>
    </div>
    <FieldError v-if="err('name')" class="text-xs">{{
      err("name")
    }}</FieldError>
  </div>
</template>
