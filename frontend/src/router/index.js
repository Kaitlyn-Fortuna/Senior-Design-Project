import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import DetailView from '../views/DetailView.vue';
import { getToken } from '../services/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView },
    { path: '/', component: DashboardView, meta: { requiresAuth: true } },
    { path: '/details', component: DetailView, meta: { requiresAuth: true } },
  ],
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getToken()) {
    return '/login';
  }
  if (to.path === '/login' && getToken()) {
    return '/';
  }
});

export default router;
