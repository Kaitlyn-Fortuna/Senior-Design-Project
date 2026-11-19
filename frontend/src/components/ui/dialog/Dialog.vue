<script setup>
import { DialogRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps({
  open: { type: Boolean, required: false, default: undefined },
  defaultOpen: { type: Boolean, required: false },
  modal: { type: Boolean, required: false, default: true },
});
const emits = defineEmits(["update:open"]);

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DialogRoot v-slot="slotProps" data-slot="dialog" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </DialogRoot>
</template>
