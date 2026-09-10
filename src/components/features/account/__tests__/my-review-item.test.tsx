import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { MyReviewItem } from '@/components/features/account/my-review-item'
import type { Review } from '@/types/review'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

const review: Review = {
  id: 'r1', venueId: 'v1', rating: 4, text: 'Гарне місце, смачне пиво', checkPhotoUrl: null,
  isFeatured: false, createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  author: { firstname: 'Іван', lastname: null },
}

function renderWithProviders(ui: ReactNode) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

// виклики самого компонента — без /auth/me-фетчу UserProvider
function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('MyReviewItem', () => {
  it('видалення: confirm → DELETE /reviews/r1 → refresh', async () => {
    // 1-й виклик — /auth/me (UserProvider), далі DELETE → 200 порожнє тіло
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 200 })
    }))
    renderWithProviders(<MyReviewItem review={review} venueName={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Видалити/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^Так, видалити$/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const del = apiCalls().find(([, i]) => (i as RequestInit).method === 'DELETE')
    expect(String(del?.[0])).toBe('/api/v1/reviews/r1')
  })

  it('редагування: відкриває форму з моїм відгуком', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 200 })
    }))
    renderWithProviders(<MyReviewItem review={review} venueName={null} />)
    fireEvent.click(screen.getByRole('button', { name: /Редагувати/i }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    // ReviewForm у режимі редагування: кнопка сабміту — «Зберегти зміни» (review-form.tsx)
    expect(screen.getByRole('button', { name: /Зберегти зміни/i })).toBeInTheDocument()
    // текст підставлений з myReview (режим редагування)
    expect(screen.getByRole('textbox')).toHaveValue(review.text)
  })
})
