<script setup lang="ts">
import { computed } from "vue";

import { usePollsStore } from "@/stores/polls";
import BaseInput from "@/components/ui/BaseInput.vue";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import TagChip from "@/components/ui/TagChip.vue";

type Props = {
  tags: string[];
};

defineProps<Props>();

const polls = usePollsStore();

const statusOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "expired", label: "Expired" },
];

const sortOptions = [
  { value: "newest", label: "Newest" },
  { value: "endingSoon", label: "Ending soon" },
  { value: "mostVotes", label: "Most votes" },
  { value: "trending", label: "Trending" },
];

const selectedTag = computed(() => polls.filters.tag);
</script>

<template>
  <section class="card" style="padding: 12px">
    <div
      class="row wrap"
      style="align-items: end; justify-content: space-between"
    >
      <div style="flex: 1; min-width: 220px">
        <BaseInput
          id="poll-search"
          label="Search"
          placeholder="Search by title, description, or tag"
          :model-value="polls.filters.query"
          @update:model-value="polls.setQuery"
        />
      </div>

      <div style="min-width: 170px">
        <BaseSelect
          id="poll-status"
          label="Status"
          :model-value="polls.filters.status"
          :options="statusOptions"
          @update:model-value="(v) => polls.setStatusFilter(v as any)"
        />
      </div>

      <div style="min-width: 170px">
        <BaseSelect
          id="poll-sort"
          label="Sort"
          :model-value="polls.filters.sort"
          :options="sortOptions"
          @update:model-value="(v) => polls.setSort(v as any)"
        />
      </div>
    </div>

    <div
      v-if="tags.length"
      class="row wrap"
      style="margin-top: 12px; align-items: center"
    >
      <span class="muted" style="font-size: 13px">Tags:</span>
      <TagChip
        label="all"
        :selected="selectedTag === null"
        aria-label="Filter by all tags"
        @click="polls.setTagFilter(null)"
      />
      <TagChip
        v-for="t in tags"
        :key="t"
        :label="t"
        :selected="selectedTag === t"
        :aria-label="`Filter by tag ${t}`"
        @click="polls.setTagFilter(selectedTag === t ? null : t)"
      />
    </div>
  </section>
</template>
