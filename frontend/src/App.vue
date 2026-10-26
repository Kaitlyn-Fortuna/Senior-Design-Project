<script setup>

import {watch} from "vue";
import { useRoute } from "vue-router";
import { getToken } from "./services/auth";
import { connectSocket } from "./services/socket";

const route = useRoute();

watch(
  () => route.meta.requiresAuth,
  (requiresAuth) => {
    if (requiresAuth && getToken())
    {
      connectSocket();
    }
  },
  {immediate: true},
)
</script>


<template>
  <router-view />
</template>
