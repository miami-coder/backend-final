import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
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
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// island — клієнтський (useToast): у server-тесті замінюємо на стаб
vi.mock('@/components/features/admin/admin-news-create-form', () => ({
  AdminNewsCreateForm: () => createElement('div', null, 'create-form-stub'),
}))
vi.mock('@/components/features/admin/admin-news-actions', () => ({
  AdminNewsActions: () => createElement('div', null, 'news-actions-stub'),
}))

import AdminNewsPage from '@/app/admin/news/page'
import { getSessionTokens } from '@/lib/auth/session'
import type { RawNews } from '@/types/news'

const rawNews = (overrides: Partial<RawNews> = {}): RawNews => ({
  id: 'n1',
  venueId: null,
  category: 'general',
  title: 'Заголовок новини',
  content: 'Текст новини, достатньо довгий для парсера',
  imageUrl: null,
  status: 'published',
  isPromoted: false,
  publishedAt: '2026-09-01T10:00:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
  ...overrides,
})

const FETCH_OPTS = {
  tokens: { accessToken: 'a', refreshToken: 'r' },
  revalidate: 0,
}

async function renderPage(searchParams: { page?: string; status?: string } = {}): Promise<string> {
  return renderToStaticMarkup(
    await AdminNewsPage({ searchParams: Promise.resolve(searchParams) }),
  )
}

describe('/admin/news — список новин', () => {
  beforeEach(() => {
    serverFetchList.mockReset()
    vi.mocked(getSessionTokens).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
    serverFetchList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } })
  })

  it('без параметра: GET /admin/news?page=1 без status; таби Усі/Опубліковані/Чернетки/Заархівовані', async () => {
    const html = await renderPage()
    expect(serverFetchList).toHaveBeenCalledWith('/admin/news?page=1', FETCH_OPTS)
    // таби-лінки: Усі → без параметра, решта → ?status=
    expect(html).toContain('href="/admin/news"')
    expect(html).toContain('href="/admin/news?status=published"')
    expect(html).toContain('href="/admin/news?status=draft"')
    expect(html).toContain('href="/admin/news?status=archived"')
  })

  it('?status=draft → у запиті status=draft', async () => {
    await renderPage({ status: 'draft' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/news?page=1&status=draft', FETCH_OPTS)
  })

  it('?status=zzz (невідомий) → без status у запиті (= Усі)', async () => {
    await renderPage({ status: 'zzz' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/news?page=1', FETCH_OPTS)
  })

  it('рядки: статус-бейджі з NEWS_STATUS_LABELS, категорія, заголовок, дата', async () => {
    serverFetchList.mockResolvedValue({
      data: [
        rawNews({ id: 'n1', status: 'published', category: 'promo' }),
        rawNews({ id: 'n2', status: 'draft', category: 'general' }),
        rawNews({ id: 'n3', status: 'archived', category: 'event' }),
      ],
      meta: { page: 1, limit: 20, total: 3, hasMore: false },
    })
    const html = await renderPage()
    expect(html).toContain('Опубліковано')
    expect(html).toContain('Чернетка')
    expect(html).toContain('Заархівовано')
    expect(html).toContain('Акції')
    expect(html).toContain('Загальне')
    expect(html).toContain('Події')
    expect(html).toContain('Заголовок новини')
    expect(html).toContain('вересня')
  })

  it('лінк на /news/[id] тільки для published: draft не лінкується', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawNews({ id: 'n1', status: 'published' }), rawNews({ id: 'n2', status: 'draft' })],
      meta: { page: 1, limit: 20, total: 2, hasMore: false },
    })
    const html = await renderPage()
    expect(html).toContain('href="/news/n1"')
    expect(html).not.toContain('href="/news/n2"')
  })

  it('meta.total > limit → Pagination, href зберігає статус', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawNews()],
      meta: { page: 1, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage({ status: 'draft' })
    expect(html).toContain('aria-label="Пагінація"')
    // & у href рендериться як &amp;
    expect(html).toContain('/admin/news?page=2&amp;status=draft')
  })

  it('порожній список → повідомлення про відсутність новин', async () => {
    const html = await renderPage()
    expect(html).toContain('Новин немає.')
  })

  it('форма створення відрендерена над списком', async () => {
    const html = await renderPage()
    expect(html).toContain('create-form-stub')
  })
})
