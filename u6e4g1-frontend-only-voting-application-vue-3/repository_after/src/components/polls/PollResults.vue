<script setup lang="ts">
import { computed, onMounted } from "vue";

import { usePollsStore } from "@/stores/polls";
import ProgressBar from "@/components/ui/ProgressBar.vue";

type Props = {
  pollId: string;
};

const props = defineProps<Props>();
const polls = usePollsStore();

onMounted(() => {
  polls.hydrate();
  polls.ensureTickerStarted();
});

const poll = computed(() => polls.getById(props.pollId));
const status = computed(() => polls.getStatus(props.pollId));
const results = computed(() => polls.getResults(props.pollId));
</script>

<template>
  <div v-if="!poll" class="muted">Poll not found.</div>

  <div v-else class="stack">
    <div
      class="row wrap"
      style="justify-content: space-between; align-items: center"
    >
      <div class="muted">
        Total: <strong>{{ results.total }}</strong>
      </div>
      <div class="muted" style="font-size: 13px">
        Results are {{ status === "active" ? "live" : "locked" }}.
      </div>
    </div>

    <div v-if="results.items.length === 0" class="muted">
      No options to display.
    </div>

    <div v-else class="stack" aria-label="Results list">
      <div v-for="item in results.items" :key="item.optionId" class="result">
        <div
          class="row wrap"
          style="justify-content: space-between; align-items: baseline"
        >
          <strong>{{ item.label }}</strong>
          <span class="muted" style="font-size: 13px">
            {{ item.count }} ({{ Math.round(item.pct * 100) }}%)
          </span>
        </div>
        <ProgressBar :value="item.pct" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.result {
  padding: 10px 0;
}
</style>
