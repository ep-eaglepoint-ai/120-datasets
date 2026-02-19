<script setup lang="ts">
type Option = { value: string; label: string };

type Props = {
  id?: string;
  modelValue: string;
  label?: string;
  error?: string;
  options: Option[];
};

withDefaults(defineProps<Props>(), {
  id: undefined,
  label: undefined,
  error: undefined,
});

defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <label class="field">
    <span v-if="label" class="label">{{ label }}</span>
    <select
      :id="id"
      class="input"
      :class="{ invalid: !!error }"
      :value="modelValue"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${id}-error` : undefined"
      @change="
        $emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option v-for="o in options" :key="o.value" :value="o.value">
        {{ o.label }}
      </option>
    </select>
    <span v-if="error" :id="`${id}-error`" class="error" role="alert">{{
      error
    }}</span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 13px;
  color: var(--muted);
}

.input {
  border-radius: 10px;
  border: 1px solid var(--border);
  padding: 10px 12px;
  background: var(--bg);
  color: var(--fg);
}

.input:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent), white 20%);
  outline-offset: 2px;
}

.invalid {
  border-color: color-mix(in oklab, var(--danger), white 10%);
}

.error {
  font-size: 12px;
  color: var(--danger);
}
</style>
