import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/ui/toast'
import { AdminNewsCreateForm } from '@/components/features/admin/admin-news-create-form'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

afterEach(() => vi.unstubAllGlobals())

// Сигнатура із (url, init): mock.calls[0] типізований як кортеж аргументів fetch
type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function okResponse() {
  return new Response(JSON.stringify({ data: { id: 'n9' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function badResponse() {
  return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Категорію не знайдено' } }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  })
}

function renderForm() {
  return render(
    <ToastProvider>
      <AdminNewsCreateForm />
    </ToastProvider>,
  )
}

function fillValid() {
  fireEvent.change(screen.getByRole('textbox', { name: 'Заголовок новини' }), {
    target: { value: 'Заголовок акції вересня' },
  })
  fireEvent.change(screen.getByRole('textbox', { name: 'Текст новини' }), {
    target: { value: 'Текст новини, достатньо довгий для валідації' },
  })
}

describe('AdminNewsCreateForm', () => {
  it('дефолти: категорія Загальне, статус Опубліковано (published), чекбокс не відмічений', () => {
    renderForm()
    expect(screen.getByRole('combobox', { name: 'Категорія' })).toHaveValue('general')
    expect(screen.getByRole('combobox', { name: 'Статус публікації' })).toHaveValue('published')
    expect(screen.getByRole('checkbox', { name: 'Промо-новина' })).not.toBeChecked()
  })

  it('валідація: короткий заголовок → inline помилка, fetch не викликається', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fireEvent.change(screen.getByRole('textbox', { name: 'Заголовок новини' }), {
      target: { value: 'Хело' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Створити новину' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Мінімум 5 символів'),
    )
    expect(fetchMock).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('успіх з дефолтами: POST /api/v1/admin/news exact body {category,title,content,status:"published",isPromoted:false} → toast «Новину створено» + refresh + reset', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Створити новину' }))
    await waitFor(() => expect(screen.getByText('Новину створено')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(String(url)).toBe('/api/v1/admin/news')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.body).toBe(
      JSON.stringify({
        category: 'general',
        title: 'Заголовок акції вересня',
        content: 'Текст новини, достатньо довгий для валідації',
        status: 'published',
        isPromoted: false,
      }),
    )
    expect(refresh).toHaveBeenCalled()
    // reset: поля повернулись до дефолтів
    expect(screen.getByRole('textbox', { name: 'Заголовок новини' })).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Статус публікації' })).toHaveValue('published')
    expect(screen.getByRole('checkbox', { name: 'Промо-новина' })).not.toBeChecked()
  })

  it('draft + промо + imageUrl: усі значення у body; порожній imageUrl у body не потрапляє', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fillValid()
    fireEvent.change(screen.getByRole('combobox', { name: 'Статус публікації' }), {
      target: { value: 'draft' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Промо-новина' }))
    fireEvent.click(screen.getByRole('button', { name: 'Створити новину' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    expect(init.body).toBe(
      JSON.stringify({
        category: 'general',
        title: 'Заголовок акції вересня',
        content: 'Текст новини, достатньо довгий для валідації',
        status: 'draft',
        isPromoted: true,
      }),
    )
  })

  it('заповнений imageUrl → у body', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => okResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fillValid()
    fireEvent.change(screen.getByRole('textbox', { name: 'URL зображення' }), {
      target: { value: 'https://example.com/img.png' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Створити новину' }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const [, init] = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit]
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body.imageUrl).toBe('https://example.com/img.png')
  })

  it('серверна помилка (ApiError) → inline alert, refresh не викликається', async () => {
    const fetchMock = vi.fn<FetchFn>(async () => badResponse())
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fillValid()
    fireEvent.click(screen.getByRole('button', { name: 'Створити новину' }))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Категорію не знайдено'),
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('подвійне натискання «Створити»: другий POST не летить (in-flight гард)', async () => {
    let resolve!: (r: Response) => void
    const pending = new Promise<Response>((r) => {
      resolve = r
    })
    const fetchMock = vi.fn<FetchFn>(async () => pending)
    vi.stubGlobal('fetch', fetchMock)
    renderForm()
    fillValid()
    const submit = screen.getByRole('button', { name: 'Створити новину' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    resolve(okResponse())
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
