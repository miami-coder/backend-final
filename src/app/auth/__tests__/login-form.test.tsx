import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Форма використовує useUser(); у тесті рендеримо її без UserProvider,
// тому мокаємо провайдер — інакше fetch від ефекту провайдера
// ламав би перевірку «не йде в мережу».
vi.mock('@/components/providers/user-provider', () => ({
  useUser: () => ({ user: null, setUser: vi.fn(), logout: vi.fn() }),
}))

import { LoginForm } from '@/app/auth/login/login-form'

describe('LoginForm', () => {
  it('показує помилку бекенда при 401', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Невірний email або пароль', details: null } }),
      { status: 401 },
    )))
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    await waitFor(() => expect(screen.getByText('Невірний email або пароль')).toBeInTheDocument())
  })

  it('клієнтська валідація: не валідний email не йде в мережу', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nope' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    await waitFor(() => expect(screen.getByText('Некоректний email')).toBeInTheDocument())
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
