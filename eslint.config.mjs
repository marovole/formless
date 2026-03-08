import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      ".open-next/**",
      ".vercel/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "__tests__/**",
      "e2e/**",
      "coverage/**",
      "vitest.config.ts",
      "playwright.config.ts",
      "vitest.setup.ts",
    ],
  },
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': 'allow-with-description',
          'ts-check': 'allow-with-description',
        },
      ],
      // TODO: Change to 'error' after fixing remaining any types in:
      // - app/[locale]/settings/guanzhao/page.tsx
      // - app/[locale]/settings/memory/page.tsx
      // - app/admin/(protected)/*.tsx
      // - app/api/admin/init/route.ts
      // - app/api/chat/conversation.ts
      // - components/chat/ToolSuggestionButtons.tsx
      // - lib/agent/providers/deepseek.ts
      // - lib/agent/tools.ts
      // - lib/hooks/useSSEChat.ts
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    },
  },
];

export default eslintConfig;
