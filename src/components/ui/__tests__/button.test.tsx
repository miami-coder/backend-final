import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
  it('type="submit" у пропсах ПЕРЕПИСУЄ дефолт button (сабміт у формі працює)', () => {
    const onSubmit = vi.fn()
    render(
      <form onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
        <Button type="submit">Надіслати</Button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Надіслати' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})
