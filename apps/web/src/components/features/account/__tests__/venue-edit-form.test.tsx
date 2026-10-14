import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { VenueEditForm } from '@/components/features/account/venue-edit-form'
import { parseVenue } from '@/types/venue'
import type { SessionUser } from '@/types/user'

afterEach(() => vi.unstubAllGlobals())

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))

const testUser: SessionUser = { id: 'u1', email: 'a@b.c', roles: ['user'] }

// RawVenue «як з GET /me/venues/:id» (відносини optional → порожні) → parseVenue
const rawVenue: Parameters<typeof parseVenue>[0] = {
  id: 'v1', ownerId: 'u1', name: 'Бар «Пиво»', description: 'Крафтове пиво', address: 'вул. Липова, 1',
  latitude: '50.45', longitude: '30.52',
  contacts: { phone: '+380671234567', instagram: 'https://instagram.com/pyvo' },
  workingHours: { monday: '10:00-22:00', tuesday: '12:00-23:00' },
  averageCheck: '250', mainPhotoUrl: null, status: 'approved', ratingAvg: '4.5', ratingCount: 2, viewCount: 10,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
  photos: [],
  featureAssignments: [{ venueId: 'v1', featureId: 'f1', feature: { id: 'f1', code: 'terrace', name: 'Крафтова веранда', icon: null } }],
  venueTags: [{ venueId: 'v1', tagId: 't1', tag: { id: 't1', name: 'крафт', slug: 'kraft' } }],
  venueTypeAssignments: [{ venueId: 'v1', typeId: 'ty1', type: { id: 'ty1', name: 'Бар', slug: 'bar' } }],
}
const venue = parseVenue(rawVenue)

function renderForm(ui: ReactNode) {
  return render(
    <UserProvider initialUser={testUser}>
      <ToastProvider>{ui}</ToastProvider>
    </UserProvider>,
  )
}

function apiCalls() {
  return (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([u]) => !String(u).endsWith('/auth/me'),
  )
}

function stubFetch(res: Response) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/auth/me')) {
      return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    return res
  }))
}

const okPatch = () => new Response(JSON.stringify({ data: { id: 'v1' } }), { status: 200, headers: { 'content-type': 'application/json' } })

describe('VenueEditForm', () => {
  beforeEach(() => {
    push.mockClear()
    refresh.mockClear()
  })

  it('префіл: поля містять name/address/phone/години з venue', () => {
    stubFetch(okPatch())
    renderForm(<VenueEditForm venue={venue} />)
    expect(screen.getByLabelText(/^Назва$/i)).toHaveValue('Бар «Пиво»')
    expect(screen.getByLabelText(/^Адреса$/i)).toHaveValue('вул. Липова, 1')
    expect(screen.getByLabelText('Телефон')).toHaveValue('+380671234567')
    expect(screen.getByLabelText('Години: Понеділок')).toHaveValue('10:00-22:00')
    // фічі/теги/тип — чипи read-only, полів введення немає
    expect(screen.queryByLabelText(/Фічі/i)).not.toBeInTheDocument()
    expect(screen.getByText('Крафтова веранда')).toBeInTheDocument()
  })

  it('сабміт → PATCH /venues/{id} лише зі зміненим name → toast + refresh', async () => {
    stubFetch(okPatch())
    renderForm(<VenueEditForm venue={venue} />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Оновлена назва' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const call = apiCalls()[0]
    expect(String(call[0])).toBe('/api/v1/venues/v1')
    expect((call[1] as RequestInit).method).toBe('PATCH')
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ name: 'Оновлена назва' })
    expect(screen.getByRole('status')).toHaveTextContent('Зміни збережено')
    expect(push).not.toHaveBeenCalled()
  })

  it('name <3 → інлайн-помилка, без PATCH', async () => {
    stubFetch(okPatch())
    renderForm(<VenueEditForm venue={venue} />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Ба' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/мінімум 3/i))
    expect(apiCalls().length).toBe(0)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('без змін → «Немає змін», без PATCH', async () => {
    stubFetch(okPatch())
    renderForm(<VenueEditForm venue={venue} />)
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Немає змін'))
    expect(apiCalls().length).toBe(0)
  })

  it('403 → інлайн-помилка з тексту ApiError, без refresh', async () => {
    stubFetch(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Не можна редагувати цей заклад' } }), { status: 403, headers: { 'content-type': 'application/json' } }))
    renderForm(<VenueEditForm venue={venue} />)
    fireEvent.change(screen.getByLabelText(/^Назва$/i), { target: { value: 'Оновлена назва' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Не можна редагувати цей заклад'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('зміна одного дня → PATCH надсилає ПОВНИЙ workingHours (бекенд замінює обʼєкт)', async () => {
    stubFetch(okPatch())
    renderForm(<VenueEditForm venue={venue} />)
    fireEvent.change(screen.getByLabelText('Години: Середа'), { target: { value: '09:00-21:00' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const body = JSON.parse((apiCalls()[0][1] as RequestInit).body as string)
    expect(body.workingHours).toEqual({ monday: '10:00-22:00', tuesday: '12:00-23:00', wednesday: '09:00-21:00' })
  })

  it('зміна телефону → PATCH надсилає ПОВНІ контакти (instagram не втрачається)', async () => {
    stubFetch(okPatch())
    renderForm(<VenueEditForm venue={venue} />)
    fireEvent.change(screen.getByLabelText('Телефон'), { target: { value: '+380991112233' } })
    fireEvent.click(screen.getByRole('button', { name: /Зберегти/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const body = JSON.parse((apiCalls()[0][1] as RequestInit).body as string)
    expect(body.contacts).toEqual({ phone: '+380991112233', instagram: 'https://instagram.com/pyvo' })
  })
})
