import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserProvider } from '@/components/providers/user-provider'
import { ToastProvider } from '@/components/ui/toast'
import { VenuePhotoManager } from '@/components/features/account/venue-photo-manager'
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

const photos = [{ id: 'p1', url: '/static/a.jpg', sortOrder: 0 }]

describe('VenuePhotoManager', () => {
  it('список фото рендериться (img із src)', () => {
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><VenuePhotoManager venueId="v1" photos={photos} /></ToastProvider>
      </UserProvider>,
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', '/static/a.jpg')
  })

  it('вибір файлу → POST multipart на /venues/v1/photos → toast → refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/me')) {
        return new Response(JSON.stringify({ data: testUser }), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return new Response(JSON.stringify({ data: { url: '/static/new.jpg' } }), { status: 201, headers: { 'content-type': 'application/json' } })
    }))
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><VenuePhotoManager venueId="v1" photos={photos} /></ToastProvider>
      </UserProvider>,
    )
    const input = screen.getByLabelText(/додати фото/i) as HTMLInputElement
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/завантажено/i))
    const call = apiCalls().find(([, i]) => (i as RequestInit).method === 'POST')
    expect(String(call?.[0])).toBe('/api/v1/venues/v1/photos')
    expect((call?.[1] as RequestInit).body).toBeInstanceOf(FormData)
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('пояснення про бекенд-обмеження присутнє', () => {
    render(
      <UserProvider initialUser={testUser}>
        <ToastProvider><VenuePhotoManager venueId="v1" photos={[]} /></ToastProvider>
      </UserProvider>,
    )
    // Known limitation: завантажене фото може не з'явитись у галереї автоматично
    expect(screen.getByText(/може не з'явитись/i)).toBeInTheDocument()
  })
})
