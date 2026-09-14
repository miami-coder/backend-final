import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { VenueAssignOwnerButton } from '@/components/features/admin/venue-assign-owner-button'
import type { RawAdminUser } from '@/types/admin'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => vi.unstubAllGlobals())

// Сигнатура із (url, init): mock.calls[0] типізований як кортеж аргументів fetch
type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const USERS: RawAdminUser[] = [
  {
    id: 'u1',
    email: 'owner@example.com',
    createdAt: '2026-01-01T00:00:00Z',
    roles: ['user'],
    profile: {
      firstname: 'Іван',
      lastname: 'Тест',
      phone: null,
      age: null,
      avatarUrl: null,
    },
  },
  {
    id: 'u2',
    email: 'noname@example.com',
    createdAt: '2026-01-02T00:00:00Z',
    roles: ['user'],
    profile: null,
  },
]

function listResponse() {
  return new Response(JSON.stringify({ data: USERS, meta: { page: 1, limit: 100, total: 2, hasMore: false } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function okResponse() {
  return new Response(JSON.stringify({ data: { id: 'v1' } }), {
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

function renderButton() {
  return render(
    <ToastProvider>
      <VenueAssignOwnerButton venueId="v1" />
    </ToastProvider>,
  )
}

async function openModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Призначити власника' }))
  // список користувачів завантажується асинхронно після відкриття
  return await screen.findByRole('combobox')
}

describe('VenueAssignOwnerButton', () => {
  it('відкриття модалки: GET /admin/users?limit=100 → варіанти «email — Імʼя»', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => listResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    await openModal()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/users?limit=100', undefined),
    )
    const options = screen.getAllByRole('option')
    // перший — плейсхолдер «— Оберіть користувача —», далі користувачі
    expect(options).toHaveLength(3)
    expect(options[0].getAttribute('value')).toBe('')
    expect(options[1]).toHaveTextContent('owner@example.com — Іван Тест')
    expect(options[1].getAttribute('value')).toBe('u1')
    // profile відсутній → підписом лишається лише email
    expect(options[2]).toHaveTextContent('noname@example.com')
    expect(options[2].getAttribute('value')).toBe('u2')
  })

  it('без вибору «Зберегти» disabled; після вибору — активна', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => listResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    const select = await openModal()
    const save = screen.getByRole('button', { name: 'Зберегти' })
    expect(save).toBeDisabled()
    fireEvent.change(select, { target: { value: 'u1' } })
    expect(save).toBeEnabled()
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/v1/admin/venues/v1/assign-owner',
      expect.anything(),
    )
  })

  it('Зберегти: POST з exact body { userId } → toast «Власника призначено» + refresh + закриття', async () => {
    const fetchMock = vi.fn<FetchFn>(async (url) => {
      if (String(url).includes('/assign-owner')) return okResponse()
      return listResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    const select = await openModal()
    fireEvent.change(select, { target: { value: 'u1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(screen.getByText('Власника призначено')).toBeInTheDocument())
    const postCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/assign-owner'))
    expect(postCall).toBeDefined()
    const [url, init] = postCall as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/api/v1/admin/venues/v1/assign-owner')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    // exact body: JSON.stringify({ userId })
    expect(init.body).toBe(JSON.stringify({ userId: 'u1' }))
    expect(refresh).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
  })

  it('помилка бекенда → toast error, модалка лишається відкритою', async () => {
    const fetchMock = vi.fn<FetchFn>(async (url) => {
      if (String(url).includes('/assign-owner')) return errorResponse()
      return listResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    const select = await openModal()
    fireEvent.change(select, { target: { value: 'u1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(screen.getByText('Немає доступу')).toBeInTheDocument())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('подвійне натискання «Зберегти»: другий POST не летить (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn<FetchFn>(async (url) => {
      if (String(url).includes('/assign-owner')) return pending
      return listResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    renderButton()
    const select = await openModal()
    fireEvent.change(select, { target: { value: 'u1' } })
    const save = screen.getByRole('button', { name: 'Зберегти' })
    fireEvent.click(save)
    fireEvent.click(save)
    resolve(okResponse())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const postCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/assign-owner'))
    expect(postCalls).toHaveLength(1)
  })
})
