<script setup lang="ts">
import { computed, watch } from "vue";

import BaseButton from "./BaseButton.vue";
import { useFocusTrap } from "@/composables/useFocusTrap";

type Props = {
  open: boolean;
  title: string;
};

const props = defineProps<Props>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();

const isOpen = computed(() => props.open);
const { containerRef, activate, deactivate } = useFocusTrap(isOpen);

function close() {
  emit("update:open", false);
}

function onKeydown(e: KeyboardEvent) {
  if (!props.open) return;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      activate();
      window.addEventListener("keydown", onKeydown);
    } else {
      window.removeEventListener("keydown", onKeydown);
      deactivate();
    }
  },
  { immediate: true }
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @mousedown.self="close">
      <div
        ref="containerRef"
        class="dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
      >
        <div class="header">
          <h2 style="margin: 0; font-size: 18px">{{ title }}</h2>
          <BaseButton variant="ghost" aria-label="Close" @click="close"
            >Close</BaseButton
          >
        </div>
        <div class="body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
}

.dialog {
  width: min(720px, 100%);
  max-height: min(85vh, 900px);
  overflow: auto;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
  animation: pop 120ms ease;
}

@keyframes pop {
  from {
    transform: translateY(6px);
    opacity: 0.8;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 14px 8px;
  border-bottom: 1px solid var(--border);
}

.body {
  padding: 14px;
}
</style>
