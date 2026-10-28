import { test, expect } from '@playwright/test'
import { loginViaUI } from '../helpers/accounts'
import { skipAgeGate } from '../helpers/age-gate'

const ABOUT_SEED = 'Пиячок — український каталог барів, пабів і гастропабів Хмельницького з відгуками від відвідувачів, спільнотними зустрічами «пиячок» і добірками «Топ» від редакції.'

let adminState = ''
export const adminSessionFile = () => adminState

test.describe.serial('Адмінпанель', () => {
  test('логін суперадміна і огляд /admin', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await loginViaUI(page, 'admin@gmail.com', 'Admin1234')
    adminState = `/tmp/piyachok-e2e-admin-${Date.now() % 100000}.json`
    await page.context().storageState({ path: adminState })

    await page.goto('/admin')
    await expect(page.getByRole('main')).toBeVisible()
    await ctx.close()
  })

  async function adminPage(browser: import('@playwright/test').Browser) {
    const ctx = await browser.newContext({ storageState: adminState })
    const page = await ctx.newPage()
    await skipAgeGate(page)
    return page
  }

  test('/admin для юзера без ролей — не контент адмінки', async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await skipAgeGate(page)
    await loginViaUI(page, 'user1@gmail.com', 'User1234')
    await page.goto('/admin')
    // рендер — або редірект, або явна відмова; контенту керування бути не має
    await expect(page.getByRole('heading', { name: /Користувачі|Заклади/ })).toHaveCount(0)
    await ctx.close()
  })

  test('заклад на модерації: апрув через /admin/venues → зʼявляється у каталозі', async ({ browser }) => {
    // юзер2 подає заклад
    const ctxU = await browser.newContext()
    const pageU = await ctxU.newPage()
    await skipAgeGate(pageU)
    await loginViaUI(pageU, 'user2@gmail.com', 'User1234')
    const NAME = `E2E Адмін бар ${Date.now() % 100000}`
    await pageU.goto('/venues/new')
    await pageU.locator('#vn-name').fill(NAME)
    await pageU.locator('#vn-address').fill('м. Хмельницький, вул. E2E Адмінська, 2')
    await pageU.locator('#vn-description').fill('Подано для тесту апруву адміном.')
    await pageU.getByLabel(/Широта/).fill('50.4501')
    await pageU.getByLabel(/Довгота/).fill('26.5234')
    await pageU.getByRole('button', { name: 'Подати заклад' }).click()
    await expect(pageU).toHaveURL(/\/account\/venues/)

    // суперадмін апрувить на /admin/venues
    const page = await adminPage(browser)
    await page.goto('/admin/venues')
    // кнопка апруву саме в рядку нашого закладу (li з назвою)
    const row = page.locator('li', { has: page.getByText(NAME).first() })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: 'Схвалити' }).click()
    await expect(page.getByText('Заклад схвалено').first()).toBeVisible()

    // заклад тепер у публічному каталозі
    await page.goto('/venues')
    await page.waitForSelector('a[href^="/venues/"]')
    await expect(page.getByText(NAME).first()).toBeVisible()
    await page.context().close()
    await ctxU.close()
  })

  test('модерація відгуків: редагування тексту з /admin/reviews', async ({ browser }) => {
    const page = await adminPage(browser)
    await page.goto('/admin/reviews')
    await page.waitForSelector('a[href^="/venues/"], table')
    // відгуки рендеряться і мають дії; без шкоди для демо-даних зберігаємо
    // незмінений текст (валідовані поля + toast успіху)
    const editButton = page.getByRole('button', { name: 'Редагувати' }).first()
    await expect(editButton).toBeVisible()
    await editButton.click()
    const textarea = page.getByRole('dialog').locator('textarea')
    await expect(textarea).toBeVisible()
    await page.getByRole('button', { name: 'Зберегти' }).click()
    await expect(page.getByText(/Збережено|оновлено/i).first()).toBeVisible()
    await page.context().close()
  })

  test('глобальна новина: створити через /admin/news → видно на /news → видалити', async ({ browser }) => {
    test.setTimeout(240_000) // ISR /news (revalidate=60) — пули нижче
    const page = await adminPage(browser)
    const TITLE = `E2E новина для каталогу ${Date.now() % 100000}`
    await page.goto('/admin/news')
    const form = page.locator('form[aria-label="Створення новини"]')
    await form.getByLabel('Заголовок новини').fill(TITLE)
    await form.getByLabel('Текст новини').fill('Текст новини, створеної автоматичним браузерним прогоном, достатньо довгий.')
    await form.getByRole('button', { name: 'Створити новину' }).click()
    await expect(page.getByText(/створено|Створено/i).first()).toBeVisible()

    // /news = ISR (revalidate=60): кеш оновлюється у фоні — довший пул
    await expect.poll(async () => {
      await page.goto('/news')
      return (await page.getByText(TITLE).count()) > 0
    }, { timeout: 150_000, intervals: [2_000, 15_000] }).toBe(true)

    // чистка: новина з маркером E2E не лишається в каталозі
    await page.goto('/admin/news')
    const li = page.locator('li', { has: page.getByText(TITLE).first() })
    await expect(li).toBeVisible()
    await li.getByRole('button', { name: 'Видалити' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Так, видалити' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()
    // в адмін-списку (revalidate=0) статус одразу «Заархівована»
    await page.goto('/admin/news')
    const liArch = page.locator('li', { has: page.getByText(TITLE).first() })
    await expect(liArch.getByText('Видалити')).toHaveCount(0)
    // публічна стрічка (ISR, revalidate=60) оновиться пізніше
    await expect.poll(async () => {
      await page.goto('/news')
      return (await page.getByText(TITLE).count()) === 0
    }, { timeout: 150_000, intervals: [2_000, 15_000] }).toBe(true)
    await page.context().close()
  })

  test('site_content: «Про нас» оновлюється і видно на /about, після чого відновлено сід', async ({ browser }) => {
    const page = await adminPage(browser)
    const MARKER = 'E2E марка контенту'
    await page.goto('/admin/content')
    const about = page.locator('#about')
    await about.fill(`${ABOUT_SEED} ${MARKER}`)
    await page.getByRole('button', { name: 'Зберегти «Про нас»' }).click()
    await expect(page.getByText('Текст оновлено').first()).toBeVisible()

    await page.goto('/about')
    await expect(page.getByText(MARKER)).toBeVisible()

    // відновлення сідного тексту
    await page.goto('/admin/content')
    await page.locator('#about').fill(ABOUT_SEED)
    await page.getByRole('button', { name: 'Зберегти «Про нас»' }).click()
    await expect(page.getByText('Текст оновлено').first()).toBeVisible()
    await page.context().close()
  })

  test('/top, /admin/analytics, /admin/messages, /admin/complaints, /admin/top рендеряться', async ({ browser }) => {
    const page = await adminPage(browser)
    for (const path of ['/admin/analytics', '/admin/messages', '/admin/complaints', '/admin/top']) {
      await page.goto(path)
      await expect(page.getByRole('main')).toBeVisible()
    }
    await page.context().close()
  })

  test('юзери: таблиця містить свіжий e2e-аккаунт, деталька рендериться', async ({ browser }) => {
    const page = await adminPage(browser)
    await page.goto('/admin/users')
    await expect(page.locator('table')).toBeVisible()
    // нещодавно зареєстрований e2e-юзер 04/05 — найновіший зверху таблиці
    await expect(page.getByText('e2e-web-').first()).toBeVisible()
    // деталька першого юзера
    await page.locator('table a[href^="/admin/users/"]').last().click()
    await expect(page.getByRole('main')).toBeVisible()
    await page.context().close()
  })
})