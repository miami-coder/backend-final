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
}))

// island — клієнтський (useToast): у server-тесті замінюємо на стаб
vi.mock('@/components/features/admin/complaint-resolve-button', async () => ({
  ComplaintResolveButton: ({ complaintId }: { complaintId: string }) =>
    createElement('span', null, `resolve:${complaintId}`),
}))

import AdminComplaintsPage from '@/app/admin/complaints/page'
import { getSessionTokens } from '@/lib/auth/session'
import type { RawComplaint } from '@/types/admin'

const rawComplaint = (overrides: Partial<RawComplaint> = {}): RawComplaint => ({
  id: 'c1',
  venueId: null,
  reviewId: null,
  reason: 'other',
  text: 'Тут продають неіснуючі квитки',
  status: 'New',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...overrides,
})

async function renderPage(searchParams: { page?: string } = {}): Promise<string> {
  return renderToStaticMarkup(
    await AdminComplaintsPage({ searchParams: Promise.resolve(searchParams) }),
  )
}

describe('/admin/complaints — список скарг', () => {
  beforeEach(() => {
    serverFetchList.mockReset()
    vi.mocked(getSessionTokens).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
    serverFetchList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, hasMore: false } })
  })

  it('page=1: GET /admin/complaints?page=1 → reason-бейджі, текст, ціль, дата', async () => {
    serverFetchList.mockResolvedValue({
      data: [
        rawComplaint({ id: 'c1', reason: 'fake_promo', venueId: 'v1' }),
        rawComplaint({ id: 'c2', reason: 'fraud', reviewId: 'r1' }),
      ],
      meta: { page: 1, limit: 20, total: 2, hasMore: false },
    })
    const html = await renderPage()
    expect(serverFetchList).toHaveBeenCalledWith('/admin/complaints?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    // reason-бейджі з COMPLAINT_REASONS
    expect(html).toContain('Фейкова акція')
    expect(html).toContain('Шахрайство')
    // ціль: venueId → «Заклад», reviewId → «Відгук» (текст без лінків)
    expect(html).toContain('Заклад')
    expect(html).toContain('Відгук')
    expect(html).not.toContain('href="/admin/complaints/')
    // текст + formatDate
    expect(html).toContain('Тут продають неіснуючі квитки')
    expect(html).toContain('вересня')
  })

  it('ні venueId, ні reviewId → ціль «—»', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawComplaint()],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).toContain('—')
  })

  it('text довший за 140 символів → обрізаний до 140 + «…»', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawComplaint({ text: 'x'.repeat(141) })],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).toContain('x'.repeat(140) + '…')
    expect(html).not.toContain('x'.repeat(141))
  })

  it('text коротший за 140 → показаний як є, без «…»', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawComplaint()],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).toContain('Тут продають неіснуючі квитки')
    expect(html).not.toContain('…')
  })

  it('meta.total > limit → навігація Pagination (totalPages рахуємо самі)', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawComplaint()],
      meta: { page: 1, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage()
    expect(html).toContain('aria-label="Пагінація"')
    expect(html).toContain('/admin/complaints?page=2')
  })

  it('meta.total <= limit → Pagination повертає null (без навігації)', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawComplaint()],
      meta: { page: 1, limit: 20, total: 1, hasMore: false },
    })
    const html = await renderPage()
    expect(html).not.toContain('aria-label="Пагінація"')
  })

  it('searchParams.page → ?page=N у запиті і в hrefFor', async () => {
    serverFetchList.mockResolvedValue({
      data: [rawComplaint()],
      meta: { page: 2, limit: 20, total: 45, hasMore: true },
    })
    const html = await renderPage({ page: '2' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/complaints?page=2', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    expect(html).toContain('/admin/complaints?page=3')
  })

  it('порожній список → повідомлення про відсутність скарг', async () => {
    const html = await renderPage()
    expect(html).toContain('Скарг немає.')
  })

  it('некоректний page → клампиться до 1', async () => {
    await renderPage({ page: '0' })
    expect(serverFetchList).toHaveBeenCalledWith('/admin/complaints?page=1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
  })
})
