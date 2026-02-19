import { createRouter, createWebHistory } from "vue-router";

import HomeView from "@/views/HomeView.vue";
import PollDetailView from "@/views/PollDetailView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomeView },
    { path: "/poll/:id", name: "poll", component: PollDetailView, props: true },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
