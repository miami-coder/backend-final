import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// pathname змінюємо між кейсами через зовнішню змінну (vi.mock піднімається нагору)
let mockPathname = '/'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => mockPathname,
}))

import { Header } from '@/components/layout/header'
import { UserProvider } from '@/components/providers/user-provider'

// Гість: UserMenu не рендериться; /auth/me повертає 401 — user лишається null
const renderHeader = () =>
  render(
    <UserProvider initialUser={null}>
      <Header />
    </UserProvider>,
  )

beforeEach(() => {
  mockPathname = '/'
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))))
})

describe('Header (активна навігація)', () => {
  it('pathname «/» — активний лише «Каталог»', () => {
    renderHeader()
    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Новини' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Зустрічі' })).not.toHaveAttribute('aria-current')
  })

  it('pathname «/news» — активний лише «Новини»', () => {
    mockPathname = '/news'
    renderHeader()
    expect(screen.getByRole('link', { name: 'Новини' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Каталог' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Зустрічі' })).not.toHaveAttribute('aria-current')
  })

  it('префікс не активує: pathname «/venues/some-id» — жоден пункт не активний', () => {
    mockPathname = '/venues/some-id'
    renderHeader()
    expect(screen.getByRole('link', { name: 'Каталог' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Новини' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Зустрічі' })).not.toHaveAttribute('aria-current')
  })
})