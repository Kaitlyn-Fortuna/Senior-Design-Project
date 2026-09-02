<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { login } from '../services/auth';

const router = useRouter();
const username = ref('demo');
const password = ref('demo123');
const error = ref('');
const loading = ref(false);

async function onSubmit() {
  error.value = '';
  loading.value = true;
  try {
    await login(username.value, password.value);
    router.push('/');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="login-page">
    <form class="card" @submit.prevent="onSubmit"> 
      <h1>Energy Monitor</h1>
      <p class="hint">Sign in to view live meter data</p>

      <label>
        Username
        <input v-model="username" type="text" autocomplete="username" required />
      </label>

      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="loading">
        {{ loading ? 'Signing in…' : 'Sign in' }}
      </button>

      <p class="demo">Demo account: <code>demo</code> / <code>demo123</code></p>
    </form>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.card {
  width: min(100%, 380px);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

h1 {
  margin: 0;
  font-size: 1.5rem;
}

.hint,
.demo {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
}

input {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
}

button {
  background: var(--accent);
  color: #062014;
  border: 0;
  border-radius: 8px;
  padding: 11px;
  font-weight: 600;
}

button:disabled {
  opacity: 0.7;
}

.error {
  margin: 0;
  color: var(--danger);
  font-size: 0.9rem;
}

code {
  color: var(--accent);
}
</style>
