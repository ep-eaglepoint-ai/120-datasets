import { defineStore } from "pinia";

import type { Ballot, Poll, PollOption, PollStatus } from "@/types/poll";
import { createId } from "@/utils/id";
import { nowMs } from "@/utils/time";
import {
  readLocalStorageJson,
  readSessionStorage,
  STORAGE_KEYS,
  writeLocalStorageJson,
  writeSessionStorage,
} from "@/utils/storage";
import {
  normalizeTags,
  validateVote,
  type PollDraft,
} from "@/utils/validation";

type PersistedStateV1 = {
  version: 1;
  polls: Poll[];
};

type SortMode = "newest" | "endingSoon" | "mostVotes" | "trending";

type ListFilters = {
  status: "all" | PollStatus;
  tag: string | null;
  sort: SortMode;
  query: string;
};

function votedSessionKey(pollId: string): string {
  return `voting_app:voted:${pollId}`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function computeStatus(poll: Poll, now: number): PollStatus {
  if (poll.closedManuallyAt) return "closed";
  if (poll.endAt && now >= poll.endAt) return "expired";
  return "active";
}

function isWithinVotingWindow(poll: Poll, now: number): boolean {
  if (poll.closedManuallyAt) return false;
  if (poll.startAt && now < poll.startAt) return false;
  if (poll.endAt && now >= poll.endAt) return false;
  return true;
}

function totalVotes(poll: Poll): number {
  return poll.ballots.length;
}

function trendingScore(poll: Poll, now: number): number {
  const votes = totalVotes(poll);
  const ageHours = Math.max(1, (now - poll.createdAt) / (1000 * 60 * 60));
  const recentBoost = poll.lastVoteAt
    ? Math.max(0, 24 - (now - poll.lastVoteAt) / (1000 * 60 * 60)) / 24
    : 0;
  return votes / ageHours + recentBoost;
}

export const usePollsStore = defineStore("polls", {
  state: () => ({
    hydrated: false,
    nowTick: nowMs(),
    tickerStarted: false,
    polls: [] as Poll[],
    filters: {
      status: "all",
      tag: null,
      sort: "newest",
      query: "",
    } as ListFilters,
    confirmDelete: {
      open: false,
      pollId: null as string | null,
    },
  }),
  getters: {
    allTags(state): string[] {
      const set = new Set<string>();
      for (const poll of state.polls) {
        for (const t of poll.tags) set.add(t);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b));
    },

    filteredSortedPolls(state): Poll[] {
      const now = state.nowTick;
      const query = state.filters.query.trim().toLowerCase();

      let list = state.polls.slice();

      if (state.filters.status !== "all") {
        list = list.filter(
          (p) => computeStatus(p, now) === state.filters.status
        );
      }

      if (state.filters.tag) {
        list = list.filter((p) => p.tags.includes(state.filters.tag as string));
      }

      if (query) {
        list = list.filter((p) => {
          const hay = `${p.title} ${p.description ?? ""} ${p.tags.join(
            " "
          )}`.toLowerCase();
          return hay.includes(query);
        });
      }

      const sort = state.filters.sort;
      list.sort((a, b) => {
        if (sort === "newest") return b.createdAt - a.createdAt;
        if (sort === "mostVotes") return totalVotes(b) - totalVotes(a);
        if (sort === "endingSoon") {
          const aEnd = a.endAt ?? Number.POSITIVE_INFINITY;
          const bEnd = b.endAt ?? Number.POSITIVE_INFINITY;
          return aEnd - bEnd;
        }
        // trending
        return trendingScore(b, now) - trendingScore(a, now);
      });

      return list;
    },
  },
  actions: {
    ensureTickerStarted() {
      if (this.tickerStarted) return;
      this.tickerStarted = true;
      // keep status + progress reactive
      window.setInterval(() => {
        this.nowTick = nowMs();
      }, 15_000);
    },

    hydrate() {
      if (this.hydrated) return;
      this.hydrated = true;
      const data = readLocalStorageJson<PersistedStateV1>(STORAGE_KEYS.polls);
      if (!data || data.version !== 1 || !Array.isArray(data.polls)) {
        this.polls = [];
        return;
      }
      // basic shape guard
      this.polls = data.polls
        .filter(
          (p): p is Poll =>
            !!p &&
            typeof p.id === "string" &&
            Array.isArray(p.options) &&
            Array.isArray(p.ballots)
        )
        .map((p) => ({
          ...p,
          tags: Array.isArray(p.tags) ? p.tags : [],
          ballots: Array.isArray(p.ballots) ? p.ballots : [],
          options: Array.isArray(p.options) ? p.options : [],
        }));
    },

    persist() {
      const payload: PersistedStateV1 = {
        version: 1,
        polls: this.polls,
      };
      writeLocalStorageJson(STORAGE_KEYS.polls, payload);
    },

    setQuery(query: string) {
      this.filters.query = query;
    },

    setStatusFilter(status: ListFilters["status"]) {
      this.filters.status = status;
    },

    setTagFilter(tag: string | null) {
      this.filters.tag = tag;
    },

    setSort(sort: SortMode) {
      this.filters.sort = sort;
    },

    getById(pollId: string): Poll | undefined {
      this.hydrate();
      return this.polls.find((p) => p.id === pollId);
    },

    getStatus(pollId: string): PollStatus {
      const poll = this.getById(pollId);
      if (!poll) return "expired";
      return computeStatus(poll, this.nowTick);
    },

    getStatusLabel(pollId: string): string {
      const poll = this.getById(pollId);
      if (!poll) return "Not found";
      const status = computeStatus(poll, this.nowTick);
      if (status === "closed") return "Closed";
      if (status === "expired") return "Expired";
      if (poll.startAt && this.nowTick < poll.startAt)
        return "Active (not started)";
      return "Active";
    },

    hasVotedThisSession(pollId: string): boolean {
      const key = votedSessionKey(pollId);
      return !!readSessionStorage(key);
    },

    canVote(pollId: string): { ok: boolean; reason?: string } {
      const poll = this.getById(pollId);
      if (!poll) return { ok: false, reason: "Poll not found." };

      const now = this.nowTick;
      if (!isWithinVotingWindow(poll, now)) {
        const status = computeStatus(poll, now);
        if (status === "expired")
          return { ok: false, reason: "Poll has ended." };
        if (status === "closed")
          return { ok: false, reason: "Poll is closed." };
        if (poll.startAt && now < poll.startAt)
          return { ok: false, reason: "Poll has not started yet." };
        return { ok: false, reason: "Voting is not available." };
      }

      if (this.hasVotedThisSession(pollId)) {
        return {
          ok: false,
          reason: "You already voted on this poll in this browser session.",
        };
      }

      return { ok: true };
    },

    createPoll(draft: PollDraft): string {
      this.hydrate();
      const id = createId("poll");
      const createdAt = nowMs();

      const options: PollOption[] = draft.options
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text) => ({ id: createId("opt"), text }));

      const poll: Poll = {
        id,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        tags: normalizeTags(draft.tags),
        votingMode: draft.votingMode,
        isAnonymous: draft.isAnonymous,
        startAt: draft.startAt,
        endAt: draft.endAt,
        options,
        ballots: [],
        createdAt,
        updatedAt: createdAt,
      };

      this.polls.unshift(poll);
      this.persist();
      return id;
    },

    updatePoll(pollId: string, draft: PollDraft) {
      this.hydrate();
      const idx = this.polls.findIndex((p) => p.id === pollId);
      if (idx < 0) return;

      const prev = this.polls[idx];
      const now = nowMs();

      const newOptions: PollOption[] = draft.options
        .map((t) => t.trim())
        .filter(Boolean)
        .map((text, i) => {
          const existing = prev.options[i];
          return { id: existing?.id ?? createId("opt"), text };
        });

      const poll: Poll = {
        ...prev,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        tags: normalizeTags(draft.tags),
        votingMode: draft.votingMode,
        isAnonymous: draft.isAnonymous,
        startAt: draft.startAt,
        endAt: draft.endAt,
        options: newOptions,
        updatedAt: now,
      };

      this.polls.splice(idx, 1, poll);
      this.persist();
    },

    duplicatePoll(pollId: string): string | null {
      this.hydrate();
      const original = this.polls.find((p) => p.id === pollId);
      if (!original) return null;

      const now = nowMs();
      const newId = createId("poll");
      const options = original.options.map((o) => ({
        id: createId("opt"),
        text: o.text,
      }));

      const copy: Poll = {
        ...original,
        id: newId,
        title: `Copy of ${original.title}`,
        ballots: [],
        options,
        createdAt: now,
        updatedAt: now,
        lastVoteAt: undefined,
        closedManuallyAt: undefined,
      };

      this.polls.unshift(copy);
      this.persist();
      return newId;
    },

    requestDelete(pollId: string) {
      this.confirmDelete.open = true;
      this.confirmDelete.pollId = pollId;
    },

    cancelDelete() {
      this.confirmDelete.open = false;
      this.confirmDelete.pollId = null;
    },

    commitDelete() {
      const pollId = this.confirmDelete.pollId;
      if (!pollId) return;
      this.deletePoll(pollId);
      this.cancelDelete();
    },

    deletePoll(pollId: string) {
      this.hydrate();
      this.polls = this.polls.filter((p) => p.id !== pollId);
      this.persist();
    },

    closePoll(pollId: string) {
      this.hydrate();
      const poll = this.polls.find((p) => p.id === pollId);
      if (!poll) return;
      if (poll.closedManuallyAt) return;
      poll.closedManuallyAt = nowMs();
      poll.updatedAt = poll.closedManuallyAt;
      this.persist();
    },

    castVote(
      pollId: string,
      optionIds: string[],
      voterName?: string
    ): { ok: boolean; errors?: string[] } {
      this.hydrate();
      const poll = this.polls.find((p) => p.id === pollId);
      if (!poll) return { ok: false, errors: ["Poll not found."] };

      this.ensureTickerStarted();

      const can = this.canVote(pollId);
      if (!can.ok) return { ok: false, errors: [can.reason ?? "Cannot vote."] };

      const cleaned = Array.from(new Set(optionIds)).filter(Boolean);
      const voteErrors = validateVote(
        poll.votingMode,
        cleaned,
        voterName,
        poll.isAnonymous
      );
      if (voteErrors.length)
        return { ok: false, errors: voteErrors.map((e) => e.message) };

      const allowed = new Set(poll.options.map((o) => o.id));
      const finalOptionIds = cleaned.filter((id) => allowed.has(id));
      if (finalOptionIds.length === 0) {
        return { ok: false, errors: ["Selected options are invalid."] };
      }

      const ballot: Ballot = {
        id: createId("ballot"),
        pollId: poll.id,
        optionIds:
          poll.votingMode === "single" ? [finalOptionIds[0]] : finalOptionIds,
        voterName: poll.isAnonymous ? undefined : (voterName ?? "").trim(),
        createdAt: nowMs(),
      };

      poll.ballots.push(ballot);
      poll.lastVoteAt = ballot.createdAt;
      poll.updatedAt = ballot.createdAt;
      this.persist();

      writeSessionStorage(votedSessionKey(pollId), ballot.id);
      return { ok: true };
    },

    getResults(pollId: string): {
      total: number;
      items: Array<{
        optionId: string;
        label: string;
        count: number;
        pct: number;
      }>;
    } {
      const poll = this.getById(pollId);
      if (!poll) return { total: 0, items: [] };

      const counts = new Map<string, number>();
      for (const opt of poll.options) counts.set(opt.id, 0);

      for (const ballot of poll.ballots) {
        for (const optionId of ballot.optionIds) {
          counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
        }
      }

      const total = poll.ballots.length;
      const items = poll.options.map((opt) => {
        const count = counts.get(opt.id) ?? 0;
        const pct = total === 0 ? 0 : clamp01(count / total);
        return { optionId: opt.id, label: opt.text, count, pct };
      });

      // stable sort by count desc, then label
      items.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

      return { total, items };
    },
  },
});
