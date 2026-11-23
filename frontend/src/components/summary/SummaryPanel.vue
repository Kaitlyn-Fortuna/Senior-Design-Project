<script setup>
import { RefreshCwIcon, SparklesIcon, XIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import MarkdownContent from "@/components/MarkdownContent.vue";
import { formatTimestamp } from "@/lib/format";

/** Inline AI summary shown under a chart. Pass the object from useAiSummary. */
defineProps({
  summary: { type: Object, required: true },
  title: { type: String, default: "Summary" },
});
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    leave-active-class="transition duration-150 ease-in"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <section
      v-if="summary.open.value"
      class="rounded-lg border border-primary/50 bg-primary/8 dark:bg-primary/5 p-3.5 flex flex-col gap-2"
      :aria-busy="summary.loading.value"
      aria-live="polite"
    >
      <header class="flex items-center justify-between gap-2">
        <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground m-0">
          <SparklesIcon class="size-3.5 text-primary-foreground dark:text-primary" />
          {{ title }}
          <span
            v-if="summary.generatedAt.value && !summary.loading.value"
            class="font-normal normal-case tracking-normal"
          >
            · {{ formatTimestamp(summary.generatedAt.value.getTime(), { date: false }) }}
          </span>
        </p>
        <div class="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Regenerate summary"
            title="Regenerate with the latest data"
            :disabled="summary.loading.value"
            @click="summary.generate()"
          >
            <RefreshCwIcon :class="summary.loading.value && 'animate-spin'" />
          </Button>
          <Button variant="ghost" size="icon-xs" aria-label="Close summary" @click="summary.dismiss()">
            <XIcon />
          </Button>
        </div>
      </header>

      <div v-if="summary.loading.value && !summary.text.value" class="flex flex-col gap-2 py-1" aria-label="Summarizing">
        <span class="h-3 w-11/12 rounded bg-foreground/8 animate-pulse" />
        <span class="h-3 w-4/5 rounded bg-foreground/8 animate-pulse" />
        <span class="h-3 w-2/3 rounded bg-foreground/8 animate-pulse" />
      </div>
      <p v-else-if="summary.error.value" class="text-sm text-destructive m-0">
        {{ summary.error.value }}
        <button type="button" class="underline underline-offset-2 cursor-pointer ml-1" @click="summary.generate()">
          Try again
        </button>
      </p>
      <MarkdownContent
        v-else
        :source="summary.text.value"
        class="text-foreground transition-opacity"
        :class="summary.loading.value && 'opacity-50'"
      />
    </section>
  </Transition>
</template>
