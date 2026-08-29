// ESLint estricto del forge-mcp. Portado del backend forge (misma base de calidad), quitando los
// bloques NestJS-específicos (controller/dto/entity/module/guard/pipe/interceptor/filter/middleware/
// strategy/enum): este proyecto es un MCP en TS puro, sin esa arquitectura de capas. Se conserva TODA
// la base universal: TS strictTypeChecked + stylistic, cspell, unicorn, unused-imports, naming, prettier.
import eslint from '@eslint/js';
import globals from 'globals';
import unusedImports from 'eslint-plugin-unused-imports';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';
import cspell from '@cspell/eslint-plugin';
import unicorn from 'eslint-plugin-unicorn';

export default tseslint.config(
  // ============================================================
  // GLOBAL IGNORES
  // ============================================================
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '**/*.generated.ts',
      '**/generated/**',
      '**/.cache/**',
    ],
  },

  // ============================================================
  // JAVASCRIPT BASE
  // ============================================================
  eslint.configs.recommended,

  // ============================================================
  // TYPESCRIPT (strict + stylistic, type-checked)
  // ============================================================
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    plugins: {
      '@cspell': cspell,
      unicorn,
    },
  },

  // ============================================================
  // ALL TYPESCRIPT FILES
  // ============================================================
  {
    files: ['**/*.ts'],

    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    plugins: {
      'unused-imports': unusedImports,
    },

    rules: {
      // TYPESCRIPT SAFETY
      'unicorn/name-replacements': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false, attributes: false } },
      ],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-parameters': 'warn',
      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-duplicate-enum-values': 'error',
      '@typescript-eslint/no-confusing-non-null-assertion': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/no-unnecessary-qualifier': 'error',
      '@typescript-eslint/no-unnecessary-type-constraint': 'error',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-empty-object-type': 'error',
      '@typescript-eslint/no-wrapper-object-types': 'error',

      // TYPE DEFINITIONS
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],

      // OPTIONAL CHAINING / NULLISH
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignoreConditionalTests: true, ignorePrimitives: true },
      ],

      // NAMING
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'class', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        { selector: 'typeAlias', format: ['PascalCase'] },
        { selector: 'enum', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase'] },
        { selector: 'function', format: ['camelCase'] },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
        {
          selector: 'memberLike',
          modifiers: ['public'],
          format: ['camelCase'],
        },
        {
          selector: 'objectLiteralProperty',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'objectLiteralProperty',
          format: null,
          modifiers: ['requiresQuotes'],
        },
      ],

      // UNUSED (via eslint-plugin-unused-imports)
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],

      // CORE JAVASCRIPT
      'no-unused-vars': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
      'no-debugger': 'error',
      'no-console': 'warn',
      'no-duplicate-imports': 'off',
      'no-shadow': 'off',

      // TS COMMENTS
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          'ts-nocheck': true,
          'ts-check': false,
          minimumDescriptionLength: 10,
        },
      ],
    },
  },

  // ============================================================
  // TYPE DECLARATION FILES
  // ============================================================
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'off',
      'unused-imports/no-unused-vars': 'off',
    },
  },

  // ============================================================
  // JAVASCRIPT CONFIG / SCRIPTS (type-aware rules don't apply)
  // ============================================================
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },

  // ============================================================
  // CSPELL (identifiers only)
  // ============================================================
  {
    rules: {
      '@cspell/spellchecker': [
        'error',
        {
          checkIdentifiers: true,
          checkStrings: false,
          checkComments: false,
        },
      ],
    },
  },

  // ============================================================
  // PRETTIER (last, disables formatting conflicts)
  // ============================================================
  eslintPluginPrettierRecommended,
);
