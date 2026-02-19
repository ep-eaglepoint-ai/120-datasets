<script setup lang="ts">
import { computed } from "vue";

type Props = {
  label: string;
  selected?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  selected: false,
});

const cls = computed(() => ({
  chip: true,
  selected: props.selected,
}));
</script>

<template>
  <button type="button" :class="cls">
    <span>#{{ label }}</span>
  </button>
</template>

<style scoped>
.chip {
  border-radius: 999px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  padding: 6px 10px;
  cursor: pointer;
  transition: transform 120ms ease, border-color 120ms ease;
}

.chip:active {
  transform: scale(0.98);
}

.chip:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent), white 20%);
  outline-offset: 2px;
}

.selected {
  border-color: var(--accent);
}
</style>
