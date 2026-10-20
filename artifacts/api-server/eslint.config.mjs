// Minimal ESLint flat config (#8): typescript-eslint recommended, no autofix.
// Baseline counts are recorded, not mass-fixed; the gate is "do not increase".
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "**/*.mjs", "data/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
