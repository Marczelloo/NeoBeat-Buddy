import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import n from "eslint-plugin-n";
import unusedImports from "eslint-plugin-unused-imports";
import { defineConfig } from "eslint/config";

export default defineConfig([
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: globals.node
    },
    plugins: {
      import: importPlugin,
      n,
      "unused-imports": unusedImports
    },
    settings: {
      "import/resolver": { node: { extensions: [".js", ".cjs", ".mjs", ".json"] } }
    },
    rules: {
      "import/no-unresolved": "error",
      "import/named": "error",
      "import/no-duplicates": "error",
      "import/order": ["warn", { alphabetize: { order: "asc", caseInsensitive: true } }],
      "import/newline-after-import": "warn",
      "n/no-missing-import": "error",
      "n/no-missing-require": "error",
      "unused-imports/no-unused-imports": "error"
    }
  }
]);