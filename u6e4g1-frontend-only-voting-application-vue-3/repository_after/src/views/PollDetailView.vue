<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";

import { usePollsStore } from "@/stores/polls";
import PollVote from "@/components/polls/PollVote.vue";
import PollResults from "@/components/polls/PollResults.vue";
import PollForm from "@/components/polls/PollForm.vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";

const route = useRoute();
const router = useRouter();
const polls = usePollsStore();

const pollId = computed(() => String(route.params.id));

const poll = computed(() => polls.getById(pollId.value));

const showEdit = ref(false);
const showClose = ref(false);

watchEffect(() => {
  if (!poll.value) {
    // small guard: route may be stale
  }
});

function goHome() {
  router.push("/");
}
</script>

<template>
  <div v-if="!poll" class="card" style="padding: 16px">
    <h1 style="margin: 0 0 8px">Poll not found</h1>
    <p class="muted" style="margin: 0 0 12px">It may have been deleted.</p>
    <BaseButton @click="goHome">Back to polls</BaseButton>
  </div>

  <div v-else class="stack">
    <div
      class="row wrap"
      style="justify-content: space-between; align-items: start"
    >
      <div>
        <h1 style="margin: 0">{{ poll.title }}</h1>
        <p v-if="poll.description" class="muted" style="margin: 6px 0 0">
          {{ poll.description }}
        </p>
        <p class="muted" style="margin: 6px 0 0">
          Status: <strong>{{ polls.getStatusLabel(poll.id) }}</strong>
        </p>
      </div>

      <div class="row wrap" style="justify-content: flex-end">
        <BaseButton
          v-if="polls.getStatus(poll.id) === 'active'"
          variant="ghost"
          @click="showClose = true"
          >Close</BaseButton
        >
        <BaseButton variant="ghost" @click="polls.duplicatePoll(poll.id)"
          >Duplicate</BaseButton
        >
        <BaseButton variant="ghost" @click="showEdit = true">Edit</BaseButton>
        <BaseButton variant="danger" @click="polls.requestDelete(poll.id)"
          >Delete</BaseButton
        >
      </div>
    </div>

    <div class="grid">
      <section class="card" style="padding: 16px">
        <h2 style="margin: 0 0 12px; font-size: 18px">Vote</h2>
        <PollVote :poll-id="poll.id" />
      </section>

      <section class="card" style="padding: 16px">
        <h2 style="margin: 0 0 12px; font-size: 18px">Results</h2>
        <PollResults :poll-id="poll.id" />
      </section>
    </div>

    <BaseModal v-model:open="showEdit" title="Edit poll">
      <PollForm
        mode="edit"
        :poll-id="poll.id"
        @cancel="showEdit = false"
        @saved="showEdit = false"
      />
    </BaseModal>

    <BaseModal v-model:open="showClose" title="Close poll">
      <p style="margin-top: 0">Closing will lock voting and freeze results.</p>
      <div class="row" style="justify-content: flex-end">
        <BaseButton variant="ghost" @click="showClose = false"
          >Cancel</BaseButton
        >
        <BaseButton
          variant="danger"
          @click="
            polls.closePoll(poll.id);
            showClose = false;
          "
          >Close poll</BaseButton
        >
      </div>
    </BaseModal>

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
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 900px) {
  .grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
