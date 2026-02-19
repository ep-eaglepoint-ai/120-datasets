/// <reference types="vitest" />
const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");
const path = require("path");

module.exports = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["../tests/**/*.test.js"],
    css: true,
  },
});
