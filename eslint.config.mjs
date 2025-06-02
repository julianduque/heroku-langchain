import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

export default [
  // Apply base JS config only to JS files
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...js.configs.recommended,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-case-declarations": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },

  // TypeScript configuration
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,mts,cts}"],
  })),
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      globals: {
        NodeJS: true,
        ...globals.node,
      },
    },
    rules: {
      // Disable base rules that conflict with TypeScript
      "no-unused-vars": "off",
      "no-case-declarations": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],

      // TypeScript-specific rules
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Exclude problematic files
  {
    ignores: [
      "dist/**/*",
      "docs/api/**/*",
      "**/*.json",
      "**/*.md",
      "node_modules/**/*",
    ],
  },

  // Prettier integration (must be last)
  eslintConfigPrettier,
];
