import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { ReviewForm } from '@/components/features/venues/review-form'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

const jsonHeaders = { 'content-type': 'application/json' }
const testUser: SessionUser = { id: 'u1', email: 'u1@test.ua', roles: ['user'] }

// UserProvider на монтуванні сам фетчить /auth/me — віддаємо йому сесію,
// щоб не плутати лічильник викликів із запитами самої форми
function authAwareMock(resolver: (url: string) => Response) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return new Response(JSON.stringify({ data: testUser }), { headers: jsonHeaders })
    return resolver(url)
  })
}

// виклики форми — без /auth/me провайдера
function apiCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([u]) => !String(u).includes('/auth/me'))
}

function renderWithProviders(ui: ReactNode, user: SessionUser | null) {
  return render(
    <UserProvider initialUser={user}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

const valid = { rating: 5, text: 'Чудовий заклад' }
const ok201 = () => new Response(JSON.stringify({ data: { id: 'r1' } }), {
  status: 201, headers: jsonHeaders,
})

describe('ReviewForm (створення)', () => {
  it('клік без оцінки → помилка валідації, fetch НЕ викликається', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, testUser)
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    expect(screen.getByText('Оцініть заклад')).toBeInTheDocument()
    expect(apiCalls(fetchMock)).toHaveLength(0)
  })

  it('файл > 5MB → клієнтська помилка, fetch НЕ викликається', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, testUser)
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('radio', { name: /5/i }))
    const bigFile = new File(['x'.repeat(6 * 1024 * 1024)], 'check.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/Фото чеку/i), { target: { files: [bigFile] } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    expect(await screen.findByText(/не більше 5 МБ/i)).toBeInTheDocument()
    expect(apiCalls(fetchMock)).toHaveLength(0)
  })

  it('успіх → multipart POST, router.refresh()', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, testUser)
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('radio', { name: /5/i }))
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe('/api/v1/venues/v1/reviews')
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('успішне створення → форма очищається: текст порожній, зірки скинуті, файл знятий', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, testUser)
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('radio', { name: /5/i }))
    const file = new File(['photo'], 'check.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/Фото чеку/i), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.getByLabelText(/Відгук/i)).toHaveValue('')
    expect(screen.queryByRole('radio', { name: /5/i, checked: true })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Фото чеку/i)).toHaveValue('')
  })

  it('409 → показує повідомлення бекенда', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'CONFLICT', message: 'Ви вже залишили відгук про цей заклад', details: null } }),
      { status: 409, headers: jsonHeaders },
    )))
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, testUser)
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: valid.text } })
    fireEvent.click(screen.getByRole('radio', { name: /5/i }))
    fireEvent.click(screen.getByRole('button', { name: /Надіслати відгук/i }))
    expect(await screen.findByText(/Ви вже залишили відгук/i)).toBeInTheDocument()
  })
})

describe('ReviewForm (редагування/видалення наявного)', () => {
  it('наявний відгук → форма закрита: Редагувати/Видалити, клік Редагувати → підставлений редактор', () => {
    renderWithProviders(
      <ReviewForm venueId="v1" myReview={{ id: 'r1', rating: 3, text: 'Було нормально' }} />,
      testUser,
    )
    // Поля не показуються, поки форму не відкриють
    expect(screen.queryByLabelText(/^Відгук$/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Редагувати/i }))
    expect(screen.getByLabelText(/Відгук/i)).toHaveValue('Було нормально')
    expect(screen.getByRole('radio', { name: /3/i, checked: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Скасувати/i })).toBeInTheDocument()
  })

  it('скасування у редакторі → поворот до закритої картки з відкатом правок', () => {
    renderWithProviders(
      <ReviewForm venueId="v1" myReview={{ id: 'r1', rating: 3, text: 'Було нормально' }} />,
      testUser,
    )
    fireEvent.click(screen.getByRole('button', { name: /Редагувати/i }))
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: 'Тимчасова правка' } })
    fireEvent.click(screen.getByRole('button', { name: /Скасувати/i }))
    expect(screen.queryByLabelText(/^Відгук$/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Редагувати/i })).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Тимчасова правка')).not.toBeInTheDocument()
  })

  it('edit-режим: PATCH JSON {rating,text}', async () => {
    const fetchMock = vi.fn(async () => ok201())
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(
      <ReviewForm venueId="v1" myReview={{ id: 'r1', rating: 3, text: 'Було нормально' }} />,
      testUser,
    )
    fireEvent.click(screen.getByRole('button', { name: /Редагувати/i }))
    fireEvent.change(screen.getByLabelText(/Відгук/i), { target: { value: 'Стало ще краще' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe('/api/v1/reviews/r1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ rating: 3, text: 'Стало ще краще' })
  })

  it('видалення: модалка-підтвердження → DELETE + router.refresh()', async () => {
    const fetchMock = authAwareMock(() => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(
      <ReviewForm venueId="v1" myReview={{ id: 'r1', rating: 3, text: 'x'.repeat(10) }} />,
      testUser,
    )
    // Не window.confirm, а діалог у DOM: спершу модалка, DELETE лише після підтвердження
    fireEvent.click(screen.getByRole('button', { name: /Видалити/i }))
    await screen.findByRole('dialog', { name: /видалити відгук\?/i })
    expect(apiCalls(fetchMock)).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: /Так, видалити/i }), undefined)
    await waitFor(() => expect(apiCalls(fetchMock)).toHaveLength(1))
    const [url, init] = apiCalls(fetchMock)[0]
    expect(url).toBe('/api/v1/reviews/r1')
    expect(init.method).toBe('DELETE')
    // Успіх — модалка закрилася
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('видалення: «Скасувати» у модалці → без DELETE', async () => {
    const fetchMock = authAwareMock(() => new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    renderWithProviders(
      <ReviewForm venueId="v1" myReview={{ id: 'r1', rating: 3, text: 'x'.repeat(10) }} />,
      testUser,
    )
    fireEvent.click(screen.getByRole('button', { name: /Видалити/i }))
    await screen.findByRole('dialog', { name: /видалити відгук\?/i })
    fireEvent.click(screen.getByRole('button', { name: /Скасувати/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(apiCalls(fetchMock)).toHaveLength(0)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('гість → посилання на логін', () => {
    renderWithProviders(<ReviewForm venueId="v1" myReview={null} />, null)
    const link = screen.getByRole('link', { name: /Увійдіть/i })
    expect(link).toHaveAttribute('href', '/auth/login?next=/venues/v1')
  })
})
