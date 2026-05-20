import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Aturan baru react-hooks v7 yang berorientasi React Compiler. Project ini
      // ditulis manual (tanpa compiler) dan pola berikut dipakai sengaja & aman:
      // komponen helper kecil di dalam render (Row/CustomTooltip), setState di effect
      // untuk sinkronisasi prop/async load. Dimatikan agar lint fokus ke isu nyata.
      'react-hooks/static-components': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      // `any` dipakai sengaja untuk objek lintas-komponen (lastResult, payload chart).
      '@typescript-eslint/no-explicit-any': 'off',
      // Tetap sebagai peringatan (bukan error) — informatif, tidak menggagalkan lint.
      'react-refresh/only-export-components': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
