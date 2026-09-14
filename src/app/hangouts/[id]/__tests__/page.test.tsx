import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import Page from '@/app/hangouts/[id]/page'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

// useParams мок: id = 'h1'
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'h1' }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

const rawHangout = {
  id: 'h1', venueId: 'v1', creatorId: 'u1', date: '2026-12-01', time: '19:00',
  purpose: 'Посидіти з пивом', gender: 'any', groupSize: 5, payer: 'split',
  desiredBudget: '500', status: 'open', createdAt: '2026-09-01T00:00:00Z',
  venue: { id: 'v1', name: 'Бар «Пиво»', address: 'вул. Липова, 1', mainPhotoUrl: null },
  participants: [
    { hangoutId: 'h1', userId: 'u1', joinedAt: '2026-09-01T00:00:00Z' },
    { hangoutId: 'h1', userId: 'u2', joinedAt: '2026-09-02T00:00:00Z' },
  ],
}

describe('/hangouts/[id]', () => {
  it('учасник бачить деталі і список учасників', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: rawHangout }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><Page /></ToastProvider>
      </UserProvider>,
    )
    await waitFor(() => expect(screen.getByText(/Посидіти з пивом/)).toBeInTheDocument())
    expect(screen.getByText(/Бар «Пиво»/)).toBeInTheDocument()
    // лейбли gender/payer — канонічні константи HANGOUT_GENDERS/HANGOUT_PAYERS
    expect(screen.getByText('Будь-хто')).toBeInTheDocument()
    expect(screen.getByText('Ділити порівну')).toBeInTheDocument()
    expect(screen.getByText(/Учасники \(2\)/)).toBeInTheDocument()
  })

  it('403 → error-стан «Ви не учасник цієї зустрічі»', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Ви не учасник цієї заявки' } }), { status: 403, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><Page /></ToastProvider>
      </UserProvider>,
    )
    await waitFor(() => expect(screen.getByText(/не учасник/i)).toBeInTheDocument())
  })

  it('мережева помилка → retry-стан', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 500 })))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><Page /></ToastProvider>
      </UserProvider>,
    )
    await waitFor(() => expect(screen.getByRole('button', { name: /повторити/i })).toBeInTheDocument())
  })
})
