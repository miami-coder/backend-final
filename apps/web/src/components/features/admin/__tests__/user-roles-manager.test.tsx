import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { UserRolesManager } from '@/components/features/admin/user-roles-manager'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function okResponse() {
  return new Response(JSON.stringify({ data: { id: 'r1' } }), {
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

function renderManager(roles: string[] = ['user', 'venue_admin']) {
  return render(
    <ToastProvider>
      <UserRolesManager userId="u1" roles={roles as never} />
    </ToastProvider>,
  )
}

function postCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === 'POST',
  )
}

function assertExactBody(call: unknown[], body: Record<string, string>) {
  const [, init] = call as [RequestInfo | URL, RequestInit]
  expect(String(call[0])).toBe('/api/v1/admin/users/u1/roles')
  expect(init.method).toBe('POST')
  expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  expect(init.body).toBe(JSON.stringify(body))
}

describe('UserRolesManager', () => {
  it('рендерить чипи поточних ролей з кнопками зняття', () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderManager()
    expect(screen.getByText('Користувач')).toBeInTheDocument()
    expect(screen.getByText('Адмін закладів')).toBeInTheDocument()
    // кнопка зняття на кожному чипі
    expect(screen.getByRole('button', { name: 'Зняти роль Адмін закладів' })).toBeInTheDocument()
    // ролі, які вже є, у select відсутні
    const options = screen.getAllByRole('option')
    expect(options.some((o) => o.textContent === 'Користувач')).toBe(false)
    expect(options.some((o) => o.textContent === 'Адмін закладів')).toBe(false)
    expect(options.some((o) => o.textContent === 'Критик')).toBe(true)
  })

  it('вибір ролі + «Додати» → POST { roleCode: "critic", action: "add" } → toast + refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderManager()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'critic' } })
    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Роль надано'))
    const calls = postCalls()
    expect(calls).toHaveLength(1)
    assertExactBody(calls[0], { roleCode: 'critic', action: 'add' })
    expect(refresh).toHaveBeenCalled()
  })

  it('«×» на чипі → POST { roleCode: "venue_admin", action: "remove" } → toast + refresh', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: 'Зняти роль Адмін закладів' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Роль знято'))
    const calls = postCalls()
    expect(calls).toHaveLength(1)
    assertExactBody(calls[0], { roleCode: 'venue_admin', action: 'remove' })
    expect(refresh).toHaveBeenCalled()
  })

  it('super_admin (add): спершу Modal «Надати супер-адміна?», POST лише після «Підтвердити»', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderManager(['user'])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'super_admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
    // підтвердження: модалка відкрита, POST ще не летів
    expect(screen.getByRole('dialog')).toHaveTextContent('Надати супер-адміна?')
    expect(postCalls()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Підтвердити' }))
    await waitFor(() => expect(postCalls()).toHaveLength(1))
    assertExactBody(postCalls()[0], { roleCode: 'super_admin', action: 'add' })
    expect(refresh).toHaveBeenCalled()
  })

  it('super_admin (remove): «×» на чипі → Modal «Зняти супер-адміна?» → «Скасувати» скасовує без POST', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderManager(['user', 'super_admin'])
    fireEvent.click(screen.getByRole('button', { name: 'Зняти роль Супер-адмін' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Зняти супер-адміна?')
    expect(postCalls()).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(postCalls()).toHaveLength(0)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('помилка бекенда → toast error, refresh не викликається', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => errorResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderManager()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'critic' } })
    fireEvent.click(screen.getByRole('button', { name: 'Додати' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Немає доступу'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('подвійне натискання «Додати» → лише один POST (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn<FetchFn>(async () => pending)
    vi.stubGlobal('fetch', fetchMock)
    renderManager()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'critic' } })
    const add = screen.getByRole('button', { name: 'Додати' })
    fireEvent.click(add)
    fireEvent.click(add)
    resolve(okResponse())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(postCalls()).toHaveLength(1)
  })
})
