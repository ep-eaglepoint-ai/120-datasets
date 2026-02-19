<script setup lang="ts">
import { computed, ref } from "vue";

import { usePollsStore } from "@/stores/polls";
import PollList from "@/components/polls/PollList.vue";
import PollFilters from "@/components/polls/PollFilters.vue";
import PollForm from "@/components/polls/PollForm.vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseModal from "@/components/ui/BaseModal.vue";

const polls = usePollsStore();

const showCreate = ref(false);

const tags = computed(() => polls.allTags);
</script>

<template>
  <div class="stack">
    <div
      class="row wrap"
      style="justify-content: space-between; align-items: center"
    >
      <div>
        <h1 style="margin: 0">Polls</h1>
        <p class="muted" style="margin: 6px 0 0">
          Create, vote, and view results. State persists locally.
        </p>
      </div>

      <BaseButton @click="showCreate = true">Create poll</BaseButton>
    </div>

    <PollFilters :tags="tags" />

    <PollList />

    <BaseModal v-model:open="showCreate" title="Create poll">
      <PollForm
        mode="create"
        @cancel="showCreate = false"
        @saved="showCreate = false"
      />
    </BaseModal>
  </div>
</template>
