export type Role = 'user' | 'venue_admin' | 'super_admin' | 'critic'

export interface SessionUser {
  id: string
  email: string
  roles: Role[]
  // /auth/me повертає profile — імʼя показуємо в шапці замість пошти
  profile?: {
    firstname: string | null
    lastname: string | null
  }
}

export interface Profile {
  firstname: string | null
  lastname: string | null
  phone: string | null
  age: number | null
  avatarUrl: string | null
}
