import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetch = vi.fn()
const serverFetchList = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetch: (...args: unknown[]) => serverFetch(...args),
  serverFetchList: (...args: unknown[]) => serverFetchList(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  usePathname: vi.fn(() => '/admin'),
}))

import AdminOverviewPage from '@/app/admin/page'
import { getSessionTokens } from '@/lib/auth/session'

const meta = (total: number) => ({ page: 1, limit: 1, total, hasMore: total > 1 })

const overview = {
  totalViews: 1234,
  totalEvents: 567,
  eventsByType: [{ eventType: 'venue_view', count: 900 }],
}

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await AdminOverviewPage())
}

describe('/admin огляд', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    serverFetchList.mockReset()
    vi.mocked(getSessionTokens).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
    serverFetch.mockResolvedValue(overview)
    serverFetchList.mockResolvedValue({ data: [], meta: meta(7) })
  })

  it('рендерить 6 плиток: аналітика з overview + лічильники з meta.total', async () => {
    const html = await renderPage()
    expect(html).toContain('1234')
    expect(html).toContain('567')
    expect(html).toContain('Перегляди')
    expect(html).toContain('Події')
    expect(html).toContain('Заклади на модерації')
    expect(html).toContain('Користувачі')
    expect(html).toContain('Скарги')
    expect(html).toContain('Новини')
    for (const path of ['/admin/venues/pending?limit=1', '/admin/users?limit=1', '/admin/complaints?limit=1', '/admin/news?limit=1']) {
      expect(serverFetchList).toHaveBeenCalledWith(path, { tokens: { accessToken: 'a', refreshToken: 'r' }, revalidate: 0 })
    }
    expect(serverFetch).toHaveBeenCalledWith('/admin/analytics/overview', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
  })

  it('лічильники секцій беруться з meta.total', async () => {
    serverFetchList.mockImplementation((path: string) =>
      Promise.resolve({ data: [], meta: meta(path === '/admin/venues/pending?limit=1' ? 3 : 42) }),
    )
    const html = await renderPage()
    expect(html).toContain('3')
    expect(html).toContain('42')
  })

  it('overview недоступний → плитки аналітики показують «—», списки не страждають', async () => {
    serverFetch.mockRejectedValueOnce(new Error('500'))
    const html = await renderPage()
    expect(html).toContain('Перегляди')
    expect(html).toContain('—')
    expect(html).not.toContain('1234')
    // списки продовжують віддавати meta.total
    expect(html).toContain('7')
  })

  it('списки НЕ ловляться (падають → помилка сторінки)', async () => {
    serverFetchList.mockRejectedValue(new Error('500'))
    await expect(renderPage()).rejects.toThrow('500')
  })
})
