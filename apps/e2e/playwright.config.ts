import { defineConfig } from '@playwright/test'

// Браузерний прогін проти реальної docker-збірки:
//   docker compose up -d --build web  →  web на http://localhost:3001, api на :3000.
// webServer НЕ запускаємо (стека піднята докером), бо бачимо те саме, що і юзер.
export default defineConfig({
  globalSetup: './global-setup.ts',
  testDir: './tests',
  fullyParallel: false, // спільний стан (адмін-модерація і фінал) — послідовно
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3001',
    headless: true,
    trace: 'retain-on-failure',
    locale: 'uk-UA',
  },
})