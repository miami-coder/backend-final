import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/components/providers/user-provider', () => ({
  useUser: () => ({ user: null, setUser: vi.fn(), logout: vi.fn() }),
}))

import { RegisterForm } from '@/app/auth/register/register-form'

describe('RegisterForm (a11y помилок полів)', () => {
  it("помилка поля НЕ всередині label, пов'язана через aria-describedby", () => {
    render(<RegisterForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Зареєструватися' }))
    // Порожні поля: і «Ім'я», і «Прізвище» дають «Мінімум 2 символи» — беремо помилку
    // саме поля «Ім'я» через id, на який вказує aria-describedby
    const input = screen.getByLabelText("Ім'я", { selector: 'input' })
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toContain('firstname-error')
    const error = document.getElementById(describedBy as string)
    expect(error).not.toBeNull()
    expect(error).toHaveTextContent('Мінімум 2 символи')
    // помилка не вкладена в label поля (не забруднює accessible name)
    expect(error?.closest('label')).toBeNull()
  })

  it('немає помилки — aria-describedby не виставляється', () => {
    render(<RegisterForm />)
    const input = screen.getByLabelText("Ім'я", { selector: 'input' })
    expect(input.getAttribute('aria-describedby')).toBeNull()
  })
})
