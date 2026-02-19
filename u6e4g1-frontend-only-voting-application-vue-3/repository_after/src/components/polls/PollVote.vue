<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";

import { usePollsStore } from "@/stores/polls";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseInput from "@/components/ui/BaseInput.vue";

type Props = {
  pollId: string;
};

const props = defineProps<Props>();
const polls = usePollsStore();

const poll = computed(() => polls.getById(props.pollId));
const can = computed(() => polls.canVote(props.pollId));
const alreadyVoted = computed(() => polls.hasVotedThisSession(props.pollId));

const voterName = ref("");
const selected = ref<string[]>([]);
const submitErrors = ref<string[]>([]);

watchEffect(() => {
  // keep selection sane when switching mode
  if (!poll.value) return;
  if (poll.value.votingMode === "single" && selected.value.length > 1) {
    selected.value = selected.value.slice(0, 1);
  }
});

function toggleOption(optionId: string) {
  if (!poll.value) return;

  if (poll.value.votingMode === "single") {
    selected.value = [optionId];
    return;
  }

  const set = new Set(selected.value);
  if (set.has(optionId)) set.delete(optionId);
  else set.add(optionId);
  selected.value = Array.from(set);
}

function submit() {
  submitErrors.value = [];
  if (!poll.value) return;

  const result = polls.castVote(props.pollId, selected.value, voterName.value);
  if (!result.ok) {
    submitErrors.value = result.errors ?? ["Could not submit vote."];
    return;
  }
}
</script>

<template>
  <div v-if="!poll" class="muted">Poll not found.</div>

  <div v-else class="stack">
    <div v-if="alreadyVoted" class="card" style="padding: 12px">
      <strong>Thanks!</strong>
      <p class="muted" style="margin: 6px 0 0">
        You already voted in this browser session.
      </p>
    </div>

    <div v-else-if="!can.ok" class="card" style="padding: 12px">
      <strong>Voting unavailable</strong>
      <p class="muted" style="margin: 6px 0 0">{{ can.reason }}</p>
    </div>

    <form v-else class="stack" @submit.prevent="submit" aria-label="Vote form">
      <div v-if="!poll.isAnonymous">
        <BaseInput
          id="voter-name"
          v-model="voterName"
          label="Your name"
          placeholder="Enter your name"
          autocomplete="name"
        />
      </div>

      <fieldset
        class="stack"
        style="border: 0; padding: 0; margin: 0"
        :aria-label="
          poll.votingMode === 'single'
            ? 'Single choice options'
            : 'Multiple choice options'
        "
      >
        <legend class="visually-hidden">Options</legend>

        <label v-for="o in poll.options" :key="o.id" class="option">
          <input
            :type="poll.votingMode === 'single' ? 'radio' : 'checkbox'"
            name="vote"
            :checked="selected.includes(o.id)"
            @change="toggleOption(o.id)"
          />
          <span>{{ o.text }}</span>
        </label>
      </fieldset>

      <div
        v-if="submitErrors.length"
        class="card"
        style="
          padding: 12px;
          border-color: color-mix(in oklab, var(--danger), white 30%);
        "
        role="alert"
      >
        <strong>Could not vote</strong>
        <ul style="margin: 8px 0 0">
          <li v-for="(e, idx) in submitErrors" :key="idx">{{ e }}</li>
        </ul>
      </div>

      <div class="row" style="justify-content: flex-end">
        <BaseButton type="submit">Submit vote</BaseButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.option {
  display: flex;
  gap: 10px;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  cursor: pointer;
  background: color-mix(in oklab, var(--card), var(--bg) 35%);
  transition: transform 120ms ease, border-color 120ms ease;
}

.option:hover {
  transform: translateY(-1px);
}

.option:has(input:focus-visible) {
  outline: 2px solid color-mix(in oklab, var(--accent), white 20%);
  outline-offset: 2px;
}

input {
  accent-color: var(--accent);
}
</style>
