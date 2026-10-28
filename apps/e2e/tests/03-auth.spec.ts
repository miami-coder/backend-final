import { test, expect } from '@playwright/test'
import { E2E_PASSWORD, e2eUserEmail, headerLoginLink, loginViaUI, logoutViaUI, registerE2eUser } from '../helpers/accounts'
import { skipAgeGate } from '../helpers/age-gate'

test.describe('Реєстрація', () => {
  test('успішна реєстрація: сесія стоїть, гість → хедер юзера', async ({ page }) => {
    await registerE2eUser(page)
  })

  test('без EULA — приймається валідація, акаунт не створюється', async ({ page }) => {
    await skipAgeGate(page)
    const email = e2eUserEmail()
    await page.goto('/auth/register')
    await page.getByLabel(/Ім/).fill('Іван')
    await page.getByLabel('Прізвище').fill('Проходько')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Пароль').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Зареєструватися' }).click()
    await expect(page).toHaveURL(/auth\/register/)
    await expect(page.getByText('Потрібно прийняти угоду')).toBeVisible()
    // не залогінились: хедер досі гостя
    await expect(headerLoginLink(page)).toBeVisible()
  })

  test('слабкий пароль (без великої літери і цифри) — валідація клієнта', async ({ page }) => {
    await skipAgeGate(page)
    await page.goto('/auth/register')
    await page.getByLabel(/Ім/).fill('Іван')
    await page.getByLabel('Прізвище').fill('Проходько')
    await page.getByLabel('Email').fill(e2eUserEmail())
    await page.getByLabel('Пароль').fill('слабкийпароль')
    await page.getByLabel(/Вік/).fill('25')
    await page.locator('input[type="checkbox"]').last().check()
    await page.getByRole('button', { name: 'Зареєструватися' }).click()
    await expect(page).toHaveURL(/auth\/register/)
    await expect(page.locator('form [role="alert"]')).toBeVisible()
  })

  test('зайнятий email — 409 з текстом бекенда', async ({ page }) => {
    await skipAgeGate(page)
    await page.goto('/auth/register')
    await page.getByLabel(/Ім/).fill('Іван')
    await page.getByLabel('Прізвище').fill('Проходько')
    await page.getByLabel('Email').fill('user1@gmail.com')
    await page.getByLabel('Пароль').fill(E2E_PASSWORD)
    await page.getByLabel(/Вік/).fill('25')
    await page.locator('input[type="checkbox"]').last().check()
    await page.getByRole('button', { name: 'Зареєструватися' }).click()
    await expect(page).toHaveURL(/auth\/register/)
    await expect(page.locator('form [role="alert"]')).toContainText(/4?09|зайнят|вже/i)
  })
})

test.describe('Вхід / вихід', () => {
  test('вхід сидним юзером і вихід', async ({ page }) => {
    await loginViaUI(page, 'user1@gmail.com', 'User1234')
    await logoutViaUI(page)
  })

  test('невірний пароль — повідомлення бекенда, сесії немає', async ({ page }) => {
    await skipAgeGate(page)
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('user1@gmail.com')
    await page.getByLabel('Пароль').fill('WrongPass1')
    await page.getByRole('button', { name: 'Увійти' }).click()
    await expect(page.locator('form [role="alert"]')).toContainText('Невірний email або пароль')
    await expect(headerLoginLink(page)).toBeVisible()
  })

  test('невідомий email — «Невірний email або пароль»', async ({ page }) => {
    await skipAgeGate(page)
    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('no-such@x.com')
    await page.getByLabel('Пароль').fill('WrongPass1')
    await page.getByRole('button', { name: 'Увійти' }).click()
    await expect(page.locator('form [role="alert"]')).toContainText('Невірний email або пароль')
  })
})