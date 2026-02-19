<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import { usePollsStore } from "@/stores/polls";
import BaseButton from "@/components/ui/BaseButton.vue";
import { formatDateTime } from "@/utils/time";

type Props = {
  pollId: string;
};

const props = defineProps<Props>();
const polls = usePollsStore();

const poll = computed(() => polls.getById(props.pollId));
const status = computed(() => polls.getStatus(props.pollId));
const results = computed(() => polls.getResults(props.pollId));
</script>

<template>
  <article
    v-if="poll"
    class="card item"
    :data-status="status"
    aria-label="Poll"
  >
    <div
      class="row wrap"
      style="justify-content: space-between; align-items: start"
    >
      <div style="min-width: 220px">
        <RouterLink :to="`/poll/${poll.id}`" class="title">{{
          poll.title
        }}</RouterLink>
        <div class="row wrap" style="margin-top: 6px; align-items: center">
          <span class="badge" :data-status="status">{{
            polls.getStatusLabel(poll.id)
          }}</span>
          <span class="muted" style="font-size: 13px">
            {{ results.total }} vote{{ results.total === 1 ? "" : "s" }}
          </span>
        </div>
        <p v-if="poll.description" class="muted" style="margin: 8px 0 0">
          {{ poll.description }}
        </p>
        <p class="muted" style="margin: 8px 0 0; font-size: 13px">
          Starts: {{ formatDateTime(poll.startAt) }} · Ends:
          {{ formatDateTime(poll.endAt) }}
        </p>
        <div v-if="poll.tags.length" class="row wrap" style="margin-top: 8px">
          <span v-for="t in poll.tags" :key="t" class="tag">#{{ t }}</span>
        </div>
      </div>

      <div class="row wrap" style="justify-content: flex-end">
        <BaseButton variant="ghost" @click="polls.duplicatePoll(poll.id)"
          >Duplicate</BaseButton
        >
        <BaseButton variant="danger" @click="polls.requestDelete(poll.id)"
          >Delete</BaseButton
        >
      </div>
    </div>
  </article>
</template>

<style scoped>
.item {
  padding: 14px;
  transition: transform 120ms ease;
}

.item:hover {
  transform: translateY(-1px);
}

.title {
  font-weight: 700;
  text-decoration: none;
}

.title:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--accent), white 20%);
  outline-offset: 4px;
  border-radius: 8px;
}

.badge {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
}

.badge[data-status="active"] {
  border-color: color-mix(in oklab, var(--success), white 40%);
}

.badge[data-status="closed"] {
  border-color: color-mix(in oklab, var(--muted), white 40%);
}

.badge[data-status="expired"] {
  border-color: color-mix(in oklab, var(--danger), white 40%);
}

.tag {
  font-size: 12px;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 8px;
}
</style>
