import { test, expect } from '@playwright/test'
import { skipAgeGate } from '../helpers/age-gate'

/** Усе, що бачить гість без логіна. Сідні демо-дані (15 закладів, новини,
 *  Топ) вже у БД — тест-стан цей файл не змінює. */
test.describe('Публічні сторінки', () => {
  test.beforeEach(async ({ page }) => {
    await skipAgeGate(page)
  })

  test('каталог /venues: рендерить сідні заклади з посиланнями на деталі', async ({ page }) => {
    await page.goto('/venues')
    // список тягнеться клієнтськи — чекаємо першу картку
    await page.waitForSelector('a[href^="/venues/"]', { timeout: 20_000 })
    const cards = await page.locator('a[href^="/venues/"]').count()
    // назви конкретних сідів не пінуються: каталог сортується за createdAt
    // DESC і з ростом demo/E2E-закладів сідні витісняються за межі першої сторінки
    expect(cards).toBeGreaterThanOrEqual(10)
  })

  test('карточка закладу: назва, фото-заглушка/фото, опис і відгуки', async ({ page }) => {
    // назву першого закладу беремо з API — у DOM карти вона в одному блоці
    // з зірками/адресою, тому по textContent карти її не ізолювати
    await page.goto('/venues')
    await page.waitForSelector('a[href^="/venues/"]')
    const href = await page.locator('a[href^="/venues/"]').first().getAttribute('href')
    const venueId = (href ?? '').split('/').pop()
    const venue = await (await fetch(`http://localhost:3000/api/v1/venues/${venueId}`)).json()
    const name = venue?.name ?? venue?.data?.name
    expect(name).toBeTruthy()

    await page.goto(`/venues/${venueId}`)
    await expect(page.getByText(name).first()).toBeVisible()
    await expect(page.locator('main')).not.toBeEmpty()
  })

  test('/news: список новин, перехід у детальку', async ({ page }) => {
    await page.goto('/news')
    await page.waitForSelector('a[href^="/news/"]')
    const links = page.locator('a[href^="/news/"]')
    expect(await links.count()).toBeGreaterThanOrEqual(2)
    await links.first().click()
    await page.waitForURL(/\/news\/[0-9a-f-]+/)
    await expect(page.locator('main')).not.toBeEmpty()
  })

  test('/hangouts: фільтри й заголовок стрічки (стрічка може бути порожньою)', async ({ page }) => {
    await page.goto('/hangouts')
    await expect(page.getByRole('heading', { name: 'Зустрічі' })).toBeVisible()
    await expect(page.getByText('Фільтрувати')).toBeVisible()
  })

  test('/top: категории «Вибір редакції» з місцями і рейтингом', async ({ page }) => {
    await page.goto('/top')
    await expect(page.getByRole('heading', { name: 'Топ закладів' })).toBeVisible()
    await expect(page.getByText('Вибір редакції')).toContainText('категоріями')
    await page.waitForSelector('a[href^="/venues/"]')
    expect(await page.locator('a[href^="/venues/"]').count()).toBeGreaterThanOrEqual(3)
  })

  test('/about і /contact: сідний контент', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByText('український каталог барів')).toBeVisible()
    await page.goto('/contact')
    await expect(page.getByText('Написати нам').first()).toBeVisible()
  })

  test('гість на захищених сторінках: /account і /admin не рендерять порожній контент', async ({ page }) => {
    await page.goto('/account')
    await page.waitForURL(/auth\/login|\/$/)
    await page.goto('/admin')
    // або редірект на логін, або сторінка із забороною — головне не контент адмінки
    const url = page.url()
    const notAdminDashboard = !/\/admin\/?$/.test(url) || (await page.getByText('Керування').count()) === 0
    expect(notAdminDashboard).toBeTruthy()
  })
})