import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  test: {
    environment: 'jsdom',
    globals: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // ponytail: electron/ needs a live Electron runtime — smoke-tested via SHOT env instead
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx', 'src/model.check.mjs', 'src/**/*.test.*'],
      thresholds: { lines: 99, functions: 98, branches: 90, statements: 98 },
    },
  },
})
