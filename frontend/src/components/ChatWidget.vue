<script setup>
import { computed, nextTick, ref } from "vue";
import { useRoute } from "vue-router";
import { MessageCircleIcon, SendIcon, XIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sendChatMessage } from "@/services/chatbot";
import { getChatContext } from "@/services/chatContext";
import { Badge } from "@/components/ui/badge";

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
    suggestions: ["Summarise this date range", "When was usage highest?", "Compare my devices"],
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
const messages = ref([]);
const draft = ref("");
const isLoading = ref(false);
const error = ref("");
const messageList = ref(null);

async function scrollToBottom() {
  await nextTick();
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight;
  }
}

function ask(question) {
  draft.value = question;
  onSubmit();
}

async function onSubmit() {
  const text = draft.value.trim();
  if (!text || isLoading.value) return;

  messages.value.push({ role: "user", content: text });
  draft.value = "";
  error.value = "";
  isLoading.value = true;
  scrollToBottom();

  try {
    const page = currentPage.value.key;
    const reply = await sendChatMessage(messages.value, {
      page,
      context: getChatContext(page),
    });
    messages.value.push({ role: "assistant", content: reply });
  } catch (err) {
    messages.value.pop();
    draft.value = text;
    error.value = err.message;
  } finally {
    isLoading.value = false;
    scrollToBottom();
  }
}
</script>

<template>
  <div class="fixed right-4 bottom-4 z-50">
    <Card v-if="isOpen" class="flex h-[28rem] w-80 flex-col sm:w-96">
      <CardHeader>
        <CardTitle class="flex items-center gap-2">
          Energy Assistant
          <Badge variant="secondary" class="font-normal">{{ currentPage.label }}</Badge>
        </CardTitle>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close chat"
            @click="isOpen = false"
          >
            <XIcon />
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent ref="messageListWrapper" class="min-h-0 flex-1">
        <div
          ref="messageList"
          class="flex h-full flex-col gap-2 overflow-y-auto"
          aria-live="polite"
        >
          <div v-if="messages.length === 0" class="flex flex-col gap-2">
            <p class="text-muted-foreground text-sm m-0">
              I can see a summary of the {{ currentPage.label.toLowerCase() }} page. Try:
            </p>
            <button
              v-for="q in currentPage.suggestions"
              :key="q"
              type="button"
              class="self-start rounded-lg border border-border px-3 py-1.5 text-left text-sm hover:bg-muted cursor-pointer"
              @click="ask(q)"
            >
              {{ q }}
            </button>
          </div>

          <div
            v-for="(message, index) in messages"
            :key="index"
            class="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
            :class="
              message.role === 'user'
                ? 'bg-primary text-primary-foreground self-end'
                : 'bg-muted self-start'
            "
          >
            {{ message.content }}
          </div>

          <p v-if="isLoading" class="text-muted-foreground text-sm">Thinking...</p>
          <p v-if="error" class="text-destructive text-sm">{{ error }}</p>
        </div>
      </CardContent>

      <CardFooter>
        <form class="flex w-full gap-2" @submit.prevent="onSubmit">
          <Input v-model="draft" placeholder="Type a message" aria-label="Message" />
          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            :disabled="isLoading || !draft.trim()"
          >
            <SendIcon />
          </Button>
        </form>
      </CardFooter>
    </Card>

    <Button v-else size="icon-lg" aria-label="Open chat" @click="isOpen = true">
      <MessageCircleIcon />
    </Button>
  </div>
</template>
