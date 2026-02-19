import { defineStore } from "pinia";

import { STORAGE_KEYS } from "@/utils/storage";

export type Theme = "light" | "dark";

export const useUiStore = defineStore("ui", {
  state: () => ({
    theme: "light" as Theme,
  }),
  actions: {
    hydrateTheme() {
      if (typeof window === "undefined") return;
      const stored = window.localStorage.getItem(STORAGE_KEYS.theme);
      if (stored === "dark" || stored === "light") {
        this.theme = stored;
      } else {
        const prefersDark = window.matchMedia?.(
          "(prefers-color-scheme: dark)"
        )?.matches;
        this.theme = prefersDark ? "dark" : "light";
      }
      document.documentElement.dataset.theme = this.theme;
    },
    toggleTheme() {
      this.theme = this.theme === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEYS.theme, this.theme);
      }
      document.documentElement.dataset.theme = this.theme;
    },
  },
});
