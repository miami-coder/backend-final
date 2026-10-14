import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// .mts (ESM): інакше Vite 8 лає «ESM syntax in a file loaded as CommonJS».
// pool лишаємо дефолтним: перевірено 2026-09-09 — vmThreads ламає
// vi.stubGlobal('window') у client.test.ts («Cannot redefine property: window»);
// порада «create jsdom once per worker» — лише performance-натяк, не помилка.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // нативна підтримка tsconfig paths у Vite 8 (замість vite-tsconfig-paths)
    tsconfigPaths: true,
    alias: {
      // server-only кидає поза RSC-середовищем; у тестах це порожній модуль
      'server-only': fileURLToPath(new URL('./src/test/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
