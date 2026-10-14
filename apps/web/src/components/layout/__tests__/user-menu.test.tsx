import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { UserMenu } from '@/components/layout/user-menu'
import type { SessionUser } from '@/types/user'

// UserProvider усередині тягне useRouter (logout робить router.push),
// UserMenu — usePathname (закриття меню після переходу)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/auth/login',
}))

afterEach(() => vi.unstubAllGlobals())

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }
const adminUser: SessionUser = { id: 'u2', email: 'admin@b.c', roles: ['super_admin'] }

describe('UserMenu', () => {
  it('клік відкриває меню з «Кабінет» і «Вийти», без «Адмінка» для user', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={testUser}>
        <UserMenu />
      </UserProvider>,
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /a@b\.c/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Кабінет' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Адмінка' })).not.toBeInTheDocument()
  })

  it('показує імʼя з профілю замість пошти', async () => {
    const namedUser: SessionUser = {
      id: 'u3',
      email: 'a@b.c',
      roles: ['user'],
      profile: { firstname: 'Олена', lastname: 'Коваль' },
    }
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: namedUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={namedUser}>
        <UserMenu />
      </UserProvider>,
    )
    expect(screen.getByRole('button', { name: /Олена Коваль/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /a@b\.c/ })).not.toBeInTheDocument()
  })

  it('super_admin бачить «Адмінка»', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: adminUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={adminUser}>
        <UserMenu />
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /admin@b\.c/ }))
    expect(screen.getByRole('menuitem', { name: 'Адмінка' })).toBeInTheDocument()
  })

  it('Escape закриває меню і повертає фокус на кнопку', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={testUser}>
        <UserMenu />
      </UserProvider>,
    )
    const button = screen.getByRole('button', { name: /a@b\.c/ })
    fireEvent.click(button)
    fireEvent.keyDown(button, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('«Вийти» викликає logout (POST /api/auth/logout)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/auth/me')
        ? new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
        : new Response(null, { status: 200 })))
    render(
      <UserProvider initialUser={testUser}>
        <UserMenu />
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /a@b\.c/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Вийти' }))
    // logout із UserProvider робить POST /api/auth/logout і скидає user — перевіряємо, що виклик пішов
    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) => String(u).includes('/api/auth/logout'))
      expect(calls.length).toBeGreaterThan(0)
    })
  })

  it('клік по пункту меню закриває меню', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <UserProvider initialUser={testUser}>
        <UserMenu />
      </UserProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /a@b\.c/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    // Клік по «Кабінет» і переходить, і одразу закриває меню (не чекаючи навігації)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Кабінет' }))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('клік поза меню закриває його', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })))
    render(
      <div>
        <div data-testid="outside">поза</div>
        <UserProvider initialUser={testUser}>
          <UserMenu />
        </UserProvider>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /a@b\.c/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
