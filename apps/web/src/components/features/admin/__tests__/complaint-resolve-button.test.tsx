import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { ComplaintResolveButton } from '@/components/features/admin/complaint-resolve-button'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => vi.unstubAllGlobals())

// Сигнатура із (url, init): mock.calls[0] типізований як кортеж аргументів fetch
type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function okResponse() {
  return new Response(JSON.stringify({ data: { id: 'c1' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function conflictResponse() {
  return new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'Скаргу вже вирішено' } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  })
}

function renderButton() {
  return render(
    <ToastProvider>
      <ComplaintResolveButton complaintId="c1" />
    </ToastProvider>,
  )
}

function openModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Вирішити' }))
  return screen.getByRole('dialog')
}

describe('ComplaintResolveButton', () => {
  it('кнопка «Вирішити» відкриває модалку: radio resolved за замовчуванням, textarea note', () => {
    vi.stubGlobal('fetch', vi.fn<FetchFn>(async () => okResponse()))
    renderButton()
    openModal()
    expect(screen.getByRole('radio', { name: 'Вирішено (resolved)' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Відхилено (rejected)' })).not.toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Примітка (необовʼязково)' })).toBeInTheDocument()
  })

  it('resolved без note: POST exact body {"status":"resolved"} → toast «Скаргу вирішено» + refresh + закриття', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(screen.getByText('Скаргу вирішено')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/api/v1/admin/complaints/c1/resolve')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.body).toBe(JSON.stringify({ status: 'resolved' }))
    expect(refresh).toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('rejected із note: POST exact body {"status":"rejected","note":"…"}', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    openModal()
    fireEvent.click(screen.getByRole('radio', { name: 'Відхилено (rejected)' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Примітка (необовʼязково)' }), {
      target: { value: 'Скарга не підтвердилась' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(init.body).toBe(JSON.stringify({ status: 'rejected', note: 'Скарга не підтвердилась' }))
  })

  it('note лише з пробілів → у body не потрапляє (порожній рядок не силою)', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    openModal()
    fireEvent.change(screen.getByRole('textbox', { name: 'Примітка (необовʼязково)' }), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(init.body).toBe(JSON.stringify({ status: 'resolved' }))
  })

  it('409 (вже вирішено) → inline message у модалці з ApiError, модалка відкрита, без refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => conflictResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    openModal()
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Скаргу вже вирішено'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('подвійне натискання «Зберегти»: другий POST не летить (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn<FetchFn>(async () => pending)
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    openModal()
    const save = screen.getByRole('button', { name: 'Зберегти' })
    fireEvent.click(save)
    fireEvent.click(save)
    resolve(okResponse())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
