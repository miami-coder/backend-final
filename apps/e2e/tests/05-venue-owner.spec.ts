import { test, expect } from '@playwright/test'
import { registerE2eUser } from '../helpers/accounts'
import { skipAgeGate } from '../helpers/age-gate'

/** Флоу власника закладу: подати → «На модерації» → редагувати → м'яке видалення. */
test.describe.serial('Володіння закладом', () => {
  const NAME = `E2E Тестовий бар ${Date.now() % 100000}`

  let stateFile = ''
  let venuePath = ''

  test('подання закладу юзером → статус «На модерації» у «Мої заклади»', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await registerE2eUser(page)
    stateFile = `/tmp/piyachok-e2e-owner-${Date.now() % 100000}.json`
    await page.context().storageState({ path: stateFile })

    await page.goto('/venues/new')
    await page.locator('#vn-name').fill(NAME)
    await page.locator('#vn-address').fill('м. Хмельницький, вул. E2E Тестова, 1')
    await page.locator('#vn-description').fill('Заклад поданий автоматичним браузерним прогоном.')
    await page.getByLabel(/Широта/).fill('50.4501')
    await page.getByLabel(/Довгота/).fill('26.5234')
    await page.getByRole('button', { name: 'Подати заклад' }).click()

    // редірект у «Мої заклади»; заклад зі статусом «На модерації»
    await expect(page).toHaveURL(/\/account\/venues/)
    await expect(page.getByRole('heading', { name: 'Мої заклади' })).toBeVisible()
    const card = page.getByText(NAME).first()
    await expect(card).toBeVisible()
    // статус — у тій же карточці рядком «На модерації»
    const venueId = await page.evaluate((name) => {
      const el = [...document.querySelectorAll('a')].find((a) => (a.textContent ?? '').includes(name))
      return el?.getAttribute('href')?.split('/').pop()
    }, NAME)
    expect(venueId).toBeTruthy()
    venuePath = `/account/venues/${venueId}`

    // публічно не зʼявляється в каталозі (pending)
    await page.goto('/venues')
    await page.waitForSelector('label:has(input[name="q"]), a[href^="/venues/"]', { timeout: 15_000 })
    await expect(page.getByText(NAME)).toHaveCount(0)
    await ctx.close()
  })

  test('редагування закладу власником і мʼяке видалення', async ({ browser }) => {
    test.skip(!stateFile, 'потрібна сесія з попереднього тесту')
    const ctx = await browser.newContext({ storageState: stateFile })
    const page = await ctx.newPage()
    await skipAgeGate(page)

    await page.goto(venuePath)
    await expect(page.getByText('На модерації').first()).toBeVisible()

    // редагування опису — таб «...?tab=edit» на сторінці керування закладом
    await page.goto(`${venuePath}?tab=edit`)
    await page.getByLabel('Опис').fill('Заклад поданий автоматичним прогоном — опис оновлено.')
    await page.getByRole('button', { name: 'Зберегти зміни' }).click()
    await expect(page.getByText(/Збережено|ообновлено|оновлено/i).first()).toBeVisible()
    await ctx.close()
  })
})