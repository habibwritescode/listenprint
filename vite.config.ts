/// <reference types="vitest/config" />
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  // Spotify redirect URIs forbid `localhost` and must match the port exactly,
  // so bind the loopback IP and fail instead of drifting to another port.
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: {
    // Explicit include: the default glob would also collect old/test/*.test.js (node:test, not Vitest).
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Explicit include so files no test imports still show up (at 0%) instead of vanishing.
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
      reporter: ['text', 'html'],
      // Thresholds only on pure-logic directories, set from measured coverage (see tasks/SPEC-ci.md).
      thresholds: {
        'src/library/**': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
})
