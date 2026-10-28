import type { Browser, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { skipAgeGate } from './age-gate'

export const E2E_PASSWORD = 'Passw0rd1!'

/** Унікальний email кожного прогону — idempotentність прогону і чистка
 *  (DELETE /me у 06-final) тримаються саме на цьому. */
export function e2eUserEmail(): string {
  return `e2e-web-${Date.now()}@x.com`
}

const NAME1 = 'Іван'
const NAME2 = 'Проходько'

/** Реєструє нового юзера через UI (/auth/register): EULA, пароль, вік.
 *  Після успіху BFF ставить httpOnly-cookie, хедер рендерить меню юзера. */
export async function registerE2eUser(page: Page): Promise<{ email: string; password: string }> {
  await skipAgeGate(page)
  const email = e2eUserEmail()
  await page.goto('/auth/register')
  await page.getByLabel(/Ім/).fill(NAME1)
  await page.getByLabel('Прізвище').fill(NAME2)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(E2E_PASSWORD)
  const age = page.getByLabel(/Вік/)
  if (await age.count()) await age.fill('25')
  // EULA — останній чекбокс форми
  await page.locator('input[type="checkbox"]').last().check()
  await page.getByRole('button', { name: 'Зареєструватися' }).click()

  // успіх: редірект із форми реєстрації + хедер показує юзера (не «Увійти»)
  await expect(page).not.toHaveURL(/auth\/register/)
  await expect(page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })).toHaveCount(0)
  return { email, password: E2E_PASSWORD }
}

/** Логін через UI (/auth/login). */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await skipAgeGate(page)
  await page.goto('/auth/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Пароль').fill(password)
  const respPromise = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().includes('/api/auth/login'),
    { timeout: 15_000 },
  ).catch(() => null)
  await page.getByRole('button', { name: 'Увійти', exact: true }).click()
  const resp = await respPromise
  if (!resp || resp.status() !== 200) {
    const body = resp ? await resp.text().catch(() => '') : 'no response'
    throw new Error(`BFF-логін не вдався: ${resp?.status ?? '—'} ${body.slice(0, 200)}`)
  }
  await expect(page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })).toHaveCount(0, { timeout: 15_000 })
}

/** Логінічний вихід: меню в хедері → «Вийти». */
export async function logoutViaUI(page: Page): Promise<void> {
  await page.locator('header button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: 'Вийти' }).click()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })).toBeVisible()
}
/** Посилання «Увійти» саме в хедері (банер) — без форма-підписівок і Google-кнобки. */
export function headerLoginLink(page: Page) {
  return page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })
}

const LIVE_FILE = '/tmp/piyachok-e2e-live.json'

interface LiveState {
  email: string
  password: string
  ageMs: number
}

/** Живе e2e-обличчя на прогін: реєстрація вичерпує квоту бек-тротлера
 *  (5/год на IP), тому один e2e-юзер реєструється (03-auth) і
 *  перевикористовується файлами 04/05/07 через storageState.
 *  Файл живе в /tmp; його чистить DELETE /me (07-final) — після нього новий
 *  прогін реєструє свіжого. */
/** Шлях до стану сесії живого e2e-юзера (для storageState нових контекстів). */
export function liveE2eStatePath(): string | null {
  try {
    const data = JSON.parse(require('fs').readFileSync(LIVE_FILE, 'utf8'))
    return data.state ?? null
  } catch {
    return null
  }
}

export async function ensureE2eUser(browser: Browser): Promise<{ email: string; password: string }> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  let live: LiveState | null = null
  try {
    live = JSON.parse(require('fs').readFileSync(LIVE_FILE, 'utf8')) as LiveState
  } catch { /* немає файла */ }

  if (live?.email) {
    await skipAgeGate(page)
    try {
      await page.goto('/auth/login')
      await page.getByLabel('Email').fill(live.email)
      await page.getByLabel('Пароль').fill(live.password)
      await page.getByRole('button', { name: 'Увійти', exact: true }).click()
      await expect(page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })).toHaveCount(0, { timeout: 15_000 })
      // юзер живий — логін вдався
      await page.context().storageState({ path: (live as unknown as { state: string }).state ?? '/tmp/piyachok-e2e-live-state.json' })
      await ctx.close()
      return { email: live.email, password: live.password }
    } catch {
      // видалений (фінал попереднього прогону) і/або інвалідний — реєструємо свіжого
    }
  }

  const creds = await registerE2eUser(page)
  const state = '/tmp/piyachok-e2e-live-state.json'
  await page.context().storageState({ path: state })
  require('fs').writeFileSync(LIVE_FILE, JSON.stringify({ ...creds, ageMs: Date.now(), state }))
  await ctx.close()
  return creds
}
