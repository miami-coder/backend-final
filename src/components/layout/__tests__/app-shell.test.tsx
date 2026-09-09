import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { AppShell } from '@/components/layout/app-shell'
import { UserProvider } from '@/components/providers/user-provider'

const renderShell = () =>
  render(
    <UserProvider initialUser={null}>
      <AppShell><p>Контент сторінки</p></AppShell>
    </UserProvider>,
  )

beforeEach(() => {
  sessionStorage.clear()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 401 }))))
})

describe('AppShell (AgeGate inert)', () => {
  it('поки гейт не підтверджено — контент inert, гейт видимий', () => {
    const { container } = renderShell()
    expect(container.firstChild).toHaveAttribute('inert')
    expect(screen.getByRole('button', { name: /Підтверджую/ })).toBeInTheDocument()
  })
  it('після підтвердження — контент доступний, гейту нема', () => {
    sessionStorage.setItem('age-confirmed', '1')
    const { container } = renderShell()
    expect(container.firstChild).not.toHaveAttribute('inert')
    expect(screen.queryByText(/18 років/)).not.toBeInTheDocument()
  })
})