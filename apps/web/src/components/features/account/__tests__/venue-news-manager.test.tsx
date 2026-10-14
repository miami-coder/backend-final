import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { VenueNewsManager } from '@/components/features/account/venue-news-manager'
import { parseNews, type News } from '@/types/news'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

const news: News[] = [parseNews({ id: 'n1', venueId: 'v1', category: 'promo', title: 'Заголовок новини', content: 'Текст довший за двадцять символів', imageUrl: null, status: 'published', isPromoted: false, publishedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' })]

function renderManager(list: News[] = news) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider><VenueNewsManager venueId="v1" news={list} /></ToastProvider>
    </UserProvider>,
  )
}

// Усі не-/auth/me запити успішні: {data}-конверт (DELETE/POST/PATCH — apiVoid/
// parseEmpty tolerate і порожнє тіло, тож конверт достатній)
function mockFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/auth/me')) {
      return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return new Response(JSON.stringify({ data: {} }), { status: 200, headers: { 'content-type': 'application/json' } })
  }))
}

describe('VenueNewsManager', () => {
  it('список рендерить заголовки новин', () => {
    renderManager()
    expect(screen.getByText('Заголовок новини')).toBeInTheDocument()
  })

  it('створення → POST /me/venues/v1/news без venueId → toast + refresh', async () => {
    mockFetch()
    renderManager()
    fireEvent.change(screen.getByLabelText('Категорія'), { target: { value: 'promo' } })
    fireEvent.change(screen.getByLabelText('Заголовок новини'), { target: { value: 'Нова акція закладу' } })
    fireEvent.change(screen.getByLabelText('Текст новини'), { target: { value: 'Текст акції довший за двадцять символів' } })
    fireEvent.click(screen.getByRole('button', { name: /додати новину/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/додано/i))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const call = apiCalls().find(([, i]) => (i as RequestInit).method === 'POST')
    expect(String(call?.[0])).toBe('/api/v1/me/venues/v1/news')
    const body = JSON.parse((call?.[1] as RequestInit).body as string)
    expect(body.venueId).toBeUndefined()
    expect(body.category).toBe('promo')
    expect(body.title).toBe('Нова акція закладу')
    expect(body.content).toBe('Текст акції довший за двадцять символів')
  })

  it('редагування → модалка з префілами → PATCH /news/n1', async () => {
    mockFetch()
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: /редагувати/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Редагувати новину' })
    expect(within(dialog).getByLabelText('Заголовок новини')).toHaveValue('Заголовок новини')
    expect(within(dialog).getByLabelText('Текст новини')).toHaveValue('Текст довший за двадцять символів')
    fireEvent.click(within(dialog).getByRole('button', { name: /зберегти/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/оновлено/i))
    const call = apiCalls().find(([, i]) => (i as RequestInit).method === 'PATCH')
    expect(String(call?.[0])).toBe('/api/v1/news/n1')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('видалення → DELETE /news/n1', async () => {
    mockFetch()
    renderManager()
    fireEvent.click(screen.getByRole('button', { name: /видалити/i }))
    fireEvent.click(await screen.findByRole('button', { name: /так, видалити/i }))
    const del = apiCalls().find(([, i]) => (i as RequestInit).method === 'DELETE')
    expect(String(del?.[0])).toBe('/api/v1/news/n1')
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('title <5 / content <20 → інлайн-помилка без POST', () => {
    mockFetch()
    renderManager()
    fireEvent.change(screen.getByLabelText('Заголовок новини'), { target: { value: 'коро' } })
    fireEvent.change(screen.getByLabelText('Текст новини'), { target: { value: 'Замало' } })
    fireEvent.click(screen.getByRole('button', { name: /додати новину/i }))
    expect(screen.getByRole('alert')).toHaveTextContent(/символів/i)
    expect(apiCalls().find(([, i]) => (i as RequestInit).method === 'POST')).toBeUndefined()
  })

  it('hint: заархівовані новини зникають із публічного списку', () => {
    renderManager()
    expect(screen.getByText(/заархівован/i)).toBeInTheDocument()
  })

  it('порожній список → порожнє повідомлення', () => {
    renderManager([])
    expect(screen.getByText(/новин у закладу ще немає/i)).toBeInTheDocument()
  })
})
