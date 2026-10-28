import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { ensureE2eUser, liveE2eStatePath } from '../helpers/accounts'
import { skipAgeGate } from '../helpers/age-gate'

/** Спільний e2e-юзер на весь файл: реєстрація вичерпує квоту бек-тротлера
 *  (5/год), тому кабінет ганяється послідовно під однією сесією. */
let stateFile = ''
let venueName = ''
let venueHref = ''

async function firstApprovedVenue(): Promise<{ id: string; name: string }> {
  const res = await fetch('http://localhost:3000/api/v1/venues?page=1&limit=1')
  const body = await res.json()
  const item = body.data?.[0] ?? body.items?.[0] ?? body[0]
  return { id: item.id, name: item.name }
}

test.describe.serial('Кабінет', () => {
  test.beforeAll(async () => {
    // перший сідний approved-заклад для флоу favorites/reviews
    const v = await firstApprovedVenue()
    venueName = v.name
    venueHref = v.id
  })

  test('сесія e2e-юзера і огляд /account', async ({ browser }) => {
    // живий e2e-юзер з 03 (або свіжий, якщо 03 не ганявся) —
    // реєстрації лікують квоту бек-тротлера, перевикористання економить їх
    await ensureE2eUser(browser)
    stateFile = liveE2eStatePath()!
    expect(stateFile).toBeTruthy()
    const ctx = await browser.newContext({ storageState: stateFile })
    const page = await ctx.newPage()
    await skipAgeGate(page)
    await page.goto('/account')
    await expect(page.getByRole('heading', { name: 'Профіль' })).toBeVisible()
    await ctx.close()
  })

  async function sessionPage(browser: Browser): Promise<Page> {
    const ctx = await browser.newContext({ storageState: stateFile })
    const page = await ctx.newPage()
    // новий контекст = новий localStorage: гейт 18+ знову з'явиться
    await skipAgeGate(page)
    return page
  }

  test('favorites: додати → є у /account/favorites → прибрати', async ({ browser }) => {
    const page = await sessionPage(browser)
    await page.goto(`/venues/${venueHref}`)
    await page.getByRole('button', { name: 'Додати до обраного' }).click()
    // перемикач кнопки = імовірність, що POST/DELETE дійшов і записано
    await expect(page.getByRole('button', { name: 'В обраному' })).toBeVisible({ timeout: 10_000 })
    await page.goto('/account/favorites')
    await expect(page.getByText(venueName).first()).toBeVisible()

    // прибрати з обраного прямо у списку — чекаємо DELETE, інакше
    // навігація обжене запит і свіжа сторінка покаже заклад (флейт)
    const delDone = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().includes('/favorites/'))
    await page.getByRole('button', { name: 'Прибрати' }).first().click()
    await delDone
    // списку більше немає
    await page.goto('/account/favorites')
    await expect(page.getByText(venueName).first()).toBeHidden()
    await page.context().close()
  })

  test('відгук: створити → бачу в /account/reviews → редагувати → видалити', async ({ browser }) => {
    const page = await sessionPage(browser)
    await page.goto(`/venues/${venueHref}`)
    // рейтинг 4 зірки
    await page.locator('label:has(input[name="rating"])').nth(3).click()
    await page.locator('#review-bill').fill('350')
    const RE = 'E2E відгук про заклад, дуже душевно'
    await page.locator('#review-text').fill(RE)
    await page.getByRole('button', { name: 'Надіслати відгук' }).click()

    await page.goto('/account/reviews')
    await expect(page.getByText(RE).first()).toBeVisible()

    // редагування — форма на карточці закладу перемикається в режим редагування
    await page.goto(`/venues/${venueHref}`)
    await page.getByRole('button', { name: 'Редагувати' }).click()
    await page.locator('#review-text').fill('E2E відгук оновлений — теж душевно')
    await page.getByRole('button', { name: 'Зберегти зміни' }).click()

    // видалення — кнопка відкриває модалку підтвердження
    await page.getByRole('button', { name: 'Видалити' }).first().click()
    const modal = page.getByRole('dialog')
    if (await modal.count()) {
      await modal.getByRole('button', { name: 'Видалити' }).click()
    }
    await expect(page.getByText('Відгук видалено').first()).toBeVisible()
    await page.context().close()
  })

  test('юзер без права критика: кнопки «Рекомендувати» немає, сторінка рекомендацій порожня', async ({ browser }) => {
    const page = await sessionPage(browser)
    await page.goto(`/venues/${venueHref}`)
    // Рекомендувати можуть лише критик/суперадмін (venue:recommend) —
    // перемикаючий флоу покриває 06-admin під суперадміном
    await expect(page.getByRole('button', { name: 'Рекомендувати' })).toHaveCount(0)
    await page.goto('/account/recommendations')
    await expect(page.locator('main')).toBeVisible()
    await page.context().close()
  })

  test('порожні вкладки рендеряться спокійно: hangouts, venues, messages', async ({ browser }) => {
    const page = await sessionPage(browser)
    for (const path of ['/account/hangouts', '/account/venues', '/account/messages']) {
      await page.goto(path)
      await expect(page.locator('main')).toBeVisible()
    }
    await page.context().close()
  })
})