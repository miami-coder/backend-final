import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { HangoutJoinButton } from '@/components/features/hangouts/hangout-join-button'
import type { SessionUser } from '@/types/user'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))

afterEach(() => vi.unstubAllGlobals())

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('HangoutJoinButton', () => {
  it('auth → POST /hangouts/h1/join → toast + refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><HangoutJoinButton hangoutId="h1" status="open" /></ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /приєднатися/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/приєднано/i))
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/hangouts/h1/join')
    expect((call[1] as RequestInit).method).toBe('POST')
    expect(refresh).toHaveBeenCalled()
  })

  it('409 → інлайн-повідомлення бекенда', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Ви вже приєднані' } }), { status: 409, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><HangoutJoinButton hangoutId="h1" status="open" /></ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /приєднатися/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/вже приєднані/i))
  })

  it('filled/cancelled/completed → кнопка вимкнена', () => {
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><HangoutJoinButton hangoutId="h1" status="filled" /></ToastProvider>
      </UserProvider>,
    )
    expect(screen.getByRole('button', { name: /приєднатися/i })).toBeDisabled()
  })

  it('гість → login-link /auth/login?next=/hangouts (без %2F)', () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: null }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={null}>
        <ToastProvider><HangoutJoinButton hangoutId="h1" status="open" /></ToastProvider>
      </UserProvider>,
    )
    const link = screen.getByRole('link', { name: /приєднатися/i })
    // без encodeURIComponent: %2F у next проксі відкидає — патерн HangoutButton
    expect(link).toHaveAttribute('href', '/auth/login?next=/hangouts')
  })
})
