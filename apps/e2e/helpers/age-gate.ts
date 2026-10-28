import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** Діалог 18+ закриває контент до підтвердження. Підтвердження живе в
 *  localStorage ('age-confirmed'='1') — один раз на пристрій. */
export async function expectAgeGateVisible(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Вікове обмеження')).toBeVisible()
}

/** Підтверджує 18+, якщо гейт показаний (підтверджений пристрій — no-op). */
export async function confirmAgeGate(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog')
  if (await dialog.count()) {
    await dialog.getByRole('button', { name: 'Підтверджую, мені 18+' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
}