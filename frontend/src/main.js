import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { completeOAuthLogin } from './services/auth.js';
import { syncPortNamesFromServer } from './services/deviceConfig.js';
import './style.css';

completeOAuthLogin().finally(async () => {
  // Port display names live in device-configuration.json; refresh the local cache
  await syncPortNamesFromServer();
  createApp(App).use(router).mount('#app');
});