import globals from "globals";
import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ["dist/"] },
  pluginJs.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, webkitAudioContext: "readonly" },
    },
    rules: {
      "no-var": ["error"],
      "prefer-const": ["error"],
    },
  },
  {
    files: ["vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  eslintConfigPrettier,
];
