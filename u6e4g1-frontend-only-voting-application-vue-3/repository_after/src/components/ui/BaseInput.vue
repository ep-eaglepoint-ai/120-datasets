<script setup lang="ts">
type Props = {
  id?: string;
  modelValue: string;
  label?: string;
  placeholder?: string;
  error?: string;
  type?: string;
  autocomplete?: string;
};

withDefaults(defineProps<Props>(), {
  type: "text",
  placeholder: "",
  label: undefined,
  error: undefined,
  id: undefined,
  autocomplete: undefined,
});

defineEmits<{ "update:modelValue": [value: string] }>();
</script>

<template>
  <label class="field">
    <span v-if="label" class="label">{{ label }}</span>
    <input
      :id="id"
      class="input"
      :class="{ invalid: !!error }"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${id}-error` : undefined"
      @input="
        $emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
    />
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
