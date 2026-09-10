import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { VenueCreateForm } from '@/components/features/venues/venue-create-form'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function renderForm(ui: ReactNode) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

describe('VenueCreateForm', () => {
  it('сабміт → POST /venues з DTO-полями → redirect /account/venues?created=1', async () => {
    // init потрібен лише для типізації викликів — значення читаємо з mock.calls
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: { id: 'v9' } }), { status: 201, headers: { 'content-type': 'application/json' } })
    }))
    renderForm(<VenueCreateForm />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Бар «Пиво»' } })
    fireEvent.change(screen.getByLabelText(/^Адреса$/i), { target: { value: 'вул. Липова, 1' } })
    fireEvent.change(screen.getByLabelText(/^Теги/i), { target: { value: 'pyvo, live' } })
    fireEvent.click(screen.getByRole('button', { name: /Подати/i }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/account/venues?created=1'))
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/venues')
    expect((call[1] as RequestInit).method).toBe('POST')
    const body = JSON.parse((call[1] as RequestInit).body as string)
    expect(body.name).toBe('Бар «Пиво»')
    expect(body.tagSlugs).toEqual(['pyvo', 'live'])
  })

  it('name <3 → інлайн-помилка, без POST', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(null, { status: 500 })
    }))
    renderForm(<VenueCreateForm />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Ба' } })
    fireEvent.change(screen.getByLabelText(/^Адреса$/i), { target: { value: 'вул. Липова, 1' } })
    fireEvent.click(screen.getByRole('button', { name: /Подати/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/мінімум 3/i))
    expect(apiCalls().length).toBe(0)
  })

  it('400 від бекенда (валідація «; ») → показ повідомлення', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'averageCheck must not be less than 0' } }), { status: 400, headers: { 'content-type': 'application/json' } })
    }))
    renderForm(<VenueCreateForm />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Бар «Пиво»' } })
    fireEvent.change(screen.getByLabelText(/^Адреса$/i), { target: { value: 'вул. Липова, 1' } })
    fireEvent.click(screen.getByRole('button', { name: /Подати/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/averageCheck/i))
  })
})