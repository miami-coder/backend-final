import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { ProfileForm } from '@/components/features/account/profile-form'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function renderWithProviders(ui: ReactNode) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

const profile = { firstname: 'Іван', lastname: 'Петренко', phone: '+380', age: 25, avatarUrl: null }

// виклики самої форми — без /auth/me-фетчу UserProvider
function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('ProfileForm', () => {
  it('сабміт → PATCH /me/profile з лише заповненими полями + toast', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: { ...profile } }), { status: 200, headers: { 'content-type': 'application/json' } })
    }))
    renderWithProviders(<ProfileForm profile={profile} />)
    fireEvent.change(screen.getByLabelText(/^Імʼя$/i), { target: { value: 'Олег' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/збережено/i))
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/me/profile')
    expect((call[1] as RequestInit).method).toBe('PATCH')
    // без content-type проксі не переніс би заголовок на бекенд → тіло не розпарсилось
    expect((call[1] as RequestInit).headers).toEqual({ 'content-type': 'application/json' })
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.firstname).toBe('Олег')
    expect(body.age).toBe(25)
  })

  it('firstname <2 → інлайн-помилка, без PATCH', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 500 })
    }))
    renderWithProviders(<ProfileForm profile={profile} />)
    fireEvent.change(screen.getByLabelText(/^Імʼя$/i), { target: { value: 'Й' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/мінімум 2/i))
    expect(apiCalls().length).toBe(0)
  })
})
