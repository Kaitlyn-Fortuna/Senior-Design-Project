<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  ArrowUpIcon,
  Maximize2Icon,
  Minimize2Icon,
  SparklesIcon,
  SquarePenIcon,
  XIcon,
} from "@lucide/vue";
import { Button } from "@/components/ui/button";
import MarkdownContent from "@/components/MarkdownContent.vue";
import { sendChatMessage } from "@/services/chatbot";
import { getChatContext } from "@/services/chatContext";
import { cn } from "@/lib/utils";

// Which page the assistant is helping with, and starter questions for it
const PAGES = {
  "/": {
    key: "dashboard",
    label: "Dashboard",
    suggestions: ["What is using the most power?", "How much has this cost me?", "How can I save energy?"],
  },
  "/details": {
    key: "details",
    label: "Details",
    suggestions: ["When was usage highest?", "Compare my devices", "Anything unusual in this range?"],
  },
  "/setup": {
    key: "setup",
    label: "Setup",
    suggestions: ["How do I set up a current clamp?", "What should my price be?", "Why is my power negative?"],
  },
};

const route = useRoute();
const currentPage = computed(() => PAGES[route.path] ?? PAGES["/"]);

const isOpen = ref(false);
const isExpanded = ref(false);
const messages = ref([]); // { role, content, page }
const draft = ref("");
const isLoading = ref(false);
const error = ref("");
const failedText = ref("");
const messageList = ref(null);
const textarea = ref(null);

async function scrollToBottom() {
  await nextTick();
  const el = messageList.value;
  if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
}

function resizeTextarea() {
  const el = textarea.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
}
watch(draft, () => nextTick(resizeTextarea));

async function open() {
  isOpen.value = true;
  await nextTick();
  textarea.value?.focus();
  scrollToBottom();
}

function close() {
  isOpen.value = false;
}

function newChat() {
  messages.value = [];
  error.value = "";
  failedText.value = "";
  draft.value = "";
  textarea.value?.focus();
}

function ask(question) {
  draft.value = question;
  onSubmit();
}

function onKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    onSubmit();
  }
}

function retry() {
  draft.value = failedText.value;
  onSubmit();
}

async function onSubmit() {
  const text = draft.value.trim();
  if (!text || isLoading.value) return;

  const page = currentPage.value.key;
  messages.value.push({ role: "user", content: text, page });
  draft.value = "";
  error.value = "";
  failedText.value = "";
  isLoading.value = true;
  scrollToBottom();

  try {
    const reply = await sendChatMessage(
      messages.value.map(({ role, content }) => ({ role, content })),
      { page, context: getChatContext(page) },
    );
    messages.value.push({ role: "assistant", content: reply, page });
  } catch (err) {
    messages.value.pop();
    failedText.value = text;
    error.value = err.message;
  } finally {
    isLoading.value = false;
    scrollToBottom();
    textarea.value?.focus();
  }
}

// Show a divider when the conversation moves to a different page
function pageChangedAt(index) {
  if (index === 0) return false;
  return messages.value[index].page !== messages.value[index - 1].page;
}
const pageLabel = (key) => Object.values(PAGES).find((p) => p.key === key)?.label ?? key;
</script>

<template>
  <!-- Launcher -->
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 scale-90"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="opacity-0 scale-90"
  >
    <button
      v-if="!isOpen"
      type="button"
      class="fixed right-4 bottom-4 z-50 flex items-center gap-2 rounded-full bg-primary py-3 pl-3.5 pr-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-black/15 ring-1 ring-black/5 transition hover:brightness-95 hover:shadow-xl active:translate-y-px cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label="Open energy assistant"
      @click="open"
    >
      <SparklesIcon class="size-5" />
      <span class="hidden sm:inline">Ask the assistant</span>
    </button>
  </Transition>

  <!-- Panel -->
  <Transition
    enter-active-class="transition duration-200 ease-out origin-bottom-right"
    enter-from-class="opacity-0 translate-y-3 scale-[0.98]"
    leave-active-class="transition duration-150 ease-in origin-bottom-right"
    leave-to-class="opacity-0 translate-y-3 scale-[0.98]"
  >
    <section
      v-if="isOpen"
      role="dialog"
      aria-label="Energy assistant"
      :class="
        cn(
          'fixed z-50 flex flex-col overflow-hidden bg-card text-card-foreground',
          'inset-0 sm:inset-auto sm:right-4 sm:bottom-4 sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl sm:shadow-black/15',
          'transition-[width,height] duration-200',
          isExpanded
            ? 'sm:h-[calc(100dvh-2rem)] sm:w-[min(46rem,calc(100vw-2rem))]'
            : 'sm:h-[min(40rem,calc(100dvh-2rem))] sm:w-[26rem]',
        )
      "
      @keydown.esc="close"
    >
      <!-- Header -->
      <header class="flex items-center gap-3 border-b border-border px-4 py-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <SparklesIcon class="size-4.5" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="m-0 text-sm font-semibold leading-tight">Energy Assistant</h2>
          <p class="m-0 truncate text-xs text-muted-foreground">
            Looking at your {{ currentPage.label.toLowerCase() }} page
          </p>
        </div>
        <div class="flex items-center gap-0.5">
          <Button
            v-if="messages.length"
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            title="New conversation"
            :disabled="isLoading"
            @click="newChat"
          >
            <SquarePenIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            class="hidden sm:inline-flex"
            :aria-label="isExpanded ? 'Make smaller' : 'Make larger'"
            :title="isExpanded ? 'Make smaller' : 'Make larger'"
            @click="isExpanded = !isExpanded"
          >
            <component :is="isExpanded ? Minimize2Icon : Maximize2Icon" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close assistant" title="Close" @click="close">
            <XIcon />
          </Button>
        </div>
      </header>

      <!-- Messages -->
      <div ref="messageList" class="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        <div :class="cn('mx-auto flex flex-col gap-4', isExpanded && 'max-w-2xl')">
          <!-- Welcome -->
          <div v-if="messages.length === 0" class="flex flex-col gap-4 pt-6">
            <div class="flex flex-col items-center gap-2 text-center">
              <span class="flex size-12 items-center justify-center rounded-full bg-primary/20 text-primary-foreground dark:text-primary">
                <SparklesIcon class="size-6" />
              </span>
              <h3 class="m-0 text-base font-semibold">How can I help?</h3>
              <p class="m-0 max-w-xs text-sm text-muted-foreground">
                I can see what's on your {{ currentPage.label.toLowerCase() }} page and answer
                questions about your usage, costs and setup.
              </p>
            </div>
            <div class="flex flex-col gap-2">
              <button
                v-for="q in currentPage.suggestions"
                :key="q"
                type="button"
                class="rounded-xl border border-border bg-background px-3.5 py-2.5 text-left text-sm transition hover:border-primary/60 hover:bg-primary/5 cursor-pointer"
                @click="ask(q)"
              >
                {{ q }}
              </button>
            </div>
          </div>

          <template v-for="(message, index) in messages" :key="index">
            <div
              v-if="pageChangedAt(index)"
              class="flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              <span class="h-px flex-1 bg-border" />
              Now on {{ pageLabel(message.page) }}
              <span class="h-px flex-1 bg-border" />
            </div>

            <div
              v-if="message.role === 'user'"
              class="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground"
            >
              {{ message.content }}
            </div>

            <div v-else class="flex gap-2.5 self-start">
              <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-foreground dark:text-primary">
                <SparklesIcon class="size-3.5" />
              </span>
              <div class="min-w-0 rounded-2xl rounded-tl-md bg-muted px-3.5 py-2.5">
                <MarkdownContent :source="message.content" />
              </div>
            </div>
          </template>

          <!-- Typing -->
          <div v-if="isLoading" class="flex gap-2.5 self-start" aria-label="Assistant is typing">
            <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary-foreground dark:text-primary">
              <SparklesIcon class="size-3.5" />
            </span>
            <div class="flex items-center gap-1 rounded-2xl rounded-tl-md bg-muted px-3.5 py-3">
              <span class="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.3s]" />
              <span class="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce [animation-delay:-0.15s]" />
              <span class="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce" />
            </div>
          </div>

          <div
            v-if="error"
            class="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            <span>{{ error }}</span>
            <Button variant="ghost" size="xs" class="text-destructive" @click="retry">Retry</Button>
          </div>
        </div>
      </div>

      <!-- Composer -->
      <footer class="border-t border-border px-3 pt-3 pb-2">
        <form
          :class="
            cn(
              'mx-auto flex items-end gap-2 rounded-xl border border-input bg-background py-1.5 pr-1.5 pl-3 transition focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30',
              isExpanded && 'max-w-2xl',
            )
          "
          @submit.prevent="onSubmit"
        >
          <textarea
            ref="textarea"
            v-model="draft"
            rows="1"
            placeholder="Ask about your energy use…"
            aria-label="Message"
            class="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
            @keydown="onKeydown"
          />
          <Button
            type="submit"
            size="icon"
            class="shrink-0 rounded-lg"
            aria-label="Send message"
            :disabled="isLoading || !draft.trim()"
          >
            <ArrowUpIcon />
          </Button>
        </form>
        <p class="m-0 mt-1.5 text-center text-[11px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </footer>
    </section>
  </Transition>
</template>
