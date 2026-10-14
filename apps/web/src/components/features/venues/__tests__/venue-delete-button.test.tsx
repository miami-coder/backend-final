import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { VenueDeleteButton } from '@/components/features/venues/venue-delete-button'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

afterEach(() => vi.unstubAllGlobals())

// Бекенд віддає 204 з порожнім тілом (softDelete нічого не повертає)
function noContentResponse() {
  return new Response(null, { status: 204 })
}

// Сигнатура із (url, init): mock.calls[0] типізований як кортеж аргументів fetch
type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

describe('VenueDeleteButton', () => {
  it('«Видалити» відкриває модалку, «Підтвердити» → DELETE → toast + push(redirectTo) + закриття', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => noContentResponse())
    vi.stubGlobal('fetch', fetchMock)
    render(
      <ToastProvider>
        <VenueDeleteButton venueId="v1" redirectTo="/account/venues" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    expect(screen.getByRole('dialog', { name: 'Видалити заклад?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(screen.getByText('Заклад видалено')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/v1/venues/v1')
    expect((init as RequestInit).method).toBe('DELETE')
    expect(push).toHaveBeenCalledWith('/account/venues')
    expect(refresh).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('без redirectTo — лише refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => noContentResponse())
    vi.stubGlobal('fetch', fetchMock)
    render(
      <ToastProvider>
        <VenueDeleteButton venueId="v1" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(push).not.toHaveBeenCalled()
  })

  it('«Закрити» в модалці — DELETE не летить', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => noContentResponse())
    vi.stubGlobal('fetch', fetchMock)
    render(
      <ToastProvider>
        <VenueDeleteButton venueId="v1" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('помилка → toast із message, модалка лишається відкритою, без push', async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Не можна редагувати цей заклад' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <ToastProvider>
        <VenueDeleteButton venueId="v1" redirectTo="/account/venues" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(screen.getByText('Не можна редагувати цей заклад')).toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Видалити заклад?' })).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })

  it('подвійний клік «Підтвердити»: другий fetch не летить (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn(() => pending)
    vi.stubGlobal('fetch', fetchMock)
    render(
      <ToastProvider>
        <VenueDeleteButton venueId="v1" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Видалити' }))
    const confirm = screen.getByRole('button', { name: 'Підтвердити' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    resolve(noContentResponse())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})