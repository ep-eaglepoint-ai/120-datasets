/* eslint-env node */
module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 12,
    sourceType: "module",
  },
  plugins: ["react", "@typescript-eslint"],
  rules: {
    indent: ["error", 2],
    "linebreak-style": "off",
    quotes: "off",
    semi: "off",

    // suppress errors for missing 'import React' in files
    "react/react-in-jsx-scope": "off",
    "react/prop-types": [0],
    "react-hooks/exhaustive-deps": 2,

    "@typescript-eslint/no-unused-vars": [2, { varsIgnorePattern: "_.*" }],
  },
  settings: {
    react: {
      version: "detect",
    },
  },
};
