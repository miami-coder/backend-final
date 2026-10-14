import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { RecommendButton } from '@/components/features/venues/recommend-button'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}))

const jsonHeaders = { 'content-type': 'application/json' }
const venueId = '3f333fe6-06f7-4a35-a86f-c4d2f0d6b123'

const userOf = (roles: string[], id = 'u1'): SessionUser => ({
  id,
  email: `${id}@test.ua`,
  roles: roles as SessionUser['roles'],
})

// UserProvider на монтуванні сам фетчить /auth/me — віддаємо йому сесію,
// щоб не плутати лічильник викликів із POST/DELETE рекомендації
function authAwareMock(resolver: () => Response) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) {
      return new Response(JSON.stringify({ data: userOf(['critic']) }), { headers: jsonHeaders })
    }
    return resolver()
  })
}

// виклики крім /auth/me провайдера
function apiCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([u]) => !String(u).includes('/auth/me'))
}

function renderWithProviders(ui: ReactNode, user: SessionUser | null) {
  return render(
    <UserProvider initialUser={user}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

const ok200 = () =>
  new Response(null, { status: 200, headers: jsonHeaders })

describe('RecommendButton', () => {
  it('звичайному юзеру (без critic/super_admin) кнопки нема', () => {
    renderWithProviders(<RecommendButton venueId={venueId} recommendedBy={null} />, userOf(['user']))
    expect(screen.queryByRole('button', { name: /рекомендувати/i })).not.toBeInTheDocument()
  })

  it('гостю кнопки нема', () => {
    renderWithProviders(<RecommendButton venueId={venueId} recommendedBy={null} />, null)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('критик бачить «✦ Рекомендувати»; клік → POST recommend + toast + refresh', async () => {
    const fetchMock = authAwareMock(ok200)
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<RecommendButton venueId={venueId} recommendedBy={null} />, userOf(['critic']))
    fireEvent.click(screen.getByRole('button', { name: /рекомендувати/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe(`/api/v1/venues/${venueId}/recommend`)
    expect((init as RequestInit).method).toBe('POST')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/рекомендовано/i))
    expect(refresh).toHaveBeenCalled()
  })

  it('своя рекомендація → «Зняти рекомендацію»; клік → DELETE recommend', async () => {
    const fetchMock = authAwareMock(ok200)
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(
      <RecommendButton venueId={venueId} recommendedBy="u1" />,
      userOf(['critic'], 'u1'),
    )
    fireEvent.click(screen.getByRole('button', { name: /зняти рекомендацію/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe(`/api/v1/venues/${venueId}/recommend`)
    expect((init as RequestInit).method).toBe('DELETE')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/знято/i))
  })

  it('чужа рекомендація (другий критик) — кнопки нема, лише бейдж на сторінці', () => {
    renderWithProviders(
      <RecommendButton venueId={venueId} recommendedBy="u-other" />,
      userOf(['critic'], 'u1'),
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})