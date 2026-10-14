import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { UserProfileForm } from '@/components/features/admin/user-profile-form'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const profile = { firstname: 'Іван', lastname: 'Петренко', phone: null, age: 25 }

function okResponse() {
  return new Response(JSON.stringify({ data: { ...profile } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function errorResponse() {
  return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Немає доступу' } }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  })
}

function renderForm() {
  return render(
    <ToastProvider>
      <UserProfileForm userId="u1" profile={profile} />
    </ToastProvider>,
  )
}

// усі fetch-виклики форми (UserProvider тут немає — фетчів поза формою не буває)
function patchCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
  )
}

describe('UserProfileForm (адмінка)', () => {
  it('сабміт лише зі зміненим полем → PATCH /admin/users/:id з diff { firstname } + toast «Профіль оновлено» + refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^Імʼя$/i), { target: { value: 'Олег' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Профіль оновлено'))
    const calls = patchCalls()
    expect(calls).toHaveLength(1)
    const [url, init] = calls[0] as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/api/v1/admin/users/u1')
    expect(init.method).toBe('PATCH')
    expect(init.headers).toEqual({ 'content-type': 'application/json' })
    // exact body: лише diff — незмінені поля і порожні не летять
    expect(init.body).toBe(JSON.stringify({ firstname: 'Олег' }))
    expect(refresh).toHaveBeenCalled()
  })

  it('без змін → toast «Немає змін», PATCH не летить', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Немає змін'))
    expect(patchCalls()).toHaveLength(0)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('firstname <2 символів → інлайн-помилка, без PATCH', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^Імʼя$/i), { target: { value: 'Й' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/мінімум 2/i))
    expect(patchCalls()).toHaveLength(0)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('помилка бекенда → інлайн-помилка з повідомленням, без toast успіху', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => errorResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fireEvent.change(screen.getByLabelText(/^Імʼя$/i), { target: { value: 'Олег' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Немає доступу'))
    expect(refresh).not.toHaveBeenCalled()
  })
})
