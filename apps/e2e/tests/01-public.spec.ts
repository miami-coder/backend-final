import { test, expect } from '@playwright/test'
import { confirmAgeGate, expectAgeGateVisible } from '../helpers/age-gate'

test.describe('Головна сторінка та віковий гейт 18+', () => {
  test('перший візит: контент закритий гейтом 18+, після підтвердження — відкритий', async ({ browser }) => {
    // Свіжий контекст — без localStorage: модалка 18+ мусить з'явитись
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/')
    await expectAgeGateVisible(page)

    await confirmAgeGate(page)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    const confirmed = await page.evaluate(() => localStorage.getItem('age-confirmed'))
    expect(confirmed).toBe('1')

    // Контент головної видимий після гейту
    await expect(page.getByRole('main')).toBeVisible()

    await context.close()
  })

  test('повторний візит у тому ж пристрої: гейт не зʼявляється знову', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/')
    await confirmAgeGate(page)

    await page.goto('/venues')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await context.close()
  })
})