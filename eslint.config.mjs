// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'src/generated/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      "prettier/prettier": ["error", { endOfLine: "auto" }],
    },
  },
  {
    // Lớp dữ liệu (spec 0001 con): chỉ Repository, src/database và src/common/persistence
    // được import giá trị từ Prisma; mọi nơi vẫn được `import type`.
    files: ['src/**/*.ts'],
    ignores: [
      'src/**/*.repository.ts',
      'src/database/**',
      'src/common/persistence/**',
      'src/generated/**',
    ],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@prisma/client',
                '**/generated/prisma',
                '**/generated/prisma/**',
              ],
              allowTypeImports: true,
              message:
                'Chỉ *.repository.ts, src/database và src/common/persistence được import giá trị từ Prisma (spec 0001 con). Dùng `import type` cho kiểu.',
            },
            {
              group: ['@prisma/adapter-pg'],
              message: 'Chỉ src/database được dùng adapter của Prisma.',
            },
          ],
        },
      ],
    },
  },
  {
    // Truy vấn thô chỉ dạng tagged template có tham số gắn sẵn; cấm các bản `Unsafe` (spec 0001 con).
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'MemberExpression[property.name=/^\\$(query|execute)RawUnsafe$/]',
          message:
            'Cấm $queryRawUnsafe và $executeRawUnsafe; dùng $queryRaw hoặc $executeRaw dạng tagged template.',
        },
      ],
    },
  },
);
