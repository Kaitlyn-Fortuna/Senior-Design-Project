<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getUser, logout } from "../services/auth";

const MAX_POINTS = 60;
const router = useRouter();
const user = getUser();

function onLogout() {
  logout();
  router.push("/login");
}
</script>

<template>
  <div class="max-w-275 mx-auto px-5 pt-7 pb-12">
    <header class="flex justify-between items-center gap-4 mb-6">
      <div>
        <h1 class="text-2xl font-bold text-text m-0">Energy Monitor</h1>
        <p class="mt-1.5 text-sm text-muted flex items-center gap-2 m-0">
          <span v-if="user"> · {{ user.username }}</span>
        </p>
      </div>
      <button
        type="button"
        class="bg-transparent text-text border border-border rounded-lg px-3 py-2 text-sm font-medium hover:bg-card hover:border-muted/50 transition duration-150 cursor-pointer"
        @click="onLogout"
      >
        Log out
      </button>
    </header>
  </div>
</template>
