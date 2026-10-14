import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/auth/session', () => ({
  getSessionTokens: vi.fn(async () => ({ accessToken: 'a', refreshToken: 'r' })),
}))

const serverFetch = vi.fn()
vi.mock('@/lib/api/server-client', () => ({
  serverFetch: (...args: unknown[]) => serverFetch(...args),
}))

// notFound у Next кидає — у моку теж кидаємо, щоб перевірити 404-гілку
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND')
  },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

// Острови — клієнтські (useToast/useRouter): у статичному рендері сторінки
// заміняємо їх заглушками, що серіалізують пропси
vi.mock('@/components/features/admin/user-profile-form', async () => ({
  UserProfileForm: (props: { userId: string; profile: unknown }) =>
    createElement('span', null, `profile-form:${props.userId}:${JSON.stringify(props.profile)}`),
}))
vi.mock('@/components/features/admin/user-roles-manager', async () => ({
  UserRolesManager: (props: { userId: string; roles: string[] }) =>
    createElement('span', null, `roles-manager:${props.userId}:${props.roles.join(',')}`),
}))
vi.mock('@/components/features/admin/user-delete-button', async () => ({
  UserDeleteButton: (props: { userId: string; email: string }) =>
    createElement('span', null, `delete-button:${props.userId}:${props.email}`),
}))
vi.mock('@/components/features/admin/user-message-button', async () => ({
  UserMessageButton: (props: { userId: string }) =>
    createElement('span', null, `message-button:${props.userId}`),
}))

import AdminUserPage from '@/app/admin/users/[id]/page'

const rawUser = {
  id: 'u1',
  email: 'admin@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
  roles: ['user', 'venue_admin'],
  profile: {
    firstname: 'Іван',
    lastname: 'Петренко',
    phone: '+380671234567',
    age: 25,
    avatarUrl: null,
  },
}

async function renderPage(id = 'u1'): Promise<string> {
  return renderToStaticMarkup(await AdminUserPage({ params: Promise.resolve({ id }) }))
}

describe('/admin/users/[id] — деталка користувача', () => {
  beforeEach(() => {
    serverFetch.mockReset()
    // serverFetch розгортає конверт { data: … } — мокаємо саме raw-користувача
    serverFetch.mockResolvedValue(rawUser)
  })

  it('успіх: GET /admin/users/:id (revalidate 0) → email, острови з пропсами', async () => {
    const html = await renderPage()
    expect(serverFetch).toHaveBeenCalledWith('/admin/users/u1', {
      tokens: { accessToken: 'a', refreshToken: 'r' },
      revalidate: 0,
    })
    // заголовок — email; під ним імʼя та дата
    expect(html).toContain('admin@example.com')
    expect(html).toContain('Іван Петренко')
    expect(html).toContain('січня')
    // бейджі ролей з ROLE_LABELS
    expect(html).toContain('Користувач')
    expect(html).toContain('Адмін закладів')
    // три острови: форма профілю з raw profile, менеджер ролей, кнопка видалення
    expect(html).toContain('profile-form:u1:')
    // серіалізований raw profile у заглушці (HTML екранує лапки)
    expect(html).toContain('&quot;firstname&quot;:&quot;Іван&quot;')
    expect(html).toContain('roles-manager:u1:user,venue_admin')
    expect(html).toContain('delete-button:u1:admin@example.com')
  })

  it('profile: null → форма отримує profile:null (без падіння)', async () => {
    serverFetch.mockResolvedValue({ ...rawUser, profile: null })
    const html = await renderPage()
    expect(html).toContain('profile-form:u1:null')
  })

  it('бекенд кинув (404/мережа) → notFound', async () => {
    serverFetch.mockRejectedValue(new Error('404'))
    await expect(renderPage('missing')).rejects.toThrow('NOT_FOUND')
  })
})
