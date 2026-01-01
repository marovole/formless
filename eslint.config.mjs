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
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**",
    ],
  },
  {
    files: ["lib/supabase/database.types.ts"],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
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
    },
  },
];

export default eslintConfig;
