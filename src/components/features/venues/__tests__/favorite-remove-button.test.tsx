import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { FavoriteRemoveButton } from '@/components/features/venues/favorite-remove-button'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function renderWithProviders(ui: ReactNode) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

describe('FavoriteRemoveButton', () => {
  it('клік → DELETE + router.refresh()', async () => {
    // UserProvider на монтуванні сам фетчить /auth/me — віддаємо йому сесію,
    // щоб не плутати лічильник викликів із DELETE-ом обраного
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async (input) => {
        const url = String(input)
        if (url.endsWith('/auth/me')) {
          return new Response(JSON.stringify({ data: testUser }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }
        return new Response(null, { status: 200 })
      },
    )
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FavoriteRemoveButton venueId="v1" />)
    fireEvent.click(screen.getByRole('button', { name: /Прибрати/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const deleteCall = fetchMock.mock.calls.find(([u]) => String(u).includes('/me/favorites/v1'))
    expect(deleteCall?.[0]).toBe('/api/v1/me/favorites/v1')
    expect((deleteCall?.[1] as RequestInit | undefined)?.method).toBe('DELETE')
  })

  it('помилка → toast, список не рефрешиться', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    renderWithProviders(<FavoriteRemoveButton venueId="v1" />)
    fireEvent.click(screen.getByRole('button', { name: /Прибрати/i }))
    // 500 з порожнім тілом → ApiError «Сервіс тимчасово недоступний» → toast
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/сервіс тимчасово/i))
    expect(refresh).not.toHaveBeenCalled()
  })
})
