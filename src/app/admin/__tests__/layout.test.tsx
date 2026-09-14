import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetch: (...args: unknown[]) => serverFetch(...args),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`) }),
  usePathname: vi.fn(() => '/admin'),
}))

import AdminLayout from '@/app/admin/layout'
import { getSessionTokens } from '@/lib/auth/session'
import type { SessionUser } from '@/types/user'

const superAdmin: SessionUser = { id: 'u1', email: 'e@x.c', roles: ['super_admin'] }

async function renderLayout(): Promise<string> {
  return renderToStaticMarkup(await AdminLayout({ children: <div id="children-probe">ТЕСТ-CHILDREN</div> }))
}

describe('/admin layout', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    vi.mocked(getSessionTokens).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' })
  })

  it('не-super_admin → redirect /', async () => {
    serverFetch.mockResolvedValueOnce({ id: 'u1', email: 'e@x.c', roles: ['user'] })
    await expect(renderLayout()).rejects.toThrow('REDIRECT:/')
  })

  it('venue_admin (не super_admin) → redirect /', async () => {
    serverFetch.mockResolvedValueOnce({ id: 'u1', email: 'e@x.c', roles: ['venue_admin'] })
    await expect(renderLayout()).rejects.toThrow('REDIRECT:/')
  })

  it('мертва сесія (serverFetch кидає) → redirect /', async () => {
    serverFetch.mockRejectedValueOnce(new Error('401'))
    await expect(renderLayout()).rejects.toThrow('REDIRECT:/')
  })

  it('без сесії (немає токенів) → redirect / без фетчу', async () => {
    vi.mocked(getSessionTokens).mockResolvedValue(null)
    await expect(renderLayout()).rejects.toThrow('REDIRECT:/')
    expect(serverFetch).not.toHaveBeenCalled()
  })

  it('super_admin рендерить заголовок, nav і children', async () => {
    serverFetch.mockResolvedValueOnce(superAdmin)
    const html = await renderLayout()
    expect(html).toContain('Адмінка')
    expect(html).toContain('Огляд')
    expect(html).toContain('/admin/venues')
    expect(html).toContain('ТЕСТ-CHILDREN')
    expect(serverFetch).toHaveBeenCalledWith('/auth/me', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
  })
})
