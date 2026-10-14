import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RatingStars } from '@/components/ui/rating-stars'

describe('RatingStars', () => {
  it('null → «Немає оцінок»', () => {
    render(<RatingStars value={null} />)
    expect(screen.getByText('Немає оцінок')).toBeInTheDocument()
  })
  it('число з однією десятою і лічильник', () => {
    render(<RatingStars value={4.7} count={12} />)
    expect(screen.getByText('4,7')).toBeInTheDocument()
    expect(screen.getByText(/12 відгук/)).toBeInTheDocument()
  })
})
