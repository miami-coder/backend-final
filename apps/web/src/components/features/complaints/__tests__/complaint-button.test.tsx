import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { ComplaintButton } from '@/components/features/complaints/complaint-button'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const jsonHeaders = { 'content-type': 'application/json' }
const testUser: SessionUser = { id: 'u1', email: 'u1@test.ua', roles: ['user'] }

// бріф мав фіксчури 'v1'/'r1', але complaintFormSchema вимагає .uuid() —
// беремо валідні UUID, щоб тест ізолював поведінку форми, а не формат ідентифікатора
const venueId = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const reviewId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'

// UserProvider на монтуванні сам фетчить /auth/me — віддаємо йому сесію,
// щоб не плутати лічильник викликів із POST-ом скарги
function authAwareMock(resolver: (url: string) => Response) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return new Response(JSON.stringify({ data: testUser }), { headers: jsonHeaders })
    return resolver(url)
  })
}

// виклики форми — без /auth/me провайдера
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

const ok201 = () => new Response(JSON.stringify({ data: { id: 'c1' } }), {
  status: 201, headers: jsonHeaders,
})

describe('ComplaintButton', () => {
  it('гість → посилання на логін (без модалки)', () => {
    renderWithProviders(<ComplaintButton target={{ venueId }} />, null)
    expect(screen.getByRole('link', { name: /Скарга/i })).toHaveAttribute('href', `/auth/login?next=/venues/${venueId}`)
  })

  it('відкриття модалки, валідація тексту < 20 → помилка, без запиту', async () => {
    const fetchMock = authAwareMock(() => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ComplaintButton target={{ venueId }} />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /Скарга/i }))
    fireEvent.change(screen.getByLabelText(/Опис/i), { target: { value: 'коротко' } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати скаргу/i }))
    // лейбл теж містить «мінімум 20» — інлайн-помилку шукаємо саме через role="alert"
    expect(await screen.findByRole('alert')).toHaveTextContent(/мінімум 20/i)
    expect(apiCalls(fetchMock)).toHaveLength(0)
  })

  it('успіх → POST /complaints з venueId, toast, модалка закривається', async () => {
    const fetchMock = authAwareMock(() => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ComplaintButton target={{ venueId }} />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /Скарга/i }))
    fireEvent.change(screen.getByLabelText(/Опис/i), { target: { value: 'тут недостатньо символів' } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати скаргу/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe('/api/v1/complaints')
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      venueId, reason: 'other', text: 'тут недостатньо символів',
    })
    // toast успіху та модалка закрилась
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/надіслано/i))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('reason вибирається і потрапляє в тіло', async () => {
    const fetchMock = authAwareMock(() => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ComplaintButton target={{ reviewId }} label="Скарга на відгук" />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /Скарга на відгук/i }))
    fireEvent.change(screen.getByLabelText(/Причина/i), { target: { value: 'fraud' } })
    fireEvent.change(screen.getByLabelText(/Опис/i), { target: { value: 'тут недостатньо символів' } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати скаргу/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    expect(JSON.parse((apiCalls(fetchMock)[0][1] as RequestInit).body as string)).toMatchObject({
      reviewId, reason: 'fraud',
    })
  })
})
