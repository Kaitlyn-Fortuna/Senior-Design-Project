<script setup>
// shadcn-vue date picker (Popover + Calendar) that reads and writes plain
// "YYYY-MM-DD" strings, so it can drop in where <input type="date"> was used.
import { computed, ref, watch } from "vue";
import { DateFormatter, getLocalTimeZone, parseDate, today } from "@internationalized/date";
import { CalendarIcon } from "@lucide/vue";
import { createYearRange } from "reka-ui/date";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

defineOptions({ inheritAttrs: false }); // attrs like aria-invalid go on the button

const props = defineProps({
  modelValue: { type: String, default: "" },
  /** Earliest selectable date, "YYYY-MM-DD" */
  min: { type: String, default: "" },
  /** Latest selectable date, "YYYY-MM-DD" */
  max: { type: String, default: "" },
  id: { type: String, default: undefined },
  placeholder: { type: String, default: "Pick a date" },
  class: { type: [String, Object, Array], default: undefined },
});
const emit = defineEmits(["update:modelValue"]);

const open = ref(false);
const formatter = new DateFormatter("en-US", { dateStyle: "medium" });

const toDateValue = (s) => {
  if (!s) return undefined;
  try {
    return parseDate(s);
  } catch {
    return undefined;
  }
};

const value = computed(() => toDateValue(props.modelValue));
const minValue = computed(() => toDateValue(props.min));
const maxValue = computed(() => toDateValue(props.max));
// Years offered in the year dropdown: from `min` (or YEARS_BACK years ago) to `max` (or this year),
// instead of the Calendar's default of a century back
const YEARS_BACK = 10;
const yearRange = computed(() => {
  const now = today(getLocalTimeZone());
  return createYearRange({
    start: minValue.value ?? now.subtract({ years: YEARS_BACK }),
    end: maxValue.value ?? now,
  });
});

// Month the calendar is showing. Controlled here so the month/year Selects can move it;
// reset to the selected date (or the latest allowed one) each time the picker opens.
const viewDate = ref(today(getLocalTimeZone()));
watch(open, (isOpen) => {
  if (isOpen) viewDate.value = value.value ?? maxValue.value ?? today(getLocalTimeZone());
});

const monthFormatter = new DateFormatter("en-US", { month: "short", timeZone: "UTC" });
const months = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: monthFormatter.format(new Date(Date.UTC(2000, i, 1))),
}));
const setView = (field, v) => {
  viewDate.value = viewDate.value.set({ [field]: Number(v) });
};

const label = computed(() =>
  value.value ? formatter.format(value.value.toDate(getLocalTimeZone())) : props.placeholder,
);

function onSelect(date) {
  if (!date) return;
  emit("update:modelValue", date.toString()); // CalendarDate -> "YYYY-MM-DD"
  open.value = false;
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        variant="outline"
        v-bind="$attrs"
        :class="cn('justify-start text-left font-normal', !value && 'text-muted-foreground', props.class)"
      >
        <CalendarIcon class="text-muted-foreground" />
        {{ label }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0" align="start">
      <Calendar
        v-model:placeholder="viewDate"
        :model-value="value"
        :min-value="minValue"
        :max-value="maxValue"
        prevent-deselect
        initial-focus
        @update:model-value="onSelect"
      >
        <!-- Month / year jump, using shadcn Selects instead of native <select>s -->
        <template #calendar-heading="{ date }">
          <div class="flex items-center justify-center gap-1.5">
            <Select :model-value="String(date.month)" @update:model-value="(v) => setView('month', v)">
              <SelectTrigger size="sm" class="w-[4.75rem]" aria-label="Month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" class="max-h-64 min-w-(--reka-select-trigger-width)">
                <SelectItem v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</SelectItem>
              </SelectContent>
            </Select>
            <Select :model-value="String(date.year)" @update:model-value="(v) => setView('year', v)">
              <SelectTrigger size="sm" class="w-[5.25rem]" aria-label="Year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start" class="max-h-64 min-w-(--reka-select-trigger-width)">
                <SelectItem v-for="y in yearRange" :key="y.year" :value="String(y.year)">{{ y.year }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </template>
      </Calendar>
    </PopoverContent>
  </Popover>
</template>
