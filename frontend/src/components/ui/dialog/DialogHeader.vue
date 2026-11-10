<script setup>
import { cn } from "@/lib/utils";

const props = defineProps({
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <div
    data-slot="dialog-header"
    :class="cn('flex flex-col gap-1.5 text-left pr-8', props.class)"
  >
    <slot />
  </div>
</template>
