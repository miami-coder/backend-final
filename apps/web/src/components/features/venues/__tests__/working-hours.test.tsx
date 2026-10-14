import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WorkingHours } from '@/components/features/venues/working-hours'

describe('WorkingHours', () => {
  it('мапить uk-мітки днів', () => {
    render(<WorkingHours hours={{ mon: '10:00-22:00', sat: '11:00-23:00' }} />)
    expect(screen.getByText('Понеділок')).toBeInTheDocument()
    expect(screen.getByText('Субота')).toBeInTheDocument()
    expect(screen.getByText('10:00-22:00')).toBeInTheDocument()
  })
  it('невідомий ключ дня → показує ключ як є (fallback)', () => {
    render(<WorkingHours hours={{ weird: '10:00-22:00' }} />)
    expect(screen.getByText('weird')).toBeInTheDocument()
  })
  it('порожні години → не рендериться', () => {
    const { container } = render(<WorkingHours hours={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
