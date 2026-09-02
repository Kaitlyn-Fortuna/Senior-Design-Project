<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getUser, logout } from '../services/auth';

const MAX_POINTS = 60;
const router = useRouter();
const user = getUser();

function onLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <div class="page">
    <header>
      <div>
        <h1>Energy Monitor</h1>
        <p class="status">
          <span v-if="user"> · {{ user.username }}</span>
        </p>
      </div>
      <button type="button" class="ghost" @click="onLogout">Log out</button>
    </header>

  </div>
</template>

<style scoped>
.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 20px 48px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

h1 {
  margin: 0;
  font-size: 1.4rem;
}

.status {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
}

.dot.on {
  background: var(--accent);
}

.ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
}

.label {
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.value {
  margin: 4px 0 0;
  font-size: 2.4rem;
  font-weight: 700;
}

.value span {
  font-size: 1rem;
  color: var(--muted);
  font-weight: 500;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 18px;
}

h2 {
  margin: 0 0 12px;
  font-size: 1rem;
  font-weight: 600;
}
</style>
