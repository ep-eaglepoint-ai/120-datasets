import type { PollVotingMode } from "@/types/poll";

export type PollDraft = {
  title: string;
  description: string;
  tags: string;
  votingMode: PollVotingMode;
  isAnonymous: boolean;
  startAt?: number;
  endAt?: number;
  options: string[];
};

export type ValidationError = {
  field: string;
  message: string;
};

export function normalizeTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.slice(0, 24));
}

export function validatePollDraft(draft: PollDraft): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!draft.title.trim()) {
    errors.push({ field: "title", message: "Title is required." });
  } else if (draft.title.trim().length > 120) {
    errors.push({ field: "title", message: "Title is too long." });
  }

  if (draft.description.trim().length > 500) {
    errors.push({ field: "description", message: "Description is too long." });
  }

  const cleaned = draft.options.map((o) => o.trim()).filter(Boolean);
  if (cleaned.length < 2) {
    errors.push({ field: "options", message: "Add at least two options." });
  }

  const uniq = new Set(cleaned.map((o) => o.toLowerCase()));
  if (uniq.size !== cleaned.length) {
    errors.push({ field: "options", message: "Options must be unique." });
  }

  if (draft.startAt && draft.endAt && draft.endAt <= draft.startAt) {
    errors.push({
      field: "endAt",
      message: "End time must be after start time.",
    });
  }

  if (draft.votingMode !== "single" && draft.votingMode !== "multi") {
    errors.push({ field: "votingMode", message: "Voting mode is invalid." });
  }

  return errors;
}

export function validateVote(
  votingMode: PollVotingMode,
  selectedOptionIds: string[],
  voterName: string | undefined,
  isAnonymous: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (selectedOptionIds.length === 0) {
    errors.push({ field: "selection", message: "Select at least one option." });
  }

  if (votingMode === "single" && selectedOptionIds.length > 1) {
    errors.push({
      field: "selection",
      message: "Only one option can be selected.",
    });
  }

  if (!isAnonymous) {
    const name = (voterName ?? "").trim();
    if (!name) {
      errors.push({
        field: "voterName",
        message: "Name is required for named voting.",
      });
    } else if (name.length > 40) {
      errors.push({ field: "voterName", message: "Name is too long." });
    }
  }

  return errors;
}
