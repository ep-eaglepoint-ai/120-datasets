<script setup lang="ts">
import { computed } from "vue";

type Variant = "primary" | "ghost" | "danger";

type Props = {
  variant?: Variant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

const props = withDefaults(defineProps<Props>(), {
  variant: "primary",
  type: "button",
  disabled: false,
});

const classes = computed(() => {
  if (props.variant === "danger") return "btn danger";
  if (props.variant === "ghost") return "btn ghost";
  return "btn primary";
});
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 10px 12px;
  cursor: pointer;
  transition: transform 120ms ease, background-color 120ms ease,
    border-color 120ms ease;
  user-select: none;
}

.btn:active {
  transform: scale(0.98);
}

.btn:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent), white 20%);
  outline-offset: 2px;
}

.primary {
  background: var(--accent);
  border-color: color-mix(in oklab, var(--accent), black 10%);
  color: white;
}

.ghost {
  background: transparent;
}

.danger {
  background: var(--danger);
  border-color: color-mix(in oklab, var(--danger), black 10%);
  color: white;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
