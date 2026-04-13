import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['lib/**/*.ts'],
    rules: {
      'max-lines-per-function': ['error', 50],
      '@typescript-eslint/no-explicit-any': 'warn'
    },
  }
);