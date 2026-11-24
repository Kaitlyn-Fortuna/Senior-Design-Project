<script setup>
import { ChevronRightIcon } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/lib/utils";
import { CalendarNext, useForwardProps } from "reka-ui";
import { buttonVariants } from '@/components/ui/button';

const props = defineProps({
  nextPage: { type: Function, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);
</script>

<template>
  <CalendarNext
    data-slot="calendar-next-button"
    :class="
      cn(
        buttonVariants({ variant: 'outline' }),
        'pointer-events-auto size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        props.class,
      )
    "
    v-bind="forwardedProps"
  >
    <slot>
      <ChevronRightIcon class="cn-rtl-flip size-4" />
    </slot>
  </CalendarNext>
</template>
