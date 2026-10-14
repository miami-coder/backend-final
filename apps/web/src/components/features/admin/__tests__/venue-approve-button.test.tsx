import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { VenueApproveButton } from '@/components/features/admin/venue-approve-button'

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
      <VenueApproveButton venueId="v1" />
    </ToastProvider>,
  )
}

describe('VenueApproveButton', () => {
  it('POST без тіла → toast «Заклад схвалено» + refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Схвалити' }))
    await waitFor(() => expect(screen.getByText('Заклад схвалено')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe('/api/v1/admin/venues/v1/approve')
    expect((init as RequestInit).method).toBe('POST')
    // approve приймає БЕЗ тіла
    expect((init as RequestInit).body).toBeUndefined()
    expect(refresh).toHaveBeenCalled()
  })

  it('помилка бекенда → toast із message, без refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () =>
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Немає доступу' } }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Схвалити' }))
    await waitFor(() => expect(screen.getByText('Немає доступу')).toBeInTheDocument())
    expect(refresh).not.toHaveBeenCalled()
  })

  it('подвійний клік: другий fetch не летить (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn(() => pending)
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    const button = screen.getByRole('button', { name: 'Схвалити' })
    fireEvent.click(button)
    // друга спроба під час першого запиту: кнопка disabled + busy-гард
    fireEvent.click(button)
    resolve(okResponse())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
