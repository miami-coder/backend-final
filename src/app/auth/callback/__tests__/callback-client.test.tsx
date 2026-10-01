import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const replaceState = vi.fn()
const routerReplace = vi.fn()
const locationReplace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => new URLSearchParams('access=AT&refresh=RT'),
}))

import { CallbackClient } from '@/app/auth/callback/callback-client'

const okRes = () => new Response(JSON.stringify({ ok: true }), { status: 200 })

beforeEach(() => {
  replaceState.mockClear()
  routerReplace.mockClear()
  locationReplace.mockClear()
  vi.restoreAllMocks()
  vi.spyOn(window.history, 'replaceState').mockImplementation(replaceState)
  vi.stubGlobal('location', { ...window.location, replace: locationReplace })
})

describe('CallbackClient', () => {
  it('надсилає токени ТІЛОМ на /api/auth/oauth, потім ПОВНЕ перевантаження на /', async () => {
    const fetchMock = vi.fn(async () => okRes())
    vi.stubGlobal('fetch', fetchMock)
    render(<CallbackClient />)
    await waitFor(() => expect(locationReplace).toHaveBeenCalledWith('/'))
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/auth/oauth')
    // токени йдуть ТІЛОМ, не в URL: URL чистий, а тіло містить обидва токени
    expect(url).not.toContain('AT')
    expect(url).not.toContain('access=')
    expect(url).not.toContain('refresh=')
    expect(String(init.body)).toContain('"accessToken":"AT"')
    expect(String(init.body)).toContain('"refreshToken":"RT"')
    // Дефект софт-переходу: router.replace('/') не перевитягує /auth/me у
    // layout — хедер лишається «Увійти», доки користувач не перезайде сам.
    // Тому перехід робимо повним навантаженням (cookie вже в контейнері),
    // і location.replace витирає callback-URL з історії сам.
    expect(routerReplace).not.toHaveBeenCalled()
    expect(locationReplace.mock.calls.map(String).every((u) => !u.includes('access=') && !u.includes('refresh='))).toBe(true)
  })

  it('невалідні токени: витирає URL і показує помилку з посиланням на логін (без навігації)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 401 })))
    render(<CallbackClient />)
    await waitFor(() => expect(screen.getByRole('link', { name: /Спробувати знову/ })).toBeInTheDocument())
    expect(replaceState).toHaveBeenCalledWith(null, '', '/auth/login')
    expect(locationReplace).not.toHaveBeenCalled()
  })
})
