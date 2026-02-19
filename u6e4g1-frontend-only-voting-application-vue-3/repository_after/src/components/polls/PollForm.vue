<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { usePollsStore } from "@/stores/polls";
import type { PollVotingMode } from "@/types/poll";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseInput from "@/components/ui/BaseInput.vue";
import BaseTextarea from "@/components/ui/BaseTextarea.vue";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import OptionEditor from "./OptionEditor.vue";
import {
  validatePollDraft,
  type PollDraft,
  normalizeTags,
  ValidationError,
} from "@/utils/validation";
import { fromInputDateTimeValue, toInputDateTimeValue } from "@/utils/time";

type Props =
  | { mode: "create"; pollId?: never }
  | { mode: "edit"; pollId: string };

const props = defineProps<Props>();
const emit = defineEmits<{ cancel: []; saved: [pollId: string] }>();

const router = useRouter();
const polls = usePollsStore();

const existing = computed(() =>
  props.mode === "edit" ? polls.getById(props.pollId) : undefined
);

const draft = reactive<PollDraft>({
  title: existing.value?.title ?? "",
  description: existing.value?.description ?? "",
  tags: (existing.value?.tags ?? []).join(", "),
  votingMode: (existing.value?.votingMode ?? "single") as PollVotingMode,
  isAnonymous: existing.value?.isAnonymous ?? true,
  startAt: existing.value?.startAt,
  endAt: existing.value?.endAt,
  options: existing.value?.options.map((o) => o.text) ?? ["", ""],
});

const errors = ref<ValidationError[]>([]);

const fieldError = computed(() => {
  const map: Record<string, string> = {};
  for (const e of errors.value) map[e.field] = e.message;
  return map;
});

const startValue = computed(() => toInputDateTimeValue(draft.startAt));
const endValue = computed(() => toInputDateTimeValue(draft.endAt));

function onStartChange(v: string) {
  draft.startAt = fromInputDateTimeValue(v);
}

function onEndChange(v: string) {
  draft.endAt = fromInputDateTimeValue(v);
}

const votingModeOptions = [
  { value: "single", label: "Single choice" },
  { value: "multi", label: "Multiple choice" },
];

function toggleAnonymous() {
  draft.isAnonymous = !draft.isAnonymous;
}

function save() {
  errors.value = validatePollDraft(draft);
  if (errors.value.length) return;

  // normalize tags once to keep consistent
  const tags = normalizeTags(draft.tags);
  draft.tags = tags.join(", ");

  let id: string;
  if (props.mode === "create") {
    id = polls.createPoll(draft);
  } else {
    polls.updatePoll(props.pollId, draft);
    id = props.pollId;
  }

  emit("saved", id);

  // if used in a modal, navigating is optional; we do it only on create
  if (props.mode === "create") {
    router.push(`/poll/${id}`);
  }
}
</script>

<template>
  <form class="stack" @submit.prevent="save" aria-label="Poll form">
    <BaseInput
      id="poll-title"
      v-model="draft.title"
      label="Title"
      :error="fieldError.title"
    />

    <BaseTextarea
      id="poll-desc"
      v-model="draft.description"
      label="Description (optional)"
      placeholder="Add context or instructions"
      :error="fieldError.description"
      :rows="4"
    />

    <BaseInput
      id="poll-tags"
      v-model="draft.tags"
      label="Tags (comma-separated)"
      placeholder="e.g. product, team, weekend"
    />

    <div class="row wrap">
      <div style="min-width: 200px">
        <BaseSelect
          id="poll-mode"
          v-model="draft.votingMode"
          label="Voting"
          :options="votingModeOptions"
          :error="fieldError.votingMode"
        />
      </div>

      <div class="card" style="padding: 12px; flex: 1">
        <div
          class="row"
          style="justify-content: space-between; align-items: center"
        >
          <div>
            <div style="font-weight: 600">
              {{ draft.isAnonymous ? "Anonymous voting" : "Named voting" }}
            </div>
            <div class="muted" style="font-size: 13px">
              {{
                draft.isAnonymous
                  ? "Voter names are not collected."
                  : "Voters must enter a name (stored locally)."
              }}
            </div>
          </div>
          <BaseButton variant="ghost" type="button" @click="toggleAnonymous"
            >Toggle</BaseButton
          >
        </div>
      </div>
    </div>

    <div class="row wrap">
      <BaseInput
        id="poll-start"
        label="Start time (optional)"
        type="datetime-local"
        :model-value="startValue"
        @update:model-value="onStartChange"
      />
      <BaseInput
        id="poll-end"
        label="End time (optional)"
        type="datetime-local"
        :model-value="endValue"
        :error="fieldError.endAt"
        @update:model-value="onEndChange"
      />
    </div>

    <OptionEditor v-model="draft.options" :error="fieldError.options" />

    <div class="row" style="justify-content: flex-end">
      <BaseButton variant="ghost" type="button" @click="$emit('cancel')"
        >Cancel</BaseButton
      >
      <BaseButton type="submit">Save</BaseButton>
    </div>

    <div
      v-if="errors.length"
      class="card"
      style="
        padding: 12px;
        border-color: color-mix(in oklab, var(--danger), white 30%);
      "
    >
      <strong>Fix the following:</strong>
      <ul style="margin: 8px 0 0">
        <li v-for="(e, idx) in errors" :key="idx">{{ e.message }}</li>
      </ul>
    </div>
  </form>
</template>
