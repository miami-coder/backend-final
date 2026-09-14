import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { VenueRejectButton } from '@/components/features/admin/venue-reject-button'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => vi.unstubAllGlobals())

function okResponse() {
  return new Response(JSON.stringify({ data: { id: 'v1' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

// Сигнатура із (url, init): mock.calls[0] типізований як кортеж аргументів fetch
type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function renderButton() {
  return render(
    <ToastProvider>
      <VenueRejectButton venueId="v1" />
    </ToastProvider>,
  )
}

describe('VenueRejectButton', () => {
  it('«Відхилити» відкриває модалку, «Підтвердити» → POST з {} → toast + refresh + закриття', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Відхилити' }))
    expect(screen.getByRole('dialog', { name: 'Відхилити заклад?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(screen.getByText('Заклад відхилено')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/v1/admin/venues/v1/reject')
    expect((init as RequestInit).method).toBe('POST')
    // бекенд ігнорує тіло reject — шлемо порожній JSON
    expect((init as RequestInit).body).toBe('{}')
    expect((init as RequestInit).headers).toMatchObject({ 'Content-Type': 'application/json' })
    expect(refresh).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('«Закрити» в модалці — POST не летить', async () => {
    const fetchMock = vi.fn(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Відхилити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Закрити' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('помилка → toast із message, модалка лишається відкритою, без refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Немає доступу' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Відхилити' }))
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(screen.getByText('Немає доступу')).toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Відхилити заклад?' })).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('подвійний клік «Підтвердити»: другий fetch не летить (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn(() => pending)
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Відхилити' }))
    const confirm = screen.getByRole('button', { name: 'Підтвердити' })
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    resolve(okResponse())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
