import type { Page } from '@playwright/test'
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
  await page.getByRole('button', { name: 'Увійти', exact: true }).click()
  await expect(page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })).toHaveCount(0)
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
