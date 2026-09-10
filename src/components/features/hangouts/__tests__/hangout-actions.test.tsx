import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { HangoutActions } from '@/components/features/hangouts/hangout-actions'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('HangoutActions', () => {
  it('творець → «Скасувати» → POST /hangouts/h1/cancel → refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <HangoutActions hangoutId="h1" isCreator canLeave={false} />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скасувати/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/hangouts/h1/cancel')
    expect((call[1] as RequestInit).method).toBe('POST')
  })

  it('учасник → «Покинути» → POST /hangouts/h2/leave', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 200 })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <HangoutActions hangoutId="h2" isCreator={false} canLeave />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Покинути/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(String(apiCalls()[0][0])).toBe('/api/v1/hangouts/h2/leave')
  })

  it('помилка → toast, без refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Тільки творець може скасувати' } }), { status: 403, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider>
          <HangoutActions hangoutId="h3" isCreator canLeave={false} />
        </ToastProvider>
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Скасувати/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/тільки творець/i))
    expect(refresh).not.toHaveBeenCalled()
  })
})
