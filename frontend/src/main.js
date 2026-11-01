import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { completeOAuthLogin, getToken } from './services/auth.js';
import { refreshPortNamesFromServer } from './services/portConfig.js';
import './style.css';

completeOAuthLogin()
  .then(() => (getToken() ? refreshPortNamesFromServer() : null))
  .finally(() => {
    createApp(App).use(router).mount('#app');
  });