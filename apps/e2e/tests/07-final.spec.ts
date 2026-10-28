import { test, expect } from '@playwright/test'
import { ensureE2eUser, liveE2eStatePath } from '../helpers/accounts'
import { skipAgeGate } from '../helpers/age-gate'

/** Фінал прогону: юзер видаляє власний профіль (DELETE /me через UI) —
 *  і реєстрація нового юзера на кожен прогін лишає систему чистою.
 *  Видалення прибирає живий e2e-юзер, тож наступний прогін зареєструє
 *  свіжого (квота бек-тротлера не тратиться). */
test.describe('Видалення власного профілю', () => {
  test('кнопка в /account → модалка → «Так, видалити» → гість; повторний вхід — «Обліковий запис видалено»', async ({ browser }) => {
    // живий e2e-юзер з 03 (або свіжий) — саме його видаляємо наприкінці прогону
    const { email, password } = await ensureE2eUser(browser)
    // state-шлях читаємо ДО прибирання live-файла (після rm він null!)
    const statePath = liveE2eStatePath()!
    expect(statePath).toBeTruthy()
    require('fs').rmSync('/tmp/piyachok-e2e-live.json', { force: true })

    const ctx = await browser.newContext({ storageState: statePath })
    const page = await ctx.newPage()
    await skipAgeGate(page)
    await page.goto('/account')
    await page.getByRole('button', { name: 'Видалити профіль' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Так, видалити' }).click()
    // після видалення: сесія скинута, хедер — гість
    await expect(page.getByRole('banner').getByRole('link', { name: 'Увійти', exact: true })).toBeVisible({ timeout: 15_000 })

    // повторний вхід у видалений акаунт — відмова бекенда
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Пароль').fill(password)
    await page.getByRole('button', { name: 'Увійти', exact: true }).click()
    await expect(page.locator('form [role="alert"]').first()).toContainText('Обліковий запис видалено')
    await ctx.close()
  })
})