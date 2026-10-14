import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ViewRecorder } from '@/components/features/venues/view-recorder'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
  sessionStorage.clear()
})

describe('ViewRecorder', () => {
  it('маунт → один POST /venues/:id/view з sessionId з localStorage', async () => {
    // (адаптація: типізуємо параметри мока, інакше TS лає порожній tuple mock.calls[0];
    // параметри потрібні лише для типізації викликів — значення читаємо з mock.calls)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(JSON.stringify({ data: { recorded: true } }), {
        status: 201, headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ViewRecorder venueId="v1" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const [url, init] = fetchMock.mock.calls[0]
    expect(init?.body).toBeDefined()
    expect(url).toBe('/api/v1/venues/v1/view')
    const body = JSON.parse(String(init?.body))
    expect(typeof body.sessionId).toBe('string')
    expect(body.sessionId.length).toBeGreaterThan(0)
    expect(body.sessionId.length).toBeLessThanOrEqual(64)
  })
  it('StrictMode-подвійний ефект → все одно один запит (guard)', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<ViewRecorder venueId="v1" />)
    render(<ViewRecorder venueId="v1" />) // другий рендер — не дублює
    await new Promise((r) => setTimeout(r, 10))
    expect(fetchMock).toHaveBeenCalledOnce()
  })
  it('помилка мережі → тихо (fire-and-forget, без error boundary)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    render(<ViewRecorder venueId="v1" />)
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.queryByText(/Помилка/i)).not.toBeInTheDocument()
  })
})
