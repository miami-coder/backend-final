import { test, expect } from '@playwright/test'
import { E2E_PASSWORD, e2eUserEmail, loginViaUI } from '../helpers/accounts'
import { skipAgeGate } from '../helpers/age-gate'

/** Фінал прогону: юзер видаляє власний профіль (DELETE /me через UI) —
 *  і реєстрація нового юзера на кожен прогін лишає систему чистою. */
test.describe('Видалення власного профілю', () => {
  test('кнопка в /account → модалка → «Так, видалити» → госте; повторний вхід — «Обліковий запис видалено»', async ({ page }) => {
    // цей юзер живе тільки в межах прогону і видаляє себе наприкінці
    await skipAgeGate(page)
    const email = e2eUserEmail()
    await page.goto('/auth/register')
    await page.getByLabel(/Ім/).fill('Іван')
    await page.getByLabel('Прізвище').fill('Проходько')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Пароль').fill(E2E_PASSWORD)
    await page.getByLabel(/Вік/).fill('25')
    await page.locator('input[type="checkbox"]').last().check()
    await page.getByRole('button', { name: 'Зареєструватися' }).click()
    await expect(page).not.toHaveURL(/auth\/register/)

    // видалення профілю
    await page.goto('/account')
    await page.getByRole('button', { name: 'Видалити профіль' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Так, видалити' }).click()
    // після видалення: сесія скинута, редірект у гостя
    await expect(page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })).toBeVisible({ timeout: 15_000 })

    // repeat login у видалений акаунт — відмова
    await page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true }).click()
    await expect(page).toHaveURL(/auth\/login/)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Пароль').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Увійти', exact: true }).click()
    await expect(page.locator('form [role="alert"]').first()).toContainText('Обліковий запис видалено')
  })
})