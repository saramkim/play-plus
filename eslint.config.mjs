import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'dist/**',
      '.yarn/**',
      '.vscode/**',
      'public/**',
      'webpack.config.js',
      'postcss.config.js',
      'tsconfig.json',
      'package.json',
      'yarn.lock',
      '.pnp.cjs',
      '.pnp.loader.mjs',
      'components.json',
    ],
  },
  { files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    settings: {
      react: {
        version: 'detect',
        runtime: 'automatic',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
    },
  },
];
