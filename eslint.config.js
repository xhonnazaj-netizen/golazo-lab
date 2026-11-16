import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['src/**/*.{js,jsx}', 'tests/**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.browser }, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { react },
    rules: { 'no-undef': 'error', 'react/jsx-uses-vars': 'error', 'react/jsx-uses-react': 'error', 'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }] }
  }
]
