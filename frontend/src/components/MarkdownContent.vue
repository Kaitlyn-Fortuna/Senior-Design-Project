<script setup>
import { computed } from "vue";
import { renderMarkdown } from "@/lib/markdown";

const props = defineProps({
  source: { type: String, default: "" },
});

const html = computed(() => renderMarkdown(props.source));
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify -->
  <div class="md" v-html="html" />
</template>

<style scoped>
.md {
  font-size: 0.875rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
}
.md :deep(> :first-child) {
  margin-top: 0;
}
.md :deep(> :last-child) {
  margin-bottom: 0;
}
.md :deep(p) {
  margin: 0 0 0.6em;
}
.md :deep(ul),
.md :deep(ol) {
  margin: 0 0 0.6em;
  padding-left: 1.25em;
}
.md :deep(ul) {
  list-style: disc;
}
.md :deep(ol) {
  list-style: decimal;
}
.md :deep(li) {
  margin: 0.2em 0;
}
.md :deep(li > ul),
.md :deep(li > ol) {
  margin: 0.2em 0 0;
}
.md :deep(li::marker) {
  color: var(--muted-foreground);
}
.md :deep(strong) {
  font-weight: 600;
  color: var(--foreground);
}
.md :deep(h1),
.md :deep(h2),
.md :deep(h3),
.md :deep(h4) {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0.9em 0 0.35em;
}
.md :deep(a) {
  color: var(--sidebar-primary);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.md :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.8em;
  padding: 0.1em 0.35em;
  border-radius: 0.3rem;
  background: color-mix(in oklch, var(--foreground) 7%, transparent);
}
.md :deep(pre) {
  margin: 0 0 0.6em;
  padding: 0.6em 0.75em;
  border-radius: 0.4rem;
  overflow-x: auto;
  background: color-mix(in oklch, var(--foreground) 7%, transparent);
}
.md :deep(pre code) {
  padding: 0;
  background: none;
}
.md :deep(blockquote) {
  margin: 0 0 0.6em;
  padding-left: 0.75em;
  border-left: 3px solid var(--border);
  color: var(--muted-foreground);
}
.md :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
  margin: 0.8em 0;
}
.md :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 0 0 0.6em;
  font-size: 0.8rem;
}
.md :deep(th),
.md :deep(td) {
  border: 1px solid var(--border);
  padding: 0.3em 0.55em;
  text-align: left;
  white-space: nowrap;
}
.md :deep(th) {
  font-weight: 600;
  background: color-mix(in oklch, var(--foreground) 4%, transparent);
}
</style>
