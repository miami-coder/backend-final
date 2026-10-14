import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { FeatureReviewButton } from '@/components/features/venues/feature-review-button'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const jsonHeaders = { 'content-type': 'application/json' }
const reviewId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'

const userOf = (roles: string[]): SessionUser => ({
  id: 'u1',
  email: 'u1@test.ua',
  roles: roles as SessionUser['roles'],
})

// UserProvider на монтуванні сам фетчить /auth/me — віддаємо йому сесію,
// щоб не плутати лічильник викликів із POST/DELETE виділення
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

const ok200 = () => new Response(JSON.stringify({ data: { id: reviewId, isFeatured: true } }), {
  status: 200, headers: jsonHeaders,
})

describe('FeatureReviewButton', () => {
  it('звичайному юзеру (без critic/super_admin) кнопки нема', () => {
    renderWithProviders(<FeatureReviewButton reviewId={reviewId} isFeatured={false} />, userOf(['user']))
    expect(screen.queryByRole('button', { name: /виділити/i })).not.toBeInTheDocument()
  })

  it('гостю кнопки нема', () => {
    renderWithProviders(<FeatureReviewButton reviewId={reviewId} isFeatured={false} />, null)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('критик бачить «★ Виділити»; клік → POST feature + toast + refresh', async () => {
    const fetchMock = authAwareMock(ok200)
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FeatureReviewButton reviewId={reviewId} isFeatured={false} />, userOf(['critic']))
    fireEvent.click(screen.getByRole('button', { name: /виділити/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe(`/api/v1/reviews/${reviewId}/feature`)
    expect((init as RequestInit).method).toBe('POST')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/виділено/i))
    expect(refresh).toHaveBeenCalled()
  })

  it('виділений відгук → «Зняти виділення»; клік → DELETE feature', async () => {
    const fetchMock = authAwareMock(ok200)
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FeatureReviewButton reviewId={reviewId} isFeatured={true} />, userOf(['critic']))
    fireEvent.click(screen.getByRole('button', { name: /зняти виділення/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe(`/api/v1/reviews/${reviewId}/feature`)
    expect((init as RequestInit).method).toBe('DELETE')
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/знято/i))
  })

  it('супер-адмін теж бачить кнопку', () => {
    renderWithProviders(<FeatureReviewButton reviewId={reviewId} isFeatured={false} />, userOf(['user', 'super_admin']))
    expect(screen.getByRole('button', { name: /виділити/i })).toBeInTheDocument()
  })

  it('помилка 403 → toast з message бекенда, refresh не викликається', async () => {
    const fetchMock = authAwareMock(() => new Response(
      JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Немає дозволу review:feature' } }),
      { status: 403, headers: jsonHeaders },
    ))
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<FeatureReviewButton reviewId={reviewId} isFeatured={false} />, userOf(['critic']))
    fireEvent.click(screen.getByRole('button', { name: /виділити/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/дозволу/i))
    expect(refresh).not.toHaveBeenCalled()
  })
})