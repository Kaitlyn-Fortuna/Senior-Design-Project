<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { login } from "../services/auth";

const router = useRouter();
const username = ref("demo");
const password = ref("demo123");
const error = ref("");
const loading = ref(false);

async function onSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await login(username.value, password.value);
    router.push("/");
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen grid place-items-center p-6">
    <form
      class="w-full max-w-95 bg-card border border-border rounded-2xl p-7 flex flex-col gap-3.5 shadow-xl"
      @submit.prevent="onSubmit"
    >
      <h1 class="text-2xl font-bold text-text m-0">Energy Monitor</h1>
      <p class="text-sm text-muted m-0">Sign in to view live meter data</p>

      <label class="flex flex-col gap-1.5 text-sm text-muted">
        Username
        <input
          v-model="username"
          type="text"
          autocomplete="username"
          required
          class="bg-bg text-text border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition duration-150"
        />
      </label>

      <label class="flex flex-col gap-1.5 text-sm text-muted">
        Password
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="bg-bg text-text border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition duration-150"
        />
      </label>

      <p v-if="error" class="text-sm text-danger m-0">{{ error }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="bg-accent text-[#062014] border-0 rounded-lg p-2.5 font-semibold cursor-pointer hover:brightness-110 disabled:opacity-70 disabled:cursor-not-allowed transition duration-150"
      >
        {{ loading ? "Signing in…" : "Sign in" }}
      </button>

      <p class="text-sm text-muted m-0">
        Demo account: <code class="text-accent font-mono">demo</code> /
        <code class="text-accent font-mono">demo123</code>
      </p>
    </form>
  </main>
</template>
