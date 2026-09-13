import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'apps-script', 'gateway/dist', 'gateway/node_modules'] },
  // Frontend (React/Vite)
  { extends: [js.configs.recommended, ...tseslint.configs.recommended], files: ['src/**/*.{ts,tsx}'], languageOptions: { ecmaVersion: 2022, globals: globals.browser }, plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh }, rules: { ...reactHooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
  // Gateway (Node/Express)
  { extends: [js.configs.recommended, ...tseslint.configs.recommended], files: ['gateway/src/**/*.ts', 'gateway/tests/**/*.ts'], languageOptions: { ecmaVersion: 2022, globals: { ...globals.node } }, rules: {
    // @typescript-eslint/no-unused-expressions has a known incompatibility
    // with eslint 8.57's flat-config wrapper (TypeError reading
    // 'allowShortCircuit'). tsc already flags unused expressions.
    '@typescript-eslint/no-unused-expressions': 'off',
  } },
);
