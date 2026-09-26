// ESLint 9 flat config. Same rules as the old .eslintrc.cjs: JS + TypeScript
// recommended, the two React hooks rules, and react-refresh's export check.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'supabase', 'playwright-report', 'test-results'] },
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  // Node-side files: configs, e2e tests, one-off scripts.
  {
    files: ['*.config.{js,ts}', 'e2e/**', 'scripts/**', '_*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
);
