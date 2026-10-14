import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetchList = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetchList: (...args: unknown[]) => serverFetchList(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

import AdminUsersPage from '@/app/admin/users/page'
import { getSessionTokens } from '@/lib/auth/session'
import type { RawAdminUser } from '@/types/admin'

const rawUser = (overrides: Partial<RawAdminUser> = {}): RawAdminUser => ({
  id: 'u1',
  email: 'olya@example.com',
  createdAt: '2026-09-01T10:00:00.000Z',
  roles: ['user'],
  profile: { firstname: 'Оля', lastname: 'Ковальчук', phone: null, age: null, avatarUrl: null },
  ...overrides,
})

async function renderPage(searchParams: { page?: string } = {}): Promise<string> {
  return renderToStaticMarkup(await AdminUsersPage({ searchParams: Promise.resolve(searchParams) }))
}

describe('/admin/users — список користувачів', () => {
  beforeEach(() => {
    serverFetchList.mockReset()
    vi.mocked(getSessionTokens).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
    serverFetchList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } })
  })

  it('page=1: GET /admin/users?page=1 → email-посилання, імʼя, бейджі ролей, дата', async () => {
    serverFetchList.mockResolvedValue({
      data: [
        rawUser({ id: 'u1', roles: ['user', 'critic'] }),
        rawUser({ id: 'u2', email: 'bohdan@example.com', roles: ['super_admin'] }),
      ],
      meta: { page: 1, limit: 20, total: 2, hasMore: false },
    })
    const html = await renderPage()
    expect(serverFetchList).toHaveBeenCalledWith('/admin/users?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    // email — посилання на детальку
    expect(html).toContain('href="/admin/users/u1"')
    expect(html).toContain('olya@example.com')
    // ROLE_LABELS-бейджі
    expect(html).toContain('Користувач')
    expect(html).toContain('Критик')
    expect(html).toContain('Супер-адмін')
    // імʼя з профілю + formatDate
    expect(html).toContain('Оля Ковальчук')
    expect(html).toContain('вересня')
  })

  it('profile null → рядок без імені, email-посилання залишається', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawUser({ profile: null })],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).toContain('href="/admin/users/u1"')
    expect(html).not.toContain('Ковальчук')
  })

  it('searchParams.page → ?page=N у запиті і в hrefFor', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawUser()],
      meta: { page: 2, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage({ page: '2' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/users?page=2', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    expect(html).toContain('/admin/users?page=3')
  })

  it('meta.total > limit → навігація Pagination (totalPages рахуємо самі)', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawUser()],
      meta: { page: 1, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage()
    expect(html).toContain('aria-label="Пагінація"')
    expect(html).toContain('/admin/users?page=2')
  })

  it('meta.total <= limit → Pagination повертає null (без навігації)', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawUser()],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).not.toContain('aria-label="Пагінація"')
  })

  it('порожній список → повідомлення про відсутність користувачів', async () => {
    const html = await renderPage()
    expect(html).toContain('Користувачів немає.')
  })

  it('некоректний page → клампиться до 1', async () => {
    await renderPage({ page: '0' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/users?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
  })
})
