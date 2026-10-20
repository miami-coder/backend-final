import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
}))

import { AppShell } from '@/components/layout/app-shell'
// Footer тепер async (фітчить тексти сайту з GET /content) — у тесті
// підмінюємо сервіс, щоб рендер був синхронним
vi.mock('@/services/content.server', () => ({
  getSiteContent: vi.fn(async () => ({ about: null, contacts: null })),
}))
import { UserProvider } from '@/components/providers/user-provider'

const renderShell = () =>
  render(
    <UserProvider initialUser={null}>
      <AppShell><p>Контент сторінки</p></AppShell>
    </UserProvider>,
  )

beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))))
})

describe('AppShell (AgeGate inert)', () => {
  it('поки гейт не підтверджено — контент inert, гейт видимий', () => {
    const { container } = renderShell()
    expect(container.firstChild).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: /Підтверджую/ })).toBeInTheDocument()
  })
  it('після підтвердження — контент доступний, гейту нема', () => {
    localStorage.setItem('age-confirmed', '1')
    const { container } = renderShell()
    expect(container.firstChild).not.toHaveAttribute('inert')
    expect(screen.queryByText(/18 років/)).not.toBeInTheDocument()
  })
})
