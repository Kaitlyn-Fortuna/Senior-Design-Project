<script setup>
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/lib/utils";
import { CalendarHeadCell, useForwardProps } from "reka-ui";

const props = defineProps({
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
  <CalendarHeadCell
    data-slot="calendar-head-cell"
    :class="
      cn(
        'text-muted-foreground rounded-md flex-1 font-normal text-[0.8rem]',
        props.class,
      )
    "
    v-bind="forwardedProps"
  >
    <slot />
  </CalendarHeadCell>
</template>
