import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { HangoutButton } from '@/components/features/hangouts/hangout-button'
import type { SessionUser } from '@/types/user'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => window.localStorage.clear())

const jsonHeaders = { 'content-type': 'application/json' }
const testUser: SessionUser = { id: 'u1', email: 'u1@test.ua', roles: ['user'] }

// «Сьогодні» в ЛОКАЛЬНІЙ зоні (en-CA → YYYY-MM-DD), як і схема (фікс Task 8):
// toISOString() дав би UTC — біля місцевої півночі фікстура «сьогодні» могла
// б опинитися «вчора» і тест став би залежним від часу запуску.
const today = () =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const localDate = (offsetDays: number) =>
  new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offsetDays * 86400000))

// UserProvider на монтуванні сам фетчить /auth/me — віддаємо йому сесію,
// щоб не плутати лічильник викликів із POST-ом пиячка
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

const ok201 = () => new Response(JSON.stringify({ data: { id: 'h1' } }), {
  status: 201, headers: jsonHeaders,
})

function fillForm() {
  fireEvent.change(screen.getByLabelText(/Дата/i), { target: { value: today() } })
  fireEvent.change(screen.getByLabelText(/Час/i), { target: { value: '19:30' } })
  fireEvent.change(screen.getByLabelText(/Мета/i), { target: { value: 'Шукаю компанію на дегустацію' } })
}

describe('HangoutButton', () => {
  it('гість → посилання на логін', () => {
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, null)
    expect(screen.getByRole('link', { name: /пиячок/i })).toHaveAttribute('href', '/auth/login?next=/venues/v1')
  })

  it('перше відкриття → попередження про безпеку; підтвердження → форма; прапор у localStorage', () => {
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /пиячок/i }))
    expect(screen.getByText(/безпек/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Зрозуміло, продовжити/i }))
    expect(screen.getByLabelText(/Мета/i)).toBeInTheDocument()
    expect(window.localStorage.getItem('hangout-safety-ack')).toBe('1')
  })

  it('повторне відкриття (прапор збережено) → форма одразу', () => {
    window.localStorage.setItem('hangout-safety-ack', '1')
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /пиячок/i }))
    expect(screen.getByLabelText(/Мета/i)).toBeInTheDocument()
    expect(screen.queryByText(/попередженн/i)).not.toBeInTheDocument()
  })

  it('минула дата → помилка валідації, без запиту', async () => {
    const fetchMock = authAwareMock(() => ok201())
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('hangout-safety-ack', '1')
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /пиячок/i }))
    fireEvent.change(screen.getByLabelText(/Дата/i), { target: { value: localDate(-1) } })
    fireEvent.change(screen.getByLabelText(/Час/i), { target: { value: '19:30' } })
    fireEvent.change(screen.getByLabelText(/Мета/i), { target: { value: 'Шукаю компанію на дегустацію' } })
    fireEvent.click(screen.getByRole('button', { name: /Створити/i }))
    expect(await screen.findByText(/минулому/i)).toBeInTheDocument()
    expect(apiCalls(fetchMock)).toHaveLength(0)
  })

  it('успіх → POST /venues/v1/hangouts з валідним тілом, toast, закриття', async () => {
    const fetchMock = authAwareMock(() => ok201())
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('hangout-safety-ack', '1')
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /пиячок/i }))
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /Створити/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe('/api/v1/venues/v1/hangouts')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      date: today(), time: '19:30', purpose: 'Шукаю компанію на дегустацію',
      gender: 'any', groupSize: 2, payer: 'me',
    })
    // toast успіху та модалка закрилась
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/створено/i))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('провал запиту → помилка; закриття і повторне відкриття — чиста форма', async () => {
    const fetchMock = authAwareMock(() => new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Сервіс тимчасово недоступний', details: null } }),
      { status: 500, headers: jsonHeaders },
    ))
    vi.stubGlobal('fetch', fetchMock)
    window.localStorage.setItem('hangout-safety-ack', '1')
    renderWithProviders(<HangoutButton venueId="v1" loginNext="/venues/v1" />, testUser)
    fireEvent.click(screen.getByRole('button', { name: /пиячок/i }))
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: /Створити/i }))
    expect(await screen.findByText(/Сервіс тимчасово недоступний/i)).toBeInTheDocument()
    // закриття (Скасувати) → повторне відкриття: помилка не повертається
    fireEvent.click(screen.getByRole('button', { name: /Скасувати/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /пиячок/i }))
    expect(screen.queryByText(/Сервіс тимчасово недоступний/i)).not.toBeInTheDocument()
    // поля теж скинуті
    expect(screen.getByLabelText(/Мета/i)).toHaveValue('')
  })
})
