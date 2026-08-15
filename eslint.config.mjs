import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import n from "eslint-plugin-n";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default defineConfig([
  {
    ignores: ["activity/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node,
    },
    plugins: {
      import: importPlugin,
      n,
      "unused-imports": unusedImports,
    },
    settings: {
      "import/resolver": { node: { extensions: [".js", ".cjs", ".mjs", ".json"] } },
    },
    rules: {
      "import/no-unresolved": "error",
      "import/named": "error",
      "import/no-duplicates": "error",
      "import/order": ["warn", { alphabetize: { order: "asc", caseInsensitive: true } }],
      "import/newline-after-import": "warn",
      "n/no-missing-import": "error",
      "n/no-missing-require": "error",
      "unused-imports/no-unused-imports": "error",
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: { sourceType: "module" },
    rules: { "import/no-unresolved": "off" },
  },
]);
