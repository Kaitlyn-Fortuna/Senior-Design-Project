<script setup>
import { SparklesIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";

defineProps({
  loading: { type: Boolean, default: false },
  label: { type: String, default: "Summarize" },
});
defineEmits(["click"]);
</script>

<template>
  <Button
    variant="outline"
    size="sm"
    class="text-foreground"
    :disabled="loading"
    @click="$emit('click')"
  >
    <SparklesIcon data-icon="inline-start" class="text-primary-foreground dark:text-primary" />
    {{ label }}
  </Button>
</template>
