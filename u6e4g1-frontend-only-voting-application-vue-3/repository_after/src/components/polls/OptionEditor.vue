<script setup lang="ts">
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseInput from "@/components/ui/BaseInput.vue";

type Props = {
  modelValue: string[];
  error?: string;
};

const props = withDefaults(defineProps<Props>(), {
  error: undefined,
});
const emit = defineEmits<{ "update:modelValue": [value: string[]] }>();

function updateAt(index: number, value: string) {
  const next = [...props.modelValue];
  next[index] = value;
  emit("update:modelValue", next);
}

function add() {
  emit("update:modelValue", [...props.modelValue, ""]);
}

function removeAt(index: number) {
  const next = props.modelValue.filter((_, i) => i !== index);
  emit("update:modelValue", next);
}
</script>

<template>
  <div class="stack" aria-label="Options editor">
    <div
      class="row wrap"
      style="justify-content: space-between; align-items: center"
    >
      <div>
        <div class="muted" style="font-size: 13px">Options</div>
        <div v-if="error" class="error" role="alert">{{ error }}</div>
      </div>
      <BaseButton variant="ghost" @click="add">Add option</BaseButton>
    </div>

    <div
      v-for="(opt, idx) in modelValue"
      :key="idx"
      class="row"
      style="align-items: end"
    >
      <div style="flex: 1">
        <BaseInput
          :id="`opt-${idx}`"
          :label="`Option ${idx + 1}`"
          :model-value="opt"
          placeholder="Option text"
          @update:model-value="(v) => updateAt(idx, v)"
        />
      </div>
      <BaseButton
        variant="ghost"
        :disabled="modelValue.length <= 2"
        @click="removeAt(idx)"
      >
        Remove
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.error {
  font-size: 12px;
  color: var(--danger);
}
</style>
