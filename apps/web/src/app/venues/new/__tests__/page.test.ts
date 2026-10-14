import { describe, expect, it, vi } from 'vitest'

// redirect() кидає спеціальний NEXT_REDIRECT — мокаємо, щоб тестувати лише наш виклик.
// useRouter теж мокаємо: клієнтська форма імпортує next/navigation.
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const getSessionTokens = vi.fn()
vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: (...args: unknown[]) => getSessionTokens(...args),
}))

import NewVenuePage from '@/app/venues/new/page'

describe('/venues/new (guard)', () => {
  it('без токенів → редірект на логін з next=/venues/new', async () => {
    getSessionTokens.mockResolvedValue(null)
    await expect(NewVenuePage()).rejects.toThrow('REDIRECT:/auth/login?next=/venues/new')
  })

  it('з токенами → рендерить форму подання', async () => {
    getSessionTokens.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
    const { renderToStaticMarkup } = await import('react-dom/server')
    const html = renderToStaticMarkup(await NewVenuePage())
    expect(html).toContain('Подати заклад')
    expect(html).toContain('Створення закладу')
  })
})
