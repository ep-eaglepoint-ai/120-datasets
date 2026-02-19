<script setup lang="ts">
import { computed } from "vue";

type Props = {
  value: number; // 0..1
};

const props = defineProps<Props>();

const pct = computed(() => {
  const v = Number.isFinite(props.value) ? props.value : 0;
  return `${Math.max(0, Math.min(1, v)) * 100}%`;
});
</script>

<template>
  <div
    class="track"
    role="progressbar"
    :aria-valuemin="0"
    :aria-valuemax="100"
    :aria-valuenow="Math.round((value || 0) * 100)"
  >
    <div class="bar" :style="{ width: pct }" />
  </div>
</template>

<style scoped>
.track {
  height: 10px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--border), transparent 15%);
  overflow: hidden;
}

.bar {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 220ms ease;
}
</style>
