import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Хойстимо моки router, щоб кейси могли перевіряти виклики push/refresh
// (фабрика vi.mock підіймається вище оголошень, тому звичайні const не видно)
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
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
  beforeEach(() => {
    push.mockClear()
    refresh.mockClear()
    vi.unstubAllGlobals()
  })

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

  it('успішний логін + падіння /auth/me — все одно редірект (сесія встановлена)', async () => {
    // login → 200 ok; /auth/me → мережева помилка
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError('network')))
    render(<LoginForm />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } })
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Password1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    // Сесія ВЖЕ встановлена (login повернув 200) — редірект не блокується падінням /auth/me
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
    // Загальний catch не мав спрацювати — «Сервіс тимчасово недоступний» не показуємо
    expect(screen.queryByText('Сервіс тимчасово недоступний')).not.toBeInTheDocument()
  })
})
