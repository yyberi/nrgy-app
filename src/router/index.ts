import { createRouter, createWebHistory } from 'vue-router'

// Minimal route definition to avoid initial warning. App.vue does not yet use <router-view>,
// but adding a root route prevents the "No match found for location with path '/'" message.
// When real navigation is needed, replace this placeholder with actual route components
// and add a <router-view /> in App.vue.
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'root', component: { template: '<div />' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: { template: '<div />' } }
  ],
})

export default router
