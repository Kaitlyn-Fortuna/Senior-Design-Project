<script setup>
import { nextTick, ref } from "vue";
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

async function onSubmit() {
  const text = draft.value.trim();
  if (!text || isLoading.value) return;

  messages.value.push({ role: "user", content: text });
  draft.value = "";
  error.value = "";
  isLoading.value = true;
  scrollToBottom();

  try {
    const reply = await sendChatMessage(messages.value);
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
        <CardTitle>Energy Assistant</CardTitle>
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
          <p v-if="messages.length === 0" class="text-muted-foreground text-sm">
            Ask me about your energy usage.
          </p>

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
