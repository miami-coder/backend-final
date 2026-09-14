import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { UserDeleteButton } from '@/components/features/admin/user-delete-button'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

// DELETE → 200 з ПОРОЖНІМ тілом (як у бекенда)
function okResponse() {
  return new Response(null, { status: 200 })
}

function forbiddenResponse() {
  return new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Немає доступу' } }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  })
}

function renderButton() {
  return render(
    <ToastProvider>
      <UserDeleteButton userId="u1" email="admin@example.com" />
    </ToastProvider>,
  )
}

async function openModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
  return await screen.findByRole('dialog')
}

function deleteCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'DELETE',
  )
}

describe('UserDeleteButton', () => {
  it('«Видалити» → Modal; кнопка підтвердження disabled, поки email не введено точно', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    const dialog = await openModal()
    expect(dialog).toHaveTextContent('Видалити користувача?')
    const confirm = screen.getByRole('button', { name: 'Видалити користувача' })
    expect(confirm).toBeDisabled()
    // частковий збіг — все ще disabled
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example' } })
    expect(confirm).toBeDisabled()
    expect(deleteCalls()).toHaveLength(0)
  })

  it('точний email → підтвердження активне → DELETE /admin/users/:id → toast «Користувача видалено» + push на список', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    await openModal()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } })
    const confirm = screen.getByRole('button', { name: 'Видалити користувача' })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Користувача видалено'))
    const calls = deleteCalls()
    expect(calls).toHaveLength(1)
    const [url, init] = calls[0] as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/api/v1/admin/users/u1')
    expect(init.method).toBe('DELETE')
    expect(push).toHaveBeenCalledWith('/admin/users')
  })

  it('403 (спроба видалити себе) → toast error, без push', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => forbiddenResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    await openModal()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Видалити користувача' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Немає доступу'))
    expect(push).not.toHaveBeenCalled()
  })

  it('подвійне підтвердження → лише один DELETE (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn<FetchFn>(async () => pending)
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    await openModal()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@example.com' } })
    const confirm = screen.getByRole('button', { name: 'Видалити користувача' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    resolve(okResponse())
    await waitFor(() => expect(push).toHaveBeenCalled())
    expect(deleteCalls()).toHaveLength(1)
  })
})
