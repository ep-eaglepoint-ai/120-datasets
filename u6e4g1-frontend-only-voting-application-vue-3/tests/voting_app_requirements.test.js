import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const APP = join(ROOT, "repository_after");

function readText(path) {
  assert.equal(existsSync(path), true, `Missing file: ${path}`);
  return readFileSync(path, "utf-8");
}

function listFilesRecursive(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function expectContains(path, needles) {
  const txt = readText(path);
  for (const n of needles) {
    assert.equal(
      txt.includes(n),
      true,
      `Expected to find ${JSON.stringify(n)} in ${path}`
    );
  }
}

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`✓ ${name}\n`);
  } catch (err) {
    process.stderr.write(`✗ ${name}\n`);
    throw err;
  }
}

process.stdout.write("Frontend-only voting app requirements (Vue 3)\n");

test("stores the app inside repository_after", () => {
  assert.equal(existsSync(APP), true);
  assert.equal(existsSync(join(APP, "package.json")), true);
  assert.equal(existsSync(join(APP, "src", "main.ts")), true);
});

test("uses Vue 3 + Composition API + <script setup> everywhere", () => {
  const src = join(APP, "src");
  assert.equal(existsSync(src), true);

  const vueFiles = listFilesRecursive(src).filter((p) => p.endsWith(".vue"));
  assert.ok(vueFiles.length > 0);

  for (const f of vueFiles) {
    const txt = readText(f);
    assert.equal(txt.includes("<script setup"), true);
  }
});

test("is frontend-only: no backend, no external API calls", () => {
  const src = join(APP, "src");
  const code = listFilesRecursive(src)
    .filter((p) => [".ts", ".vue", ".css"].some((ext) => p.endsWith(ext)))
    .map((p) => readText(p))
    .join("\n");

  assert.equal(code.toLowerCase().includes("axios"), false);
  assert.equal(code.includes("fetch("), false);
  assert.equal(code.includes("XMLHttpRequest"), false);
});

test("uses Pinia store with LocalStorage persistence + hydration", () => {
  const store = join(APP, "src", "stores", "polls.ts");
  // storage is abstracted via utils/storage.ts, so we verify store has hydrate/persist
  // and that storage helpers reference localStorage.
  expectContains(store, ["defineStore", "hydrate", "persist"]);

  const storage = join(APP, "src", "utils", "storage.ts");
  expectContains(storage, ["localStorage", "sessionStorage"]);
});

test("supports CRUD: create, edit, duplicate, delete polls", () => {
  const store = join(APP, "src", "stores", "polls.ts");
  expectContains(store, [
    "createPoll",
    "updatePoll",
    "duplicatePoll",
    "deletePoll",
  ]);

  const detail = join(APP, "src", "views", "PollDetailView.vue");
  expectContains(detail, ["Duplicate", "Edit", "Delete"]);

  const home = join(APP, "src", "views", "HomeView.vue");
  expectContains(home, ["Create poll"]);
});

test("poll schema supports title, optional description, tags, options, and start/end times", () => {
  const pollType = join(APP, "src", "types", "poll.ts");
  expectContains(pollType, [
    "title",
    "description",
    "tags",
    "options",
    "startAt",
    "endAt",
  ]);

  const form = join(APP, "src", "components", "polls", "PollForm.vue");
  expectContains(form, [
    "Title",
    "Description",
    "Tags",
    "Start time",
    "End time",
    "OptionEditor",
  ]);
});

test("supports single-choice and multi-choice voting", () => {
  const pollType = join(APP, "src", "types", "poll.ts");
  const pollTxt = readText(pollType);
  assert.ok(/single/.test(pollTxt));
  assert.ok(/multi/.test(pollTxt));

  const vote = join(APP, "src", "components", "polls", "PollVote.vue");
  const txt = readText(vote);
  assert.ok(txt.includes("radio"));
  assert.ok(txt.includes("checkbox"));
});

test("supports anonymous or named voting (client-side only)", () => {
  const pollType = join(APP, "src", "types", "poll.ts");
  expectContains(pollType, ["isAnonymous", "voterName"]);

  const form = join(APP, "src", "components", "polls", "PollForm.vue");
  expectContains(form, ["Anonymous voting", "Named voting"]);

  const vote = join(APP, "src", "components", "polls", "PollVote.vue");
  expectContains(vote, ["Your name"]);
});

test("prevents duplicate voting per poll per browser session", () => {
  const store = join(APP, "src", "stores", "polls.ts");
  const txt = readText(store);
  assert.ok(txt.includes("hasVotedThisSession"));
  // store uses session storage via helper functions
  assert.ok(/readSessionStorage|writeSessionStorage/.test(txt));
  assert.ok(txt.includes("voting_app:voted:"));

  const storage = join(APP, "src", "utils", "storage.ts");
  assert.ok(readText(storage).includes("sessionStorage"));
});

test("handles poll status: active, closed, expired; locks voting after close/end", () => {
  const store = join(APP, "src", "stores", "polls.ts");
  const txt = readText(store);
  assert.ok(/['"]active['"]/.test(txt) || /\bactive\b/.test(txt));
  assert.ok(/['"]closed['"]/.test(txt) || /\bclosed\b/.test(txt));
  assert.ok(/['"]expired['"]/.test(txt) || /\bexpired\b/.test(txt));
  assert.ok(txt.includes("closedManuallyAt"));
  assert.ok(txt.includes("isWithinVotingWindow"));
});

test("shows real-time results with animated progress bars, percentages, and total votes", () => {
  const results = join(APP, "src", "components", "polls", "PollResults.vue");
  expectContains(results, ["Total:", "ProgressBar", "%"]);

  const progress = join(APP, "src", "components", "ui", "ProgressBar.vue");
  expectContains(progress, ['role="progressbar"', "transition"]);
});

test("has sortable/filterable poll lists: active, closed, trending, by tag", () => {
  const filters = join(APP, "src", "components", "polls", "PollFilters.vue");
  expectContains(filters, ["Status", "Trending", "Tags:"]);

  const store = join(APP, "src", "stores", "polls.ts");
  expectContains(store, ["filteredSortedPolls", "trending", "filters"]);
});

test("includes form validation and empty/error states", () => {
  const validation = join(APP, "src", "utils", "validation.ts");
  expectContains(validation, [
    "Title is required",
    "Add at least two options",
    "Options must be unique",
    "End time must be after start time",
  ]);

  const list = join(APP, "src", "components", "polls", "PollList.vue");
  expectContains(list, ["No polls found"]);
});

test("includes accessibility support: modal ARIA + focus trapping + keyboard escape", () => {
  const modal = join(APP, "src", "components", "ui", "BaseModal.vue");
  expectContains(modal, ['role="dialog"', 'aria-modal="true"', "Escape"]);

  const focusTrap = join(APP, "src", "composables", "useFocusTrap.ts");
  expectContains(focusTrap, ["Tab"]);
});

test("supports light/dark mode toggle with persistence", () => {
  const ui = join(APP, "src", "stores", "ui.ts");
  expectContains(ui, ["toggleTheme", "localStorage", "dataset.theme"]);

  const app = join(APP, "src", "App.vue");
  assert.ok(/toggleTheme|theme/.test(readText(app)));
});

process.stdout.write("All checks passed.\n");
