import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { AgeGate } from '@/components/layout/age-gate'

beforeEach(() => sessionStorage.clear())

describe('AgeGate', () => {
  it('не показується, якщо в цьому сеансі вже підтверджено', () => {
    sessionStorage.setItem('age-confirmed', '1')
    const { container } = render(<AgeGate />)
    expect(container).toBeEmptyDOMElement()
  })
  it('показує попередження і після натискання ховається і ставить прапорець', () => {
    render(<AgeGate />)
    expect(screen.getByText(/18 років/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Підтверджую/ }))
    expect(sessionStorage.getItem('age-confirmed')).toBe('1')
    expect(screen.queryByText(/18 років/)).not.toBeInTheDocument()
  })
  it('натискання «Мені немає 18» показує текст про вихід', () => {
    render(<AgeGate />)
    fireEvent.click(screen.getByRole('button', { name: /Мені немає 18/ }))
    expect(screen.getByText(/Вийдіть із застосунку/i)).toBeInTheDocument()
    expect(sessionStorage.getItem('age-confirmed')).toBeNull()
  })
  it('діалог отримує фокус при монтуванні', () => {
    render(<AgeGate />)
    expect(screen.getByRole('dialog')).toHaveFocus()
  })
  it('зі стану відмови можна повернутися до підтвердження', () => {
    render(<AgeGate />)
    fireEvent.click(screen.getByRole('button', { name: /Мені немає 18/ }))
    expect(screen.getByText(/Вийдіть із застосунку/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Повернутися/ }))
    expect(screen.getByText(/18 років/)).toBeInTheDocument()
  })
})
