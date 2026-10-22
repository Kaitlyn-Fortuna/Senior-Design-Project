import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { completeOAuthLogin } from './services/auth.js';
import './style.css';

completeOAuthLogin().finally(() => {
  createApp(App).use(router).mount('#app');
});