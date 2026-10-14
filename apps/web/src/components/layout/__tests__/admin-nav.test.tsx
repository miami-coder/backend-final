import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ usePathname: vi.fn(() => '/admin/venues') }))

import { AdminNav } from '@/components/layout/admin-nav'

describe('AdminNav', () => {
  it('активне посилання має aria-current="page"', () => {
    render(
      <AdminNav
        links={[
          { href: '/admin', label: 'Огляд' },
          { href: '/admin/venues', label: 'Заклади' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Заклади' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Огляд' })).not.toHaveAttribute('aria-current')
  })

  it('рендерить усі посилання з href', () => {
    render(
      <AdminNav
        links={[
          { href: '/admin', label: 'Огляд' },
          { href: '/admin/venues', label: 'Заклади' },
          { href: '/admin/users', label: 'Користувачі' },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Користувачі' })).toHaveAttribute('href', '/admin/users')
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
