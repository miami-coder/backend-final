import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('без явного type → type="button"', () => {
    render(<Button>Натисни</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
  it('явний type="submit" не перезаписується', () => {
    render(<Button type="submit">Надіслати</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})
