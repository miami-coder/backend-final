import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { FavoriteButton } from '@/components/features/venues/favorite-button'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

const jsonHeaders = { 'content-type': 'application/json' }
const testUser: SessionUser = { id: 'u1', email: 'u1@test.ua', roles: ['user'] }

function jsonRes(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

function renderWithProviders(ui: ReactNode, user: SessionUser | null) {
  return render(
    <UserProvider initialUser={user}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

describe('FavoriteButton', () => {
  it('гість → Link на /auth/login?next=/venues/v1', () => {
    renderWithProviders(<FavoriteButton venueId="v1" initialFavorite={false} />, null)
    const link = screen.getByRole('link', { name: /обране/i })
    expect(link).toHaveAttribute('href', '/auth/login?next=/venues/v1')
  })

  it('клік «додати» → оптимістично ♥, POST успіх → лишається', async () => {
    // UserProvider на монтуванні сам фетчить /auth/me — віддаємо йому сесію,
    // щоб не плутати лічильник викликів із POST-ом обраного
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input) => {
        const url = String(input)
        if (url.endsWith('/auth/me')) return jsonRes({ data: testUser }, 200)
        return jsonRes({ data: { venueId: 'v1' } }, 201)
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FavoriteButton venueId="v1" initialFavorite={false} />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /додати до обраного/i }))
    // оптимістичний стан одразу
    expect(screen.getByRole('button', { name: /в обраному/i })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const favCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/me/favorites/v1'))
    expect(favCall?.[0]).toBe('/api/v1/me/favorites/v1')
    expect((favCall?.[1] as RequestInit | undefined)?.method).toBe('POST')
    // і лишається після відповіді
    expect(screen.getByRole('button', { name: /в обраному/i })).toBeInTheDocument()
  })

  it('POST 500 → відкат + toast помилки', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Internal Server Error', { status: 500 })))
    renderWithProviders(<FavoriteButton venueId="v1" initialFavorite={false} />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /додати до обраного/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/не вдалося/i))
    expect(screen.getByRole('button', { name: /додати до обраного/i })).toBeInTheDocument()
  })

  it('DELETE 200 (порожнє тіло) → зникає з обраного без хибного відкату', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input) => {
        const url = String(input)
        if (url.endsWith('/auth/me')) return jsonRes({ data: testUser }, 200)
        return new Response('', { status: 200 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FavoriteButton venueId="v1" initialFavorite={true} />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /в обраному/i }))
    // оптимістичний стан одразу
    expect(screen.getByRole('button', { name: /додати до обраного/i })).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const favCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/me/favorites/v1'))
    expect(favCall?.[0]).toBe('/api/v1/me/favorites/v1')
    expect((favCall?.[1] as RequestInit | undefined)?.method).toBe('DELETE')
    // відкату не сталося: стан лишається оптимістичним і після відповіді
    expect(screen.getByRole('button', { name: /додати до обраного/i })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
