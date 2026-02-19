<script setup lang="ts">
import { onMounted } from "vue";

import { usePollsStore } from "@/stores/polls";
import PollCard from "./PollCard.vue";
import BaseModal from "@/components/ui/BaseModal.vue";
import BaseButton from "@/components/ui/BaseButton.vue";

const polls = usePollsStore();

onMounted(() => {
  polls.hydrate();
  polls.ensureTickerStarted();
});
</script>

<template>
  <section class="stack" aria-label="Poll list">
    <div
      v-if="polls.filteredSortedPolls.length === 0"
      class="card"
      style="padding: 16px"
    >
      <h2 style="margin: 0 0 8px; font-size: 18px">No polls found</h2>
      <p class="muted" style="margin: 0">
        Try adjusting filters, or create your first poll.
      </p>
    </div>

    <div v-else class="list">
      <PollCard
        v-for="p in polls.filteredSortedPolls"
        :key="p.id"
        :poll-id="p.id"
      />
    </div>

    <BaseModal v-model:open="polls.confirmDelete.open" title="Delete poll">
      <p style="margin-top: 0">This action cannot be undone.</p>
      <div class="row" style="justify-content: flex-end">
        <BaseButton variant="ghost" @click="polls.cancelDelete"
          >Cancel</BaseButton
        >
        <BaseButton variant="danger" @click="polls.commitDelete"
          >Delete</BaseButton
        >
      </div>
    </BaseModal>
  </section>
</template>

<style scoped>
.list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 760px) {
  .list {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
