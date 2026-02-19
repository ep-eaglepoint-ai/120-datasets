<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";

import { useUiStore } from "@/stores/ui";
import BaseButton from "@/components/ui/BaseButton.vue";

const ui = useUiStore();

onMounted(() => {
  ui.hydrateTheme();
});
</script>

<template>
  <div>
    <header class="app-header">
      <div class="container header-inner">
        <RouterLink to="/" class="brand" aria-label="Go to home">
          Voting App
        </RouterLink>

        <div
          class="row wrap"
          style="justify-content: flex-end; align-items: center"
        >
          <BaseButton
            variant="ghost"
            :aria-pressed="ui.theme === 'dark'"
            @click="ui.toggleTheme"
          >
            {{ ui.theme === "dark" ? "Dark" : "Light" }} mode
          </BaseButton>
        </div>
      </div>
    </header>

    <main class="container">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: color-mix(in oklab, var(--bg), transparent 0%);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(8px);
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.brand {
  font-weight: 700;
  text-decoration: none;
  padding: 10px 0;
}
</style>
