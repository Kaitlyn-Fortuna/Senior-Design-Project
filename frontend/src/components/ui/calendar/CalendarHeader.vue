<script setup>
import { reactiveOmit } from "@vueuse/core";
import { cn } from "@/lib/utils";
import { CalendarHeader, useForwardProps } from "reka-ui";

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
  <CalendarHeader
    data-slot="calendar-header"
    :class="
      cn(
        'flex justify-center pt-1 relative items-center w-full px-8',
        props.class,
      )
    "
    v-bind="forwardedProps"
  >
    <slot />
  </CalendarHeader>
</template>
